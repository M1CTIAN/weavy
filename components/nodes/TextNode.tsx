import React from 'react';
import { Handle, Position, NodeProps, useStore } from 'reactflow';
import { MoreHorizontal } from 'lucide-react';

// Selector to check if this specific node has any outgoing connections
const connectionSelector = (id: string) => (store: any) => 
  store.edges.some((edge: any) => edge.source === id);

export function TextNode({ id, data, selected }: NodeProps) {
  // Use the reactive store to check connection status
  const isConnected = useStore(connectionSelector(id));

  return (
    <div 
      className={`
        relative flex flex-col gap-3 p-4 rounded-[20px] border min-w-[320px] shadow-xl
        transition-all duration-200 group
        ${selected 
            ? 'bg-[#202024] border-[#27272a]' 
            : 'bg-[#18181b] border-[#27272a] hover:border-slate-600'
        }
      `}
    >
        {/* Header Row */}
        <div className="flex items-center justify-between px-1">
            <span className="text-[13px] font-medium text-slate-300">Prompt</span>
            <button className="text-slate-500 hover:text-white transition-colors">
                <MoreHorizontal size={18} />
            </button>
        </div>

        {/* Text Input Area */}
        <div className="relative">
            <textarea 
                className="w-full h-32 bg-[#27272a] text-slate-100 text-[14px] p-4 rounded-xl border border-transparent focus:border-pink-500/50 outline-none resize-none leading-relaxed font-normal placeholder:text-slate-500 nodrag selection:bg-pink-500/30"
                defaultValue={data.label || ""}
                placeholder="Enter your prompt here..."
                onChange={(evt) => {
                    data.label = evt.target.value; 
                }}
            />
        </div>

        {/* Output Handle */}
        {/* Logic: Pink Border Always. Fill is Pink if connected, Dark if not. */}
        <Handle 
            type="source" 
            position={Position.Right} 
            className={`
                !w-3.5 !h-3.5 !border-[3px] !-right-[9px] transition-all duration-300
                !border-[#ec4899] 
                ${isConnected ? '!bg-[#ec4899]' : '!bg-[#18181b]'} 
            `}
        />
    </div>
  );
}