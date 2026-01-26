import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from 'reactflow';
import { trpc } from '@/utils/trpc';
import { useExecutionLog } from './useExecutionLog';
import { toast } from 'sonner';

export function useWorkflowExecutor() {
    const { getNodes, getEdges, setNodes } = useReactFlow();
    const { createRun, finalizeRun, logNodeStep } = useExecutionLog();

    // 1. Get TRPC Utils (Needed for manual polling)
    const utils = trpc.useUtils();

    // 2. API Mutations
    const generateText = trpc.gemini.generate.useMutation();
    const extractFrame = trpc.media.extractFrame.useMutation();
    const cropImage = trpc.media.cropImage.useMutation();

    // --- Helper: Sort Nodes (Topological Sort) ---
    const getSortedNodes = (nodesToRun: Node[], allEdges: Edge[]) => {
        const visited = new Set<string>();
        const sorted: Node[] = [];
        const visiting = new Set<string>();

        const visit = (nodeId: string) => {
            if (visiting.has(nodeId)) return;
            if (visited.has(nodeId)) return;

            visiting.add(nodeId);

            const dependencies = allEdges
                .filter((e) => e.target === nodeId)
                .map((e) => e.source);

            dependencies.forEach((depId) => {
                if (nodesToRun.find((n) => n.id === depId)) {
                    visit(depId);
                }
            });

            visiting.delete(nodeId);
            visited.add(nodeId);

            const node = nodesToRun.find((n) => n.id === nodeId);
            if (node) sorted.push(node);
        };

        nodesToRun.forEach((node) => visit(node.id));
        return sorted;
    };

    // --- Helper: Resolve Inputs ---
    const resolveInputs = (nodeId: string, edges: Edge[], nodes: Node[]) => {
        const inputEdges = edges.filter(e => e.target === nodeId);
        const inputs: Record<string, any> = {};

        inputEdges.forEach(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (!sourceNode) return;

            // A. Determine Base Value
            let val = sourceNode.data.output;

            if (['cropImageNode', 'extractFrameNode', 'imageNode'].includes(sourceNode.type || '')) {
                val = sourceNode.data.outputImage || sourceNode.data.imageUrl || sourceNode.data.output;
            }
            else if (sourceNode.type === 'videoNode') {
                val = sourceNode.data.videoUrl;
            }
            else if (sourceNode.type === 'textNode') {
                val = sourceNode.data.label;
            }

            // B. Map to specific Target Handles
            if (edge.targetHandle === 'user') {
                inputs.userPrompt = val;
            }
            else if (edge.targetHandle === 'system') {
                inputs.systemPrompt = val;
            }
            else if (edge.targetHandle === 'video-input') {
                inputs.videoUrl = val || sourceNode.data.videoUrl;
            }
            else if (edge.targetHandle === 'input') {
                inputs.imageInput = val;
            }
            else if (edge.targetHandle?.startsWith('images-')) {
                if (val && (typeof val === 'string')) {
                    if (!inputs.images) inputs.images = [];
                    inputs.images.push(val);
                }
            }
            else if (['x', 'y', 'width', 'height'].includes(edge.targetHandle || '')) {
                inputs[edge.targetHandle!] = Number(val);
            }
            else if (edge.targetHandle === 'timestamp-input') {
                inputs.timestamp = val;
            }
            else if (edge.targetHandle === 'config-input') {
                inputs.configText = val;
            }
        });
        return inputs;
    };

    // --- Helper: Poll for Task Completion ---
    // ✅ UPDATED: Now handles both Image URLs (Media) and Text (LLM)
    const pollForCompletion = async (runId: string): Promise<any> => {
        console.log(`⏳ Waiting for task ${runId} to finish...`);

        // Poll for up to 5 minutes
        for (let i = 0; i < 300; i++) {
            // FORCE FRESH DATA: { staleTime: 0 } is crucial here!
            const result = await utils.media.getRunStatus.fetch(
                { runId },
                { staleTime: 0 }
            );

            if (i % 5 === 0 || result.status === "COMPLETED") {
                console.log(`🔄 Polling ${runId}: ${result.status}`);
            }

            if (result.status === "COMPLETED" && result.output) {
                // CASE A: Text Output (LLM)
                // @ts-ignore
                if (result.output.text) {
                    // @ts-ignore
                    return result.output.text;
                }

                // CASE B: Image/Media Output
                let finalUrl = "";
                if (typeof result.output === "string") {
                    finalUrl = result.output;
                } else if (typeof result.output === "object" && result.output !== null) {
                    // @ts-ignore
                    finalUrl = result.output.imageUrl || result.output.url || result.output.secure_url || result.output.image;
                }

                if (finalUrl) return finalUrl;

                // Fallback: Return raw output if no specific field found
                return result.output;
            }

            if (["FAILED", "CANCELED", "CRASHED"].includes(result.status)) {
                throw new Error(`Task failed: ${result.error?.message || result.status}`);
            }

            // Adaptive Delay
            const delay = i < 10 ? 500 : 1000;
            await new Promise(r => setTimeout(r, delay));
        }
        throw new Error("Task timed out. Check if your worker is running.");
    };


    // --- MAIN EXECUTOR ---
    const executeSelection = useCallback(async (selectedOnly: boolean = false) => {

        const allNodes = getNodes();
        const allEdges = getEdges();

        const targetNodes = selectedOnly
            ? allNodes.filter(n => n.selected)
            : allNodes;

        if (targetNodes.length === 0) {
            toast.error("No nodes selected");
            return;
        }

        const executionOrder = getSortedNodes(targetNodes, allEdges);
        const runScope = selectedOnly ? 'PARTIAL' : 'FULL';

        const run = await createRun(runScope);
        toast.info(`Started ${runScope} run...`);

        let hasError = false;

        // 2. Iterate and Execute
        for (const node of executionOrder) {
            const currentNodes = getNodes();
            const inputs = resolveInputs(node.id, allEdges, currentNodes);

            try {
                await logNodeStep(run.id, node.id, node.type || 'Unknown', inputs, async () => {

                    // --- A. LLM Node (✅ FIXED: Now uses Polling) ---
                    if (node.type === 'llmNode') {
                        // 1. Trigger the Job
                        const startRes = await generateText.mutateAsync({
                            model: node.data.model || 'gemini-1.5-flash',
                            systemPrompt: inputs.systemPrompt,
                            userPrompt: inputs.userPrompt || node.data.prompt,
                            images: inputs.images
                        });

                        console.log("LLM Job Started:", startRes.runId);

                        // 2. Poll for Text Result
                        const textOutput = await pollForCompletion(startRes.runId);

                        // 3. Update State
                        setNodes((nds) => nds.map((n) =>
                            n.id === node.id ? { ...n, data: { ...n.data, output: textOutput } } : n
                        ));
                        return textOutput;
                    }

                    // --- B. Extract Frame Node ---
                    else if (node.type === 'extractFrameNode') {
                        const videoUrl = inputs.videoUrl || node.data.videoUrl;
                        if (!videoUrl) throw new Error("No video URL provided.");

                        const startRes = await extractFrame.mutateAsync({
                            videoUrl,
                            timestamp: String(inputs.timestamp || node.data.timestamp || "0")
                        });

                        const imageUrl = await pollForCompletion(startRes.runId);

                        setNodes((nds) => nds.map((n) =>
                            n.id === node.id ? { ...n, data: { ...n.data, outputImage: imageUrl } } : n
                        ));
                        return imageUrl;
                    }

                    // --- C. Crop Image Node ---
                    else if (node.type === 'cropImageNode') {
                        const imageUrl = inputs.imageInput || node.data.imageUrl;
                        if (!imageUrl) throw new Error("No image to crop");

                        let extraParams: Record<string, any> = {};
                        if (inputs.configText) {
                            try {
                                extraParams = JSON.parse(inputs.configText);
                            } catch (e) {
                                const lines = String(inputs.configText).split('\n');
                                lines.forEach(line => {
                                    const [k, v] = line.split(':');
                                    if (k && v) extraParams[k.trim()] = parseFloat(v.trim());
                                });
                            }
                        }

                        const x = inputs.x ?? extraParams['x'] ?? node.data.x ?? 0;
                        const y = inputs.y ?? extraParams['y'] ?? node.data.y ?? 0;
                        const width = inputs.width ?? extraParams['width'] ?? node.data.width ?? 100;
                        const height = inputs.height ?? extraParams['height'] ?? node.data.height ?? 100;

                        const startRes = await cropImage.mutateAsync({
                            imageUrl,
                            crop: { x, y, width, height }
                        });

                        const croppedUrl = await pollForCompletion(startRes.runId);

                        setNodes((nds) => nds.map((n) =>
                            n.id === node.id ? { ...n, data: { ...n.data, outputImage: croppedUrl } } : n
                        ));
                        return croppedUrl;
                    }

                    return "Pass-through";
                });

            } catch (err) {
                hasError = true;
                console.error(`Node ${node.id} failed:`, err);
                break;
            }
        }

        await finalizeRun(run.id, hasError ? 'FAILED' : 'SUCCESS');

        if (hasError) toast.error("Run failed. Check history.");
        else toast.success("Workflow run complete!");

    }, [getNodes, getEdges, createRun, finalizeRun, logNodeStep, setNodes, utils]);

    return { executeSelection };
}