import { useCallback } from 'react';
import { useReactFlow, Node, Edge } from 'reactflow';
import { trpc } from '@/utils/trpc';
import { useExecutionLog } from './useExecutionLog';
import { toast } from 'sonner';

// ✅ Updated Hook Signature
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
  // Since we are running a sequence, we MUST wait for the background task to finish
  const pollForCompletion = async (runId: string): Promise<string> => {
    console.log(`⏳ Polling task ${runId}...`);
    
    // Poll max 60 times (1 minute)
    for (let i = 0; i < 60; i++) {
        // Fetch status directly using the client
        const result = await utils.media.getRunStatus.fetch({ runId });
        
        if (result.status === "COMPLETED" && result.output) {
            // Extract URL robustly
            let finalUrl = "";
            if (typeof result.output === "string") {
                finalUrl = result.output;
            } else if (typeof result.output === "object" && result.output !== null) {
                // @ts-ignore
                finalUrl = result.output.imageUrl || result.output.url || result.output.secure_url || result.output.image;
            }
            if (finalUrl) return finalUrl;
        }

        if (["FAILED", "CANCELED", "CRASHED"].includes(result.status)) {
            throw new Error(`Task failed with status: ${result.status} - ${result.error?.message}`);
        }

        // Wait 1 second before retrying
        await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error("Task timed out waiting for completion");
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
            
            // --- A. LLM Node ---
            if (node.type === 'llmNode') {
                const res = await generateText.mutateAsync({
                   model: node.data.model || 'gemini-2.5-flash',
                   systemPrompt: inputs.systemPrompt,
                   userPrompt: inputs.userPrompt || node.data.prompt,
                   images: inputs.images 
                });
                
                setNodes((nds) => nds.map((n) => 
                  n.id === node.id ? { ...n, data: { ...n.data, output: res.output } } : n
                ));
                return res.output;
            } 
            
            // --- B. Extract Frame Node (UPDATED: POLLING) ---
            else if (node.type === 'extractFrameNode') {
                const videoUrl = inputs.videoUrl || node.data.videoUrl;
                if (!videoUrl) throw new Error("No video URL provided.");

                // 1. Start Task
                const startRes = await extractFrame.mutateAsync({
                    videoUrl,
                    timestamp: String(inputs.timestamp || node.data.timestamp || "0")
                });

                // 2. Poll for Result
                const imageUrl = await pollForCompletion(startRes.runId);

                // 3. Update State
                setNodes((nds) => nds.map((n) => 
                  n.id === node.id ? { ...n, data: { ...n.data, outputImage: imageUrl } } : n
                ));
                return imageUrl;
            }

            // --- C. Crop Image Node (UPDATED: POLLING) ---
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

                // 1. Start Task
                const startRes = await cropImage.mutateAsync({
                    imageUrl,
                    crop: { x, y, width, height }
                });

                // 2. Poll for Result
                const croppedUrl = await pollForCompletion(startRes.runId);

                // 3. Update State
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