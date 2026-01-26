import React, { useState, useEffect, memo } from 'react';
import { Handle, Position, NodeProps, useStore, useReactFlow } from 'reactflow';
import { Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const connectionSelector = (id: string) => (store: any) => 
  store.edges.some((edge: any) => edge.source === id);

export const ImageNode = memo(({ id, data, selected }: NodeProps) => {
  // Use setNodes to update global store
  const { setNodes } = useReactFlow();
  
  // Local loading state just for the upload process
  const [isUploading, setIsUploading] = useState(false);
  
  // Reactive connection check
  const isConnected = useStore(connectionSelector(id));

  // Helper to update node data in the store properly
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

  const ACCEPTED_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
    'image/gif': ['.gif']
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!Object.keys(ACCEPTED_TYPES).includes(file.type)) {
      toast.error("Invalid file type.");
      return;
    }

    setIsUploading(true);

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        
        // ✅ Update global store immediately
        updateData({ imageUrl: base64String });
        
        setIsUploading(false);
        toast.success("Image uploaded!");
    };
    reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
    };
    reader.readAsDataURL(file); 
  };

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering file input if overlay issues exist
    updateData({ imageUrl: "" });
  };

  // Use data from props directly (it will be updated by store)
  const imageUrl = data.imageUrl;

  return (
    <div 
      className={`
        relative flex flex-col gap-3 p-4 rounded-[20px] border min-w-[300px] shadow-xl
        transition-all duration-200 group
        ${selected 
            ? 'bg-[#202024] border-[#27272a] ring-1 ring-slate-700' 
            : 'bg-[#18181b] border-[#27272a] hover:border-slate-600'
        }
      `}
    >
        {/* Header */}
        <div className="flex items-center gap-2 px-1">
            <div className="p-1.5 rounded-md bg-[#27272a] text-purple-400">
                <ImageIcon size={16} />
            </div>
            <span className="text-[13px] font-medium text-slate-300">Upload Image</span>
        </div>

        {/* Upload Area */}
        <div className="relative w-full min-h-[160px] bg-[#202024] rounded-xl border border-dashed border-[#27272a] hover:border-purple-500/30 transition-colors flex flex-col items-center justify-center overflow-hidden group/upload">
            {imageUrl ? (
                <>
                    <div className="flex items-center justify-center p-3 w-full h-full">
                        <img 
                            src={imageUrl} 
                            alt="Preview" 
                            className="max-w-full max-h-60 object-contain rounded-lg shadow-md" 
                        />
                    </div>
                    {/* Hover Overlay with Delete Button */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                            onClick={clearImage} 
                            className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors"
                            title="Remove Image"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </>
            ) : (
                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-6">
                    <div className="p-3 bg-[#27272a] rounded-full mb-3 group-hover/upload:scale-110 group-hover/upload:bg-purple-500/20 transition-all">
                        <Upload size={20} className="text-slate-400 group-hover/upload:text-purple-400 transition-colors" />
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Click to upload image</span>
                    <span className="text-[10px] text-slate-500 mt-2">JPG, PNG, WEBP, GIF</span>
                    <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.webp,.gif" onChange={handleFileUpload} />
                </label>
            )}
            
            {isUploading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-purple-500" />
                        <span className="text-xs text-slate-400">Uploading...</span>
                    </div>
                </div>
            )}
        </div>

        {/* Output Handle */}
        <Handle 
            type="source" 
            position={Position.Right} 
            className={`
                !w-3.5 !h-3.5 !border-[3px] !-right-[9px] transition-all duration-300
                !border-[#a855f7]
                ${isConnected ? '!bg-[#a855f7]' : '!bg-[#18181b]'}
            `}
        />
    </div>
  );
});

ImageNode.displayName = "ImageNode";