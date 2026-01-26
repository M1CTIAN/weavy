import { task, runs } from "@trigger.dev/sdk/v3";
// ✅ Import the tools from your existing media.ts file
import { extractFrameTask, cropImageTask, runLLMTask } from "./media";

// --- HELPERS ---

// 1. Topological Sort (Ordering the nodes)
function getSortedNodes(nodes: any[], edges: any[]) {
    const visited = new Set<string>();
    const sorted: any[] = [];
    const visiting = new Set<string>();

    const visit = (nodeId: string) => {
        if (visiting.has(nodeId)) return;
        if (visited.has(nodeId)) return;

        visiting.add(nodeId);

        const dependencies = edges
            .filter((e) => e.target === nodeId)
            .map((e) => e.source);

        dependencies.forEach((depId) => {
            if (nodes.find((n) => n.id === depId)) {
                visit(depId);
            }
        });

        visiting.delete(nodeId);
        visited.add(nodeId);

        const node = nodes.find((n) => n.id === nodeId);
        if (node) sorted.push(node);
    };

    nodes.forEach((node) => visit(node.id));
    return sorted;
}

// 2. Input Resolver (Passing data between nodes)
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

// 3. Polling Helper
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
    run: async (payload: { nodes: any[], edges: any[] }) => {
        const { nodes, edges } = payload;

        const executionOrder = getSortedNodes(nodes, edges);
        console.log(`📋 Order: ${executionOrder.map(n => n.type).join(' -> ')}`);

        const outputs = new Map<string, any>();

        for (const node of executionOrder) {
            const inputs = resolveInputs(node.id, edges, nodes, outputs);
            let result: any = null;

            console.log(`▶️ Running: ${node.type}`);

            try {
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
                    if (node.data.output) result = node.data.output;
                    else if (node.data.videoUrl) result = node.data.videoUrl;
                    else if (node.data.imageUrl) result = node.data.imageUrl;
                    else if (node.data.label) result = node.data.label;
                }

                if (result) outputs.set(node.id, result);

            } catch (error: any) {
                console.error(`❌ Node ${node.id} Failed:`, error);
                throw error;
            }
        }

        return Object.fromEntries(outputs);
    },
});