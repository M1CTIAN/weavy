import React, { useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useStore, useReactFlow } from 'reactflow';
import { Film, Play, Loader2, Image as ImageIcon, Clock, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/utils/trpc';
import { useExecutionLog } from '@/hooks/useExecutionLog';

export function ExtractFrameNode({ id, data, selected }: NodeProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 1. Polling State
  const [runId, setRunId] = useState<string | null>(null);

  // Manual inputs state
  const [manualTimestamp, setManualTimestamp] = useState(data.timestamp || "0");
  const [manualVideoUrl, setManualVideoUrl] = useState(data.videoUrl || "");

  const { getNodes, getEdges, setNodes } = useReactFlow();
  const edges = useStore((s) => s.edges);
  
  const { logExecution } = useExecutionLog();

  // 2. Mutation: Starts task & gets runId (Fire & Forget)
  const extractMutation = trpc.media.extractFrame.useMutation({
    onSuccess: (res) => {
        setRunId(res.runId); // Start polling
        toast.info("Extraction started...");
    },
    onError: (err) => {
        setIsProcessing(false);
        toast.error(`Failed to start: ${err.message}`);
    }
  });

  // 3. Query: Polls status every 1s
  const statusQuery = trpc.media.getRunStatus.useQuery(
    { runId: runId! },
    {
      enabled: !!runId,
      refetchInterval: 1000, 
    }
  );

  // 4. Effect: Watch Polling Results
  useEffect(() => {
    if (!statusQuery.data) return;

    const { status, output, error } = statusQuery.data;

    if (status === "COMPLETED" && output) {

       // 🔍 Robust URL Extraction
       let finalUrl = "";
       if (typeof output === "string") {
           finalUrl = output; 
       } else if (typeof output === "object" && output !== null) {
           // @ts-ignore
           finalUrl = output.imageUrl || output.url || output.secure_url || output.image;
       }

       if (!finalUrl) {
           toast.error("Task completed but returned no image URL");
           return;
       }

       // Update Global Graph State
       setNodes((nodes) => nodes.map((node) => {
         if (node.id === id) {
           return {
             ...node,
             data: { ...node.data, outputImage: finalUrl }
           };
         }
         return node;
       }));

       // Update Local Data Ref
       data.outputImage = finalUrl;

       // Cleanup
       setRunId(null);
       setIsProcessing(false);
       toast.success("Frame extracted successfully!");
    } 
    else if (status === "FAILED" || status === "CANCELED" || status === "CRASHED") {
       setRunId(null);
       setIsProcessing(false);
       toast.error(`Task failed: ${error?.message || "Unknown error"}`);
    }
  }, [statusQuery.data, id, setNodes, data]);


  const runExtraction = async () => {
    const allEdges = getEdges();
    const allNodes = getNodes();
    
    // --- A. GET VIDEO URL ---
    let videoUrl = manualVideoUrl;

    if (isConnected('video-input')) {
        const videoEdge = allEdges.find(e => e.target === id && e.targetHandle === 'video-input');
        if (videoEdge) {
            const sourceNode = allNodes.find(n => n.id === videoEdge.source);
            if (sourceNode?.type === 'videoNode') {
                videoUrl = sourceNode.data.videoUrl;
            } else if (sourceNode?.type === 'textNode') {
                videoUrl = sourceNode.data.label; 
            } else {
                videoUrl = sourceNode?.data?.videoUrl || sourceNode?.data?.output;
            }
        }
    }

    if (!videoUrl) {
        toast.error("Please enter or connect a Video URL.");
        return;
    }
    if (typeof videoUrl === 'string' && videoUrl.startsWith('blob:')) {
        toast.error("Video is still uploading. Please wait.");
        return;
    }

    // --- B. GET TIMESTAMP ---
    let finalTimestamp = parseFloat(manualTimestamp);
    
    if (isConnected('timestamp-input')) {
        const timestampEdge = allEdges.find(e => e.target === id && e.targetHandle === 'timestamp-input');
        if (timestampEdge) {
            const tsNode = allNodes.find(n => n.id === timestampEdge.source);
            const tsValue = tsNode?.data?.output || tsNode?.data?.label;
            
            if (tsValue !== undefined) {
                const parsed = Number(String(tsValue).trim());
                if (!isNaN(parsed)) finalTimestamp = parsed;
            }
        }
    }

    setIsProcessing(true);

    // Trigger the mutation (runId is handled in onSuccess above)
    // Wrapping in logExecution for your analytics
    try {
        await logExecution(
            id,
            'Extract Frame',
            { videoUrl, timestamp: finalTimestamp },
            async () => {
                 await extractMutation.mutateAsync({
                    videoUrl: videoUrl,
                    timestamp: String(finalTimestamp)
                 });
                 return "Processing..."; // Placeholder return for log
            }
        );
    } catch (err: any) {
        setIsProcessing(false);
        // Error toast is handled by mutation onError
    }
  };

  const isConnected = (handleId: string) => edges.some((e) => e.target === id && e.targetHandle === handleId);
  const isVideoConnected = isConnected('video-input');
  const isTimestampConnected = isConnected('timestamp-input');

  return (
    <div 
      className={`
        relative flex flex-col w-[280px] rounded-[24px] border shadow-2xl font-sans
        transition-all duration-200 group bg-[#18181b] overflow-visible
        ${selected ? 'border-slate-500' : 'border-[#27272a] hover:border-slate-600'}
      `}
    >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-[#27272a]">
            <div className="p-1.5 rounded-md bg-blue-500/20 text-blue-400">
                <Film size={16} />
            </div>
            <span className="text-[13px] font-semibold text-slate-200">Extract Frame</span>
        </div>

        {/* Body */}
        <div className="p-4 flex flex-col gap-4">
            
            {/* 1. Video URL Input */}
            <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                    <LinkIcon size={12} className="text-slate-500"/>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Video URL</label>
                </div>
                <input 
                    type="text"
                    value={isVideoConnected ? '' : manualVideoUrl}
                    disabled={isVideoConnected}
                    onChange={(e) => { setManualVideoUrl(e.target.value); data.videoUrl = e.target.value; }}
                    className={`
                        w-full border rounded px-2 py-1 text-xs outline-none transition-colors truncate
                        ${isVideoConnected 
                            ? 'bg-[#27272a] border-[#27272a] text-slate-500 cursor-not-allowed placeholder:text-slate-600' 
                            : 'bg-[#09090b] border-[#27272a] text-white focus:border-blue-500'
                        }
                    `}
                    placeholder={isVideoConnected ? "Using connected video" : "https://example.com/video.mp4"}
                />
            </div>

            {/* 2. Timestamp Input */}
            <div className="relative">
                <div className="flex items-center gap-2 mb-1">
                    <Clock size={12} className="text-slate-500"/>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Timestamp (seconds)</label>
                </div>
                <input 
                    type="number" min="0" step="0.1"
                    value={isTimestampConnected ? '' : manualTimestamp}
                    disabled={isTimestampConnected} 
                    onChange={(e) => { setManualTimestamp(e.target.value); data.timestamp = e.target.value; }}
                    className={`
                        w-full border rounded px-2 py-1 text-xs outline-none transition-colors
                        ${isTimestampConnected 
                            ? 'bg-[#27272a] border-[#27272a] text-slate-500 cursor-not-allowed placeholder:text-slate-600' 
                            : 'bg-[#09090b] border-[#27272a] text-white focus:border-blue-500'
                        }
                    `}
                    placeholder={isTimestampConnected ? "Using connected value" : "e.g. 5"}
                />
            </div>

            {/* Action Button */}
            <button 
                onClick={runExtraction}
                disabled={isProcessing}
                className="flex items-center justify-center gap-2 w-full bg-white text-black py-2 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
                {/* Visual change: If runId exists, we are polling */}
                {isProcessing || runId ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="black" />}
                <span className="text-xs font-bold">
                    {runId ? "Extracting..." : "Extract Frame"}
                </span>
            </button>

            {/* Result Image */}
            {data.outputImage && (
                <div className="relative mt-1 rounded-lg overflow-hidden border border-[#27272a] bg-black/40 group/img">
                    <img src={data.outputImage} alt="Result" className="w-full h-32 object-contain" />
                    <div className="absolute top-2 right-2 bg-black/60 p-1 rounded text-white text-[10px]">
                        <ImageIcon size={12} />
                    </div>
                </div>
            )}
        </div>

        {/* --- Handles --- */}
        <Handle 
            id="video-input" type="target" position={Position.Left} style={{ top: 82 }} 
            className={`!w-3.5 !h-3.5 !border-[3px] !-left-[9px] !border-[#3b82f6] ${isVideoConnected ? '!bg-[#3b82f6]' : '!bg-[#18181b]'}`}
            title="Video Input"
        />
        <Handle 
            id="timestamp-input" type="target" position={Position.Left} style={{ top: 142 }} 
            className={`!w-3.5 !h-3.5 !border-[3px] !-left-[9px] !border-[#ec4899] ${isTimestampConnected ? '!bg-[#ec4899]' : '!bg-[#18181b]'}`}
            title="Timestamp Input"
        />
        <Handle 
            type="source" position={Position.Right} 
            className="!w-3.5 !h-3.5 !bg-[#18181b] !border-[3px] !border-[#a855f7] !-right-[9px]" 
            title="Image Output"
        />
    </div>
  );
}