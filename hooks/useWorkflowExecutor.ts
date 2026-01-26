import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import { trpc } from '@/utils/trpc';
import { toast } from 'sonner';

// ✅ Accept workflowId prop
export function useWorkflowExecutor(workflowId?: string) {
    const { getNodes, getEdges, setNodes } = useReactFlow();

    // 1. The Server-Side Endpoint (Creates DB Run + Triggers Worker)
    const startWorkflow = trpc.workflow.run.useMutation();

    // 2. Utils for Polling
    const utils = trpc.useContext(); 

    // --- Helper: Poll for Master Job Completion ---
    // We poll the Trigger.dev run status using the triggerId
    const pollForWorkflowResult = async (triggerId: string) => {
        console.log(`⏳ Waiting for Worker Job ${triggerId}...`);

        for (let i = 0; i < 600; i++) { // Poll for up to 10 mins (1s interval)
            
            // Check status via your existing media router endpoint
            // This endpoint likely calls runs.retrieve(triggerId)
            const result = await utils.media.getRunStatus.fetch({ runId: triggerId }, { staleTime: 0 });

            if (result.status === "COMPLETED" && result.output) {
                return result.output; // Returns map: { nodeId: outputData }
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
        // 1. Validation
        if (!workflowId) {
            toast.error("Workflow ID is missing. Cannot run.");
            return;
        }

        const allNodes = getNodes();
        const allEdges = getEdges();

        // Filter nodes if running selection only
        const nodesToRun = selectedOnly ? allNodes.filter(n => n.selected) : allNodes;
        
        if (nodesToRun.length === 0) {
            toast.warning("No nodes selected to run.");
            return;
        }

        toast.info(selectedOnly ? "Running selection..." : "Running workflow...");

        try {
            // 2. Dispatch to Server 
            // The server creates the DB record and returns the Trigger ID
            const { runId, triggerId } = await startWorkflow.mutateAsync({
                workflowId,
                nodes: nodesToRun,
                edges: allEdges, // Send all edges for context resolution
                scope: selectedOnly ? 'PARTIAL' : 'FULL'
            });

            console.log(`✅ Server Run Initiated. DB ID: ${runId}, Trigger ID: ${triggerId}`);

            // 3. Poll for Final Results using Trigger ID
            const resultsMap = await pollForWorkflowResult(triggerId);

            // 4. Update UI with Results
            // @ts-ignore
            setNodes((currentNodes) => currentNodes.map((node) => {
                // Check if we have a result for this node in the map
                // @ts-ignore
                if (resultsMap[node.id]) {
                    // Smartly update based on node type
                    const resultData = resultsMap[node.id];
                    
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            // Populate common output fields
                            output: resultData,         // Text nodes / LLM
                            outputImage: resultData,    // Image/Crop nodes (URL)
                            videoUrl: resultData,       // Video nodes (if applicable)
                        }
                    };
                }
                return node;
            }));

            toast.success("Execution completed successfully!");

        } catch (error: any) {
            console.error(error);
            toast.error(`Execution Failed: ${error.message}`);
        }

    }, [getNodes, getEdges, setNodes, startWorkflow, utils, workflowId]);

    return { 
        executeSelection,
        isRunning: startWorkflow.isPending 
    };
}