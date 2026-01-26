import React, { useState, useEffect, memo } from 'react';
import { Handle, Position, NodeProps, useStore, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { Bot, ChevronDown, MoreHorizontal, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/utils/trpc';
import { useExecutionLog } from '@/hooks/useExecutionLog';

const MODELS = [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Fast)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Powerful)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
    // 1. Read directly from data (Store Source of Truth)
    const model = data.model || 'gemini-2.5-flash';
    const imageInputCount = data.imageInputCount || 1;
    
    // Global vs Local loading state
    const isGlobalRunning = data.isRunning || false;
    const [isLocalRunning, setIsLocalRunning] = useState(false);
    const isLoading = isGlobalRunning || isLocalRunning;

    const { getNodes, getEdges, setNodes } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const { logExecution } = useExecutionLog();

    // Utils for Local Run
    const utils = trpc.useUtils();
    const generateMutation = trpc.gemini.generate.useMutation();

    const edges = useStore((s) => s.edges);
    const isSystemConnected = edges.some((e) => e.target === id && e.targetHandle === 'system');
    const isUserConnected = edges.some((e) => e.target === id && e.targetHandle === 'user');
    const isOutputConnected = edges.some((e) => e.source === id);

    const imageInputsConnected = Array.from({ length: imageInputCount }, (_, i) =>
        edges.some((e) => e.target === id && e.targetHandle === `images-${i}`)
    );

    useEffect(() => {
        updateNodeInternals(id);
    }, [imageInputCount, id, updateNodeInternals]);

    // ✅ Helper to update global store
    const updateData = (updates: any) => {
        setNodes((nodes) =>
            nodes.map((node) => {
                if (node.id === id) {
                    return { ...node, data: { ...node.data, ...updates } };
                }
                return node;
            })
        );
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        updateData({ model: e.target.value });
    };

    const addImageInput = () => {
        updateData({ imageInputCount: imageInputCount + 1 });
    };

    // --- HELPER: Poll for Completion (For Local Run) ---
    const pollForCompletion = async (runId: string): Promise<string> => {
        for (let i = 0; i < 120; i++) {
            const result = await utils.media.getRunStatus.fetch({ runId }, { staleTime: 0 });

            if (result.status === "COMPLETED" && result.output) {
                // @ts-ignore
                return result.output.text || result.output;
            }

            if (["FAILED", "CRASHED", "CANCELED"].includes(result.status)) {
                // @ts-ignore
                const errorMessage = result.error?.message || "Job failed";
                throw new Error(errorMessage);
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        throw new Error("Timeout waiting for LLM");
    };

    // --- Local "Run Model" Button Logic ---
    const runTask = async () => {
        const allNodes = getNodes();
        const allEdges = getEdges();

        const getConnectedText = (handleId: string) => {
            const edge = allEdges.find(e => e.target === id && e.targetHandle === handleId);
            if (!edge) return undefined;
            const sourceNode = allNodes.find(n => n.id === edge.source);
            return sourceNode?.data?.label || sourceNode?.data?.output;
        };

        const getConnectedImage = (handleId: string) => {
            const edge = allEdges.find(e => e.target === id && e.targetHandle === handleId);
            if (!edge) return undefined;
            const sourceNode = allNodes.find(n => n.id === edge.source);
            if (!sourceNode) return undefined;
            return sourceNode.data.outputImage || sourceNode.data.imageUrl || sourceNode.data.output;
        };

        const systemPrompt = getConnectedText('system') || undefined;
        const userPrompt = getConnectedText('user') || "";

        const images: string[] = [];
        for (let i = 0; i < imageInputCount; i++) {
            const imgData = getConnectedImage(`images-${i}`);
            if (imgData && typeof imgData === 'string' && imgData.startsWith('http')) {
                images.push(imgData);
            }
        }

        if (!userPrompt && images.length === 0) {
            toast.error("Please connect a Text Node or an Image Node.");
            return;
        }

        setIsLocalRunning(true);
        toast.info(`Running ${model}...`);

        try {
            const result = await logExecution(
                id,
                'LLM Node',
                { model, systemPrompt, userPrompt: userPrompt.slice(0, 50) + '...' },
                async () => {
                    const res = await generateMutation.mutateAsync({
                        model: model,
                        systemPrompt: systemPrompt,
                        userPrompt: userPrompt,
                        images: images.length > 0 ? images : undefined
                    });
                    const finalText = await pollForCompletion(res.runId);
                    return finalText;
                }
            );

            // ✅ Write result back to store
            updateData({ output: result });
            toast.success("Generation complete!");

        } catch (err: any) {
            console.error(err);
            toast.error(`Generation failed: ${err.message}`);
        } finally {
            setIsLocalRunning(false);
        }
    };

    const minHeight = Math.max(380, 240 + (imageInputCount * 50));

    return (
        <div
            style={{ minHeight: `${minHeight}px` }}
            className={`
                relative flex flex-col w-95 rounded-[24px] border shadow-2xl overflow-visible font-sans
                transition-all duration-200 group z-10
                ${selected
                    ? 'bg-[#0e0e10] border-[#27272a]'
                    : 'bg-[#09090b] border-[#27272a] hover:border-slate-600'
                }
                ${isLoading ? 'ring-2 ring-purple-500/50 shadow-[0_0_30px_-5px_rgba(168,85,247,0.4)]' : ''}
            `}
        >
            {/* --- Header --- */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <span className="text-[15px] font-semibold text-white">
                    {MODELS.find(m => m.id === model)?.name || model}
                </span>
                <button className="text-slate-500 hover:text-white transition-colors">
                    <MoreHorizontal size={20} />
                </button>
            </div>

            {/* --- Body --- */}
            <div className="px-5 pb-5 flex flex-col gap-4 flex-1">

                {/* Configuration */}
                <div>
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <span className="scale-75">⚡</span> MODEL CONFIGURATION
                    </label>
                    <div className="relative group/select">
                        <select
                            value={model}
                            onChange={handleModelChange}
                            className="w-full bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] text-slate-200 text-[13px] rounded-lg px-3 py-2.5 outline-none focus:border-slate-500 appearance-none cursor-pointer transition-all font-medium"
                        >
                            {MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover/select:text-slate-300 transition-colors" />
                    </div>
                </div>

                {/* Output Box */}
                <div className="relative w-full h-35 bg-[#18181b] rounded-xl border border-[#27272a] flex flex-col p-4 flex-1">
                    <div className="flex-1 w-full overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent hover:scrollbar-thumb-slate-600 transition-colors">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                                <Loader2 className="animate-spin text-purple-500" size={24} />
                                <span className="text-xs">Generating...</span>
                            </div>
                        ) : data.output ? (
                            <p className="text-sm text-slate-300 w-full whitespace-pre-wrap leading-relaxed pb-2">
                                {data.output}
                            </p>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <span className="text-sm text-slate-600 font-medium">
                                    The generated text will appear here
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-auto pt-2">
                    <button
                        onClick={addImageInput}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-xs font-medium"
                    >
                        <Plus size={14} />
                        <span>Add image input</span>
                    </button>

                    <button
                        onClick={runTask}
                        disabled={isLoading}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Bot size={16} />
                        <span className="text-xs font-bold">Run Model</span>
                    </button>
                </div>
            </div>

            {/* --- INPUT HANDLES --- */}
            <Handle
                id="system"
                type="target"
                position={Position.Left}
                className={`
                w-3.5! h-3.5! border-[3px]! top-21.25! -left-2.25! transition-all duration-300
                border-[#4ade80]! 
                ${isSystemConnected ? 'bg-[#4ade80]!' : 'bg-[#09090b]!'}
            `}
                title="System Prompt"
            />

            <Handle
                id="user"
                type="target"
                position={Position.Left}
                className={`
                w-3.5! h-3.5! border-[3px]! top-33.75! -left-2.25! transition-all duration-300
                border-[#ec4899]! 
                ${isUserConnected ? 'bg-[#ec4899]!' : 'bg-[#09090b]!'}
            `}
                title="User Message"
            />

            {Array.from({ length: imageInputCount }, (_, index) => (
                <Handle
                    key={`images-${index}`}
                    id={`images-${index}`}
                    type="target"
                    position={Position.Left}
                    className={`
                    w-3.5! h-3.5! border-[3px]! -left-2.25! transition-all duration-300
                    border-[#a855f7]!
                    ${imageInputsConnected[index] ? 'bg-[#a855f7]!' : 'bg-[#09090b]!'}
                `}
                    style={{ top: `${185 + index * 50}px` }}
                    title={`Image Input ${index + 1}`}
                />
            ))}

            <Handle
                type="source"
                position={Position.Right}
                className={`
                w-3.5! h-3.5! border-[3px]! -right-2.25! transition-all duration-300
                border-[#facc15]!
                ${isOutputConnected ? 'bg-[#facc15]!' : 'bg-[#09090b]!'}
            `}
                style={{ top: `${185 + imageInputCount * 50}px` }}
                title="Generated Text"
            />
        </div>
    );
});

LLMNode.displayName = "LLMNode";