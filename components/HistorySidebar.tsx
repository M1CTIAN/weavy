"use client";

import React, { useState } from 'react';
import { trpc } from '@/utils/trpc';
import { 
  History, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Clock, 
  TerminalSquare,
  Trash2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface NodeExecution {
  id: string;
  status: string;
  nodeType: string;
  nodeLabel?: string;
  duration: number | null;
  outputs: string | null;
  error: string | null;
}

interface WorkflowRun {
  id: string;
  status: string;
  scope: string;
  createdAt: string | Date;
  nodes: NodeExecution[];
}

// ✅ NEW PROP INTERFACE
interface HistorySidebarProps {
    workflowId: string;
}

export function HistorySidebar({ workflowId }: HistorySidebarProps) {
  const utils = trpc.useContext();
  
  // ✅ Pass workflowId to Query
  const { data: runs, isLoading } = trpc.history.getRuns.useQuery(
    { workflowId }, 
    { refetchOnWindowFocus: true }
  );

  const clearHistoryMutation = trpc.history.clearRuns.useMutation();

  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleRun = (id: string) => {
    if (isCollapsed) return; 
    setExpandedRunId(expandedRunId === id ? null : id);
  };

  const handleClearHistory = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete history for this workflow?")) {
        return;
    }

    try {
        // ✅ Pass workflowId to Mutation
        await clearHistoryMutation.mutateAsync({ workflowId });
        
        // Invalidate specific query
        utils.history.getRuns.invalidate({ workflowId });
        toast.success("Workflow history cleared");
    } catch (error) {
        toast.error("Failed to clear history");
        console.error(error);
    }
  };

  const widthClass = isCollapsed ? 'w-[60px]' : 'w-[320px]';

  if (isLoading) return (
    <div className={`${widthClass} h-full border-l border-[#27272a] bg-[#18181b] flex flex-col items-center justify-center shrink-0 transition-all duration-300`}>
       <div className="text-slate-500 text-xs animate-pulse flex items-center gap-2">
         {isCollapsed ? <Clock size={16} /> : <><Clock size={12} /> Loading...</>}
       </div>
    </div>
  );

  return (
    <div className={`${widthClass} h-full border-l border-[#27272a] bg-[#18181b] flex flex-col font-sans shrink-0 transition-all duration-300 relative group/sidebar`}>
      
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-4 z-50 bg-[#27272a] border border-[#3f3f46] text-slate-400 hover:text-white rounded-full p-1 shadow-md hover:bg-blue-600 hover:border-blue-600 transition-colors"
        title={isCollapsed ? "Expand History" : "Collapse History"}
      >
        {isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Header */}
      <div className={`
        h-14 border-b border-[#27272a] flex items-center bg-[#18181b] z-10 transition-all overflow-hidden
        ${isCollapsed ? 'justify-center px-0' : 'justify-between px-4'}
      `}>
        <div className="flex items-center gap-2">
            <History size={18} className="text-slate-400 shrink-0" />
            <span className={`font-semibold text-slate-200 text-sm whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
              Run History
            </span>
        </div>
        
        {!isCollapsed && (
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 bg-[#27272a] px-2 py-0.5 rounded-full border border-[#3f3f46] whitespace-nowrap">
                    {runs?.length || 0} Runs
                </span>
                
                <button 
                    onClick={handleClearHistory}
                    disabled={!runs || runs.length === 0 || clearHistoryMutation.isPending}
                    className="text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors p-1"
                    title="Clear Workflow History"
                >
                    {clearHistoryMutation.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : (
                        <Trash2 size={14} />
                    )}
                </button>
            </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a] scrollbar-track-transparent">
        {(!runs || runs.length === 0) && (
            <div className={`p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2 ${isCollapsed ? 'px-2' : ''}`}>
              <TerminalSquare size={24} className="opacity-20" />
              {!isCollapsed && <span>No runs for this workflow.</span>}
            </div>
        )}

        {(runs as WorkflowRun[])?.map((run) => (
          <div key={run.id} className="border-b border-[#27272a] transition-colors">
            
            <div 
              onClick={() => toggleRun(run.id)}
              className={`
                cursor-pointer group hover:bg-[#27272a]/40 transition-all
                ${expandedRunId === run.id ? 'bg-[#27272a]/30' : ''}
                ${isCollapsed ? 'p-3 flex justify-center' : 'p-3'}
              `}
              title={isCollapsed ? `Status: ${run.status}` : undefined}
            >
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-1">
                    {run.status === 'SUCCESS' ? (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : run.status === 'FAILED' ? (
                        <XCircle size={16} className="text-red-500" />
                    ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                    )}
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {run.status === 'SUCCESS' ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : run.status === 'FAILED' ? (
                        <XCircle size={15} className="text-red-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
                      )}
                      
                      <span className={`
                        text-[10px] font-medium px-1.5 py-0.5 rounded border
                        ${run.scope === 'SINGLE' 
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                          : run.scope === 'PARTIAL'
                          ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}
                      `}>
                        {run.scope === 'SINGLE' ? 'Single' : run.scope === 'PARTIAL' ? 'Partial' : 'Full'}
                      </span>
                    </div>
                    
                    <div className="text-slate-600 group-hover:text-slate-400 transition-colors">
                        {expandedRunId === run.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pl-6">
                    <span className="font-mono tracking-tight truncate">
                      {format(new Date(run.createdAt), 'MMM d, h:mm a')}
                    </span>
                    <span className="opacity-40 font-mono">#{run.id.slice(-4)}</span>
                  </div>
                </>
              )}
            </div>

            {!isCollapsed && expandedRunId === run.id && (
              <div className="bg-[#09090b] py-3 pr-3 pl-2 text-xs border-t border-[#27272a] shadow-inner">
                <div className="flex flex-col gap-4"> 
                  {run.nodes.map((node, i) => (
                    <div key={node.id || i} className="group relative pl-4">
                      {/* Vertical line */}
                      {i !== run.nodes.length - 1 && (
                        <div className="absolute left-[5px] top-3 bottom-[-16px] w-px bg-[#27272a]" />
                      )}

                      <div className="flex items-center gap-2 mb-1.5 relative">
                          <div className="absolute -left-2 top-1/2 w-2 h-px bg-[#27272a]" />
                          <div className={`
                            z-10 w-2.5 h-2.5 rounded-full border-2 border-[#09090b] shrink-0
                            ${node.status === 'SUCCESS' ? 'bg-emerald-500' : node.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'}
                          `} />

                          <span className="text-slate-300 font-medium truncate max-w-[120px]" title={node.nodeType}>
                             {node.nodeType} 
                          </span>
                          
                          {node.duration && (
                            <div className="flex items-center gap-1 ml-auto bg-[#18181b] px-1.5 py-0.5 rounded border border-[#27272a]">
                              <span className="text-[10px] text-slate-400 font-mono">{(node.duration / 1000).toFixed(1)}s</span>
                            </div>
                          )}
                      </div>

                      <div className="pl-6 border-l border-[#27272a] ml-[5px] pb-1 space-y-2">
                        {node.outputs && (
                          <div className="relative pl-4 text-[11px]">
                             <div className="absolute left-0 top-2.5 w-3 h-px bg-[#27272a]" />
                             <div className="flex items-start gap-2">
                                <span className="text-slate-500 shrink-0 mt-px">Out:</span>
                                <span className="text-slate-400 break-all font-mono bg-[#18181b] px-1.5 py-0.5 rounded border border-[#27272a]/50 w-full line-clamp-2 hover:line-clamp-none cursor-help">
                                  {node.outputs.startsWith('"') ? node.outputs.slice(1, -1) : node.outputs}
                                </span>
                             </div>
                          </div>
                        )}
                        {node.error && (
                          <div className="relative pl-4 text-[11px]">
                             <div className="absolute left-0 top-2.5 w-3 h-px bg-red-900/50" />
                             <div className="flex items-start gap-2">
                                <span className="text-red-400 shrink-0 mt-px font-bold">Err:</span>
                                <span className="text-red-300 break-words bg-red-950/20 px-1.5 py-0.5 rounded border border-red-900/30 w-full">
                                  {node.error}
                                </span>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}