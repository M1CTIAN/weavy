import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { UploadCloud, Video, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/utils/trpc';

import Uppy from '@uppy/core';
import Transloadit from '@uppy/transloadit';

// --- Type Definitions for Transloadit ---
interface TransloaditResult {
  ssl_url: string;
}

interface TransloaditAssembly {
  results: Record<string, TransloaditResult[]>;
  uploads?: TransloaditResult[];
}

export function VideoNode({ id, data, selected }: NodeProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setNodes } = useReactFlow();
  const getSignatureMutation = trpc.media.getUploadSignature.useMutation();

  // ✅ FIX: Derive state directly from data (No useState for hasFile)
  // This ensures that if 'videoUrl' loads from the DB, the player shows up.
  const videoSrc = data.previewUrl || data.videoUrl;
  const hasFile = !!videoSrc;

  const uploadToTransloadit = async (file: File): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        const { signature, params } = await getSignatureMutation.mutateAsync({
          type: 'video'
        });

        const uppy = new Uppy({ autoProceed: false })
          .use(Transloadit, {
            assemblyOptions: {
              signature: signature,
              params: params,
            },
            waitForEncoding: true,
          });

        uppy.addFile({
          name: file.name,
          type: file.type,
          data: file,
        });

        const result = await uppy.upload();

        if (!result) {
          reject(new Error("Upload result is undefined"));
          return;
        }

        if (result.failed && result.failed.length > 0) {
          console.error("Transloadit errors:", result.failed);
          reject(new Error("Transloadit upload failed"));
        } else {
          // 1. Get the Assembly
          const assemblies = (result as any).transloadit as any[];
          if (!assemblies || assemblies.length === 0) {
            reject(new Error("No assembly result"));
            return;
          }

          const assembly = assemblies[0];
          let foundUrl = "";

          // 2. STRATEGY A: Check 'results' (Processed items)
          if (assembly.results) {
            for (const stepKey in assembly.results) {
              const items = assembly.results[stepKey];
              if (items && items.length > 0 && items[0].ssl_url) {
                foundUrl = items[0].ssl_url;
                break;
              }
            }
          }

          // 3. STRATEGY B: Check 'uploads' (Raw items fallback)
          if (!foundUrl && assembly.uploads && assembly.uploads.length > 0) {
            if (assembly.uploads[0].ssl_url) {
              foundUrl = assembly.uploads[0].ssl_url;
            }
          }

          if (foundUrl) {
            resolve(foundUrl);
          } else {
            reject(new Error("Could not find any 'ssl_url' in results or uploads."));
          }
        }
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploading(true);

    // Create immediate local preview
    const localUrl = URL.createObjectURL(file);
    
    // Optimistically update UI
    setNodes((nodes) => nodes.map((node) => {
        if (node.id === id) {
           return {
             ...node,
             data: {
               ...node.data,
               previewUrl: localUrl, 
               label: file.name
             }
           };
        }
        return node;
    }));

    try {
      const publicUrl = await uploadToTransloadit(file);
      
      // ✅ Update with PERSISTENT URL from Transloadit
      setNodes((nodes) => nodes.map((node) => {
        if (node.id === id) {
           return {
             ...node,
             data: {
               ...node.data,
               videoUrl: publicUrl, // This saves to DB
               previewUrl: undefined, // Clear local blob to force using public URL
               label: file.name
             }
           };
        }
        return node;
      }));

      toast.success("Video uploaded and saved!");
    } catch (err: any) {
      console.error("Upload failed", err);
      setError("Upload failed");
      toast.error(`Upload failed: ${err.message}`);
      
      // Revert on failure
      setNodes((nodes) => nodes.map((node) => {
        if (node.id === id) {
           return {
             ...node,
             data: { ...node.data, videoUrl: undefined, previewUrl: undefined }
           };
        }
        return node;
      }));
    } finally {
      setIsUploading(false);
    }
  }, [getSignatureMutation, setNodes, id]);

  const handleRemoveVideo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);

    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        return {
          ...node,
          data: { ...node.data, videoUrl: undefined, label: undefined, previewUrl: undefined }
        };
      }
      return node;
    }));
  };

  return (
    <div className={`
      relative flex flex-col w-70 bg-[#18181b] rounded-2xl border transition-colors group/node
      ${selected ? 'border-blue-500' : 'border-[#27272a]'}
      ${error ? 'border-red-500/50' : ''}
    `}>

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">Video Input</span>
        </div>
        {isUploading && <Loader2 size={12} className="animate-spin text-slate-500" />}
      </div>

      {/* Body */}
      <div className="p-3">
        {!hasFile ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#27272a] rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-[#27272a]/50 transition-all group">
            <UploadCloud size={24} className="text-slate-500 mb-2 group-hover:text-blue-400 transition-colors" />
            <span className="text-[10px] text-slate-400 font-medium">Click to upload video</span>
            <input type="file" accept=".mp4,.mov,.webm,.m4v" className="hidden" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video group">
            <video
              src={videoSrc}
              className={`w-full h-full object-cover ${isUploading ? 'opacity-50' : 'opacity-100'}`}
              controls
              playsInline
            />

            {/* Status Icons */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {isUploading ? (
                <div className="bg-black/60 backdrop-blur px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
                  <Loader2 size={10} className="animate-spin text-blue-400" />
                  <span className="text-[9px] text-white font-medium">Uploading...</span>
                </div>
              ) : error ? (
                <div className="bg-red-500/20 backdrop-blur p-1 rounded-full border border-red-500/50">
                  <AlertCircle size={12} className="text-red-500" />
                </div>
              ) : (
                <div className="bg-green-500/20 backdrop-blur p-1 rounded-full border border-green-500/50">
                  <CheckCircle2 size={12} className="text-green-500" />
                </div>
              )}
            </div>

            {/* Remove Button */}
            {!isUploading && (
              <button
                onClick={handleRemoveVideo}
                className="absolute top-2 left-2 bg-black/50 hover:bg-red-500/80 text-white p-1 rounded-full backdrop-blur transition-colors opacity-0 group-hover:opacity-100"
                title="Remove Video"
              >
                <X size={12} />
              </button>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-2 pt-4">
              <p className="text-[9px] text-slate-300 truncate text-center font-mono">
                {data.label || "video.mp4"}
              </p>
            </div>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        id="video-input"
        className="w-3.5! h-3.5! bg-blue-500! border-[3px]! border-[#18181b]! transition-all"
      />
    </div>
  );
}