import React, { useState } from 'react';
import { Handle, Position, NodeProps, useStore, useReactFlow } from 'reactflow';
import { Crop, Play, Loader2, Settings2, Info, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/utils/trpc';

export function CropImageNode({ id, data, selected }: NodeProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  // Remove local outputImage state to force reading from props
  const [showInfo, setShowInfo] = useState(false);
  
  // Defaults
  const [params, setParams] = useState({
    x: data.x !== undefined ? data.x : 0,
    y: data.y !== undefined ? data.y : 0,
    width: data.width !== undefined ? data.width : 100,
    height: data.height !== undefined ? data.height : 100,
  });

  // FIX: Get setNodes
  const { getNodes, getEdges, setNodes } = useReactFlow();
  const edges = useStore((s) => s.edges);

  const isConnected = (handleId: string) => edges.some((e) => e.target === id && e.targetHandle === handleId);
  const isConfigConnected = isConnected('config-input');

  const cropMutation = trpc.media.cropImage.useMutation({
    onSuccess: (res) => {
        // FIX: Update global state on success
        setNodes((nodes) => nodes.map((node) => {
            if (node.id === id) {
                return {
                    ...node,
                    data: { ...node.data, outputImage: res.imageUrl }
                };
            }
            return node;
        }));

        // Also update local data ref
        data.outputImage = res.imageUrl; 
        setIsProcessing(false);
        toast.success("Image cropped!");
    },
    onError: (err) => {
        setIsProcessing(false);
        toast.error(err.message);
    }
  });

  const handleParamChange = (key: keyof typeof params, value: string) => {
    const num = parseFloat(value);
    const fallback = (key === 'width' || key === 'height') ? 100 : 0;
    const newParams = { ...params, [key]: isNaN(num) ? fallback : num };
    
    setParams(newParams);
    data[key] = newParams[key];
  };

  const runCrop = async () => {
    const allEdges = getEdges();
    const allNodes = getNodes();
    
    // 1. Get Image Source
    const inputEdge = allEdges.find(e => e.target === id && e.targetHandle === 'input');
    if (!inputEdge) {
        toast.error("Connect an image source first.");
        return;
    }
    const sourceNode = allNodes.find(n => n.id === inputEdge.source);
    
    // FIX: Smart Data Extraction
    let inputImageUrl = "";
    if (sourceNode?.type === 'extractFrameNode') {
        inputImageUrl = sourceNode.data.outputImage;
    } else if (sourceNode?.type === 'imageNode') {
        inputImageUrl = sourceNode.data.imageUrl;
    } else if (sourceNode?.type === 'cropImageNode') {
        inputImageUrl = sourceNode.data.outputImage;
    }

    if (!inputImageUrl || inputImageUrl.startsWith("New ")) {
        toast.error("Source node has no output image. Run it first!");
        return;
    }

    // 2. Resolve Parameters
    let finalParams = { ...params };

    // A. Check GLOBAL Config Handle first (PARSING LOGIC ADDED HERE)
    if (isConfigConnected) {
        const configEdge = allEdges.find(e => e.target === id && e.targetHandle === 'config-input');
        if (configEdge) {
            const node = allNodes.find(n => n.id === configEdge.source);
            // Text Node stores value in 'label'
            const text = node?.data?.label || "";
            
            try {
                // Try JSON first
                const json = JSON.parse(text);
                finalParams = { ...finalParams, ...json };
                toast.success("Applied Config from JSON");
            } catch (e) {
                // Try Parsing "Key: Value" lines
                const lines = String(text).split('\n');
                let foundAny = false;
                lines.forEach(line => {
                    const parts = line.split(':');
                    if (parts.length === 2) {
                        const k = parts[0].trim().toLowerCase();
                        const v = parseFloat(parts[1].trim());
                        if (['x', 'y', 'width', 'height'].includes(k) && !isNaN(v)) {
                            finalParams[k as keyof typeof params] = v;
                            foundAny = true;
                        }
                    }
                });
                if (foundAny) toast.success("Applied Config from Text");
            }
        }
    }

    // B. Check Individual Handles (Override global config)
    ['x', 'y', 'width', 'height'].forEach((param) => {
        if (isConnected(param)) {
            const edge = allEdges.find(e => e.target === id && e.targetHandle === param);
            if (edge) {
                const node = allNodes.find(n => n.id === edge.source);
                const val = parseFloat(node?.data?.label || "0");
                if (!isNaN(val)) finalParams[param as keyof typeof params] = val;
            }
        }
    });

    setIsProcessing(true);
    cropMutation.mutate({ imageUrl: inputImageUrl, crop: finalParams });
  };

  return (
    <div 
      className={`
        relative flex flex-col w-75 rounded-[24px] border shadow-2xl font-sans
        transition-all duration-200 group bg-[#18181b] overflow-visible
        ${selected ? 'border-slate-500' : 'border-[#27272a] hover:border-slate-600'}
      `}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[#27272a]">
            <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-purple-500/20 text-purple-400">
                    <Crop size={16} />
                </div>
                <span className="text-[13px] font-semibold text-slate-200">Crop Image</span>
            </div>
            {/* Info Toggle */}
            <button onClick={() => setShowInfo(!showInfo)} className="text-slate-500 hover:text-slate-300">
                <Info size={14} />
            </button>
        </div>

        {/* --- DYNAMIC INSTRUCTIONS PANEL --- */}
        {(isConfigConnected || showInfo) && (
            <div className={`
                px-4 py-3 text-[10px] leading-relaxed border-b
                ${isConfigConnected 
                    ? 'bg-green-500/10 border-green-500/20 text-green-200'
                    : 'bg-slate-800/50 border-slate-700 text-slate-300'
                }
            `}>
                <div className="flex items-center gap-2 mb-1 font-bold">
                    <Terminal size={12} />
                    <span>{isConfigConnected ? "Config Active" : "Format Guide"}</span>
                </div>
                <div className="font-mono opacity-80 bg-black/20 p-2 rounded whitespace-pre">
                    x: 10{'\n'}y: 20{'\n'}width: 50{'\n'}height: 50
                </div>
            </div>
        )}

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
            
            {/* Global Config Handle */}
            <div className="relative">
                 <div className="text-[10px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                    <Settings2 size={10} />
                    <span>Global Config</span>
                 </div>
                 <Handle 
                    id="config-input" 
                    type="target" 
                    position={Position.Left}
                    style={{ top: '50%', transform: 'translateY(-50%)' }}
                    className={`w-3! h-3! border-2! -left-5.25! ${isConfigConnected ? 'bg-green-500!' : 'bg-[#18181b]! border-green-500!'}`}
                    title="Connect Text Node here (Green)"
                />
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                {(['x', 'y', 'width', 'height'] as const).map((key) => {
                    const connected = isConnected(key);
                    return (
                        <div key={key} className="relative group/input">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{key} (%)</label>
                            
                            <input 
                                type="text" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={isConfigConnected || connected ? '' : params[key]}
                                disabled={isConfigConnected || connected}
                                onChange={(e) => handleParamChange(key, e.target.value)}
                                className={`
                                    w-full border rounded px-2 py-1 text-xs outline-none transition-colors
                                    ${(isConfigConnected || connected) 
                                        ? 'bg-[#27272a] border-[#27272a] text-slate-500 cursor-not-allowed placeholder:text-slate-500' 
                                        : 'bg-[#09090b] border-[#27272a] text-white focus:border-purple-500'
                                    }
                                `}
                                placeholder={isConfigConnected ? "via Config" : (connected ? "Linked" : "0")}
                            />
                            
                            {/* ALIGNED HANDLE */}
                            <Handle 
                                id={key} 
                                type="target" 
                                position={Position.Left}
                                isConnectable={!isConfigConnected} 
                                style={{ top: '65%', transform: 'translateY(-50%)' }} 
                                className={`
                                    -left-4.5! w-3! h-3! border-2! transition-all
                                    ${isConfigConnected 
                                        ? 'bg-slate-700! border-slate-700! opacity-20 cursor-not-allowed' // Visually Dimmed
                                        : (connected ? 'bg-[#ec4899]!' : 'bg-[#18181b]! border-[#ec4899]!') // Active Pink
                                    }
                                `}
                            />
                        </div>
                    );
                })}
            </div>

            <button 
                onClick={runCrop}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 w-full bg-white text-black py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
                {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="black" />}
                <span className="text-xs font-bold">Crop Now</span>
            </button>

            {/* FIX: Use data.outputImage directly */}
            {data.outputImage && (
                <div className="relative mt-1 rounded-lg overflow-hidden border border-[#27272a] bg-black/40">
                    <img src={data.outputImage} alt="Result" className="w-full h-32 object-contain" />
                </div>
            )}
        </div>

        {/* Main Image Input */}
        <Handle 
            id="input" type="target" position={Position.Left} style={{ top: 28 }}
            className={`w-3.5! h-3.5! border-[3px]! -left-2.25! border-[#a855f7]! ${isConnected('input') ? 'bg-[#a855f7]!' : 'bg-[#18181b]!'}`}
            title="Image Input"
        />
        
        {/* Output */}
        <Handle 
            type="source" position={Position.Right} 
            className="w-3.5! h-3.5! bg-[#18181b]! border-[3px]! border-[#a855f7]! -right-2.25!" 
            title="Cropped Output"
        />
    </div>
  );
}