// ✅ 1. Load Env Vars FIRST (Critical for Database Connection)
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { task, runs, logger } from "@trigger.dev/sdk/v3";
import { extractFrameTask, cropImageTask, runLLMTask } from "./media";

import { prisma as db } from "../lib/prisma";

// --- HELPERS ---

// Database Sync Helper
async function saveNodeStatus(data: {
    runId?: string;
    nodeId: string;
    nodeType: string;
    status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
    inputs?: any;
    outputs?: any;
    error?: string;
    startTime?: Date;
    endTime?: Date;
}) {
    if (!data.runId) return;

    try {
        await db.nodeExecution.upsert({
            where: {
                runId_nodeId: {
                    runId: data.runId,
                    nodeId: data.nodeId
                }
            },
            update: {
                status: data.status,
                inputs: data.inputs ? JSON.stringify(data.inputs) : undefined,
                outputs: data.outputs ? JSON.stringify(data.outputs) : undefined,
                error: data.error,
                startTime: data.startTime,
                endTime: data.endTime,
                duration: (data.endTime && data.startTime)
                    ? data.endTime.getTime() - data.startTime.getTime()
                    : undefined
            },
            create: {
                runId: data.runId,
                nodeId: data.nodeId,
                nodeType: data.nodeType,
                status: data.status,
                inputs: data.inputs ? JSON.stringify(data.inputs) : undefined,
                startTime: data.startTime || new Date(),
                nodeLabel: data.nodeType
            }
        });

        logger.info(`💾 DB Sync [${data.status}]: ${data.nodeType}`, { nodeId: data.nodeId });

    } catch (err: any) {
        console.error("Failed to save node status to DB:", err.message);
    }
}

// Topological Sort
function getSortedNodes(nodes: any[], edges: any[]) {
    const visited = new Set<string>();
    const sorted: any[] = [];
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
        if (visiting.has(nodeId)) return;
        if (visited.has(nodeId)) return;
        visiting.add(nodeId);
        const dependencies = edges.filter((e) => e.target === nodeId).map((e) => e.source);
        dependencies.forEach((depId) => {
            if (nodes.find((n) => n.id === depId)) visit(depId);
        });
        visiting.delete(nodeId);
        visited.add(nodeId);
        const node = nodes.find((n) => n.id === nodeId);
        if (node) sorted.push(node);
    };
    nodes.forEach((node) => visit(node.id));
    return sorted;
}

// Input Resolver
function resolveInputs(nodeId: string, edges: any[], nodes: any[], outputs: Map<string, any>) {
    const inputEdges = edges.filter((e) => e.target === nodeId);
    const inputs: Record<string, any> = {};

    inputEdges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) return;
        let val = outputs.get(sourceNode.id);

        if (val === undefined) {
            if (sourceNode.type === 'videoNode') val = sourceNode.data.videoUrl;
            else if (sourceNode.type === 'imageNode') val = sourceNode.data.imageUrl;
            else if (sourceNode.type === 'textNode') val = sourceNode.data.label;
        }

        if (edge.targetHandle === 'user') inputs.userMessage = val;
        else if (edge.targetHandle === 'system') inputs.systemPrompt = val;
        else if (edge.targetHandle === 'video-input') inputs.videoUrl = val;
        else if (edge.targetHandle === 'input') inputs.imageUrl = val;
        else if (edge.targetHandle?.startsWith('images-')) {
            if (!inputs.imageUrls) inputs.imageUrls = [];
            inputs.imageUrls.push(val);
        }
        else if (['x', 'y', 'width', 'height'].includes(edge.targetHandle || '')) {
            inputs[edge.targetHandle!] = Number(val);
        }
        else if (edge.targetHandle === 'timestamp-input') inputs.timestamp = val;
        else if (edge.targetHandle === 'config-input') inputs.configText = val;
    });

    return inputs;
}

// Polling Helper
async function triggerAndWait(taskHandle: any) {
    const { id } = taskHandle;
    while (true) {
        const run = await runs.retrieve(id);
        if (run.status === "COMPLETED") return run.output;
        if (["FAILED", "CANCELED", "CRASHED"].includes(run.status)) {
            throw new Error(`Sub-task ${id} failed: ${run.error?.message || run.status}`);
        }
        await new Promise(r => setTimeout(r, 1000));
    }
}

// --- MAIN ORCHESTRATOR TASK ---
export const workflowTask = task({
    id: "workflow-orchestrator",
    maxDuration: 600,
    run: async (payload: { nodes: any[], edges: any[], runId?: string }) => {
        const { nodes, edges, runId } = payload;
        const executionOrder = getSortedNodes(nodes, edges);

        logger.info("Workflow Plan Created", {
            order: executionOrder.map(n => n.type),
            runId: runId || "N/A"
        });

        const outputs = new Map<string, any>();

        try {
            // --- EXECUTION LOOP ---
            for (const node of executionOrder) {
                const inputs = resolveInputs(node.id, edges, nodes, outputs);
                const startTime = new Date();
                let result: any = null;

                // 1. Log Node Start
                await saveNodeStatus({
                    runId,
                    nodeId: node.id,
                    nodeType: node.type,
                    status: "RUNNING",
                    inputs,
                    startTime
                });

                logger.info(`▶️ Running: ${node.type}`, { nodeId: node.id });

                try {
                    // ... (Keep your existing Node Execution Logic here: llmNode, extractFrameNode, etc.) ...
                    if (node.type === 'llmNode') {
                        const handle = await runLLMTask.trigger({
                            model: node.data.model || 'gemini-1.5-flash',
                            systemPrompt: inputs.systemPrompt,
                            userMessage: inputs.userMessage || node.data.prompt,
                            imageUrls: inputs.imageUrls
                        });
                        const output = await triggerAndWait(handle);
                        result = output.text || output;
                    }
                    else if (node.type === 'extractFrameNode') {
                        const videoUrl = inputs.videoUrl || node.data.videoUrl;
                        const timestamp = String(inputs.timestamp || node.data.timestamp || "0");
                        const handle = await extractFrameTask.trigger({ videoUrl, timestamp });
                        const output = await triggerAndWait(handle);
                        result = output.imageUrl || output;
                    }
                    else if (node.type === 'cropImageNode') {
                        const imageUrl = inputs.imageUrl || node.data.imageUrl;
                        const crop = {
                            x: inputs.x ?? node.data.x ?? 0,
                            y: inputs.y ?? node.data.y ?? 0,
                            width: inputs.width ?? node.data.width ?? 100,
                            height: inputs.height ?? node.data.height ?? 100,
                        };
                        const handle = await cropImageTask.trigger({ imageUrl, crop });
                        const output = await triggerAndWait(handle);
                        result = output.imageUrl || output;
                    }
                    else {
                        // Pass-through
                        if (node.data.output) result = node.data.output;
                        else if (node.data.videoUrl) result = node.data.videoUrl;
                        else if (node.data.imageUrl) result = node.data.imageUrl;
                        else if (node.data.label) result = node.data.label;
                    }

                    if (result) {
                        outputs.set(node.id, result);

                        // 2. Log Node Success
                        await saveNodeStatus({
                            runId,
                            nodeId: node.id,
                            nodeType: node.type,
                            status: "SUCCESS",
                            outputs: result,
                            startTime,
                            endTime: new Date()
                        });
                    }

                } catch (nodeError: any) {
                    // 3. Log Node Failure
                    await saveNodeStatus({
                        runId,
                        nodeId: node.id,
                        nodeType: node.type,
                        status: "FAILED",
                        error: nodeError.message,
                        startTime,
                        endTime: new Date()
                    });
                    throw nodeError; // Re-throw to stop the loop
                }
            }

            // ✅ NEW: Mark the Entire Workflow Run as SUCCESS
            if (runId) {
                await db.workflowRun.update({
                    where: { id: runId },
                    data: {
                        status: "SUCCESS",
                        // If you have a completedAt column on WorkflowRun, set it here:
                        // completedAt: new Date() 
                    }
                });
                logger.info(`✅ Workflow Run ${runId} marked as SUCCESS`);
            }

            return Object.fromEntries(outputs);

        } catch (error: any) {
            // ✅ NEW: Mark the Entire Workflow Run as FAILED
            if (runId) {
                await db.workflowRun.update({
                    where: { id: runId },
                    data: {
                        status: "FAILED",
                        // completedAt: new Date()
                    }
                });
                logger.error(`❌ Workflow Run ${runId} marked as FAILED`);
            }
            throw error;
        }
    },
});