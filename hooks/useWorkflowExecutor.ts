import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { trpc } from '@/utils/trpc';
import { useExecutionLog } from './useExecutionLog';
import { toast } from 'sonner';

export function useWorkflowExecutor() {
    const { getNodes, getEdges, setNodes } = useReactFlow();
    const { createRun, finalizeRun } = useExecutionLog(); // logNodeStep is no longer needed on client!

    // 1. The New Server-Side Endpoint
    const startWorkflow = trpc.workflow.run.useMutation();

    // 2. Utils for Polling
    const utils = trpc.useUtils();

    // --- Helper: Poll for Master Job Completion ---
    const pollForWorkflowResult = async (runId: string) => {
        console.log(`⏳ Waiting for Workflow ${runId}...`);

        for (let i = 0; i < 600; i++) { // Poll for up to 10 mins
            // We use the same 'getRunStatus' but for the workflow task
            // You might need to ensure your backend 'getRunStatus' checks the generic 'runs' table
            const result = await utils.media.getRunStatus.fetch({ runId }, { staleTime: 0 });

            if (result.status === "COMPLETED" && result.output) {
                return result.output; // This will be the map of { nodeId: output }
            }

            if (["FAILED", "CANCELED", "CRASHED"].includes(result.status)) {
                // @ts-ignore
                const err = result.error?.message || result.error || "Unknown Error";
                throw new Error(String(err));
            }

            await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error("Workflow timed out.");
    };

    // --- MAIN EXECUTOR ---
    const executeSelection = useCallback(async (selectedOnly: boolean = false) => {
        const allNodes = getNodes();
        const allEdges = getEdges();

        // Filter if needed
        const nodesToRun = selectedOnly ? allNodes.filter(n => n.selected) : allNodes;
        if (nodesToRun.length === 0) {
            toast.error("No nodes to run.");
            return;
        }

        // 1. Log the Start
        const run = await createRun(selectedOnly ? 'PARTIAL' : 'FULL');
        toast.info(" dispatched to server...");

        try {
            // 2. Dispatch to Server (The "Big Switch")
            const { runId } = await startWorkflow.mutateAsync({
                nodes: nodesToRun,
                edges: allEdges // Pass all edges so server can resolve inputs
            });

            // 3. Poll for Final Results
            // The server returns a map: { "node-1": "http://...", "node-2": "Text..." }
            const resultsMap = await pollForWorkflowResult(runId);

            // 4. Update UI with Results
            // @ts-ignore
            setNodes((currentNodes) => currentNodes.map((node) => {
                // Check if we have a result for this node in the map
                // @ts-ignore
                if (resultsMap[node.id]) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            // Update relevant field based on node type
                            output: resultsMap[node.id],      // Text/Generic
                            outputImage: resultsMap[node.id], // Image
                            // For video/other types, you might need smarter mapping here
                            // but your backend mostly returns strings (URLs/Text)
                        }
                    };
                }
                return node;
            }));

            await finalizeRun(run.id, 'SUCCESS');
            toast.success("Server execution complete!");

        } catch (error: any) {
            console.error(error);
            await finalizeRun(run.id, 'FAILED');
            toast.error(`Server Error: ${error.message}`);
        }

    }, [getNodes, getEdges, createRun, finalizeRun, setNodes, startWorkflow, utils]);

    return { executeSelection };
}