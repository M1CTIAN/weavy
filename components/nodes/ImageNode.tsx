import React, { useState } from 'react';
import { Handle, Position, NodeProps, useStore } from 'reactflow';
import { Image as ImageIcon, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const connectionSelector = (id: string) => (store: any) => 
  store.edges.some((edge: any) => edge.source === id);

export function ImageNode({ id, data, selected }: NodeProps) {
  const [preview, setPreview] = useState<string | null>(() => data?.imageUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  
  // Reactive connection check
  const isConnected = useStore(connectionSelector(id));

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

    // Convert to Base64 to persist across reloads
    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreview(base64String);
        data.imageUrl = base64String;
        setIsUploading(false);
        toast.success("Image uploaded!");
    };
    reader.onerror = () => {
        toast.error("Failed to read file");
        setIsUploading(false);
    };
    reader.readAsDataURL(file); 
  };

  // Sync data.imageUrl to preview state whenever imageUrl in data changes
  React.useEffect(() => {
    // Always sync from data.imageUrl to preview state
    if (data?.imageUrl) {
      setPreview(data.imageUrl);
    }
  }, [data?.imageUrl]);

  const clearImage = () => {
    setPreview(null);
    data.imageUrl = "";
  };

  return (
    <div 
      className={`
        relative flex flex-col gap-3 p-4 rounded-[20px] border min-w-[300px] shadow-xl
        transition-all duration-200 group
        ${selected 
            ? 'bg-[#202024] border-[#27272a]' 
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
            {preview ? (
                <>
                    <div className="flex items-center justify-center p-3">
                        <img src={preview} alt="Preview" className="max-w-xs max-h-64 object-contain rounded-lg" />
                    </div>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/upload:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button onClick={clearImage} className="p-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/40 transition-colors">
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
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20 rounded-xl">
                    <Loader2 className="animate-spin text-purple-500" />
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
}