"use client";

import React, { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  FileJson,
  ArrowRightFromLine,
  ArrowLeftToLine,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

// --- Interfaces ---

interface NodeExecution {
  id: string;
  status: string;
  nodeType: string;
  nodeLabel?: string;
  duration: number | null;
  inputs?: string | null;
  outputs: string | null;
  error: string | null;
  // ✅ ADDED: Essential for sorting the timeline correctly
  startTime: string | Date; 
}

interface WorkflowRun {
  id: string;
  status: string;
  scope: string;
  createdAt: string | Date;
  nodes: NodeExecution[];
}

interface HistorySidebarProps {
    workflowId: string;
}

// --- Helper: Data Viewer (JSON Pretty Print) ---
const DataViewer = ({ label, data, type }: { label: string, data: string | null | undefined, type: 'in' | 'out' | 'err' }) => {
    if (!data) return null;

    let content = data;
    let isJson = false;

    try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'object' && parsed !== null) {
            content = JSON.stringify(parsed, null, 2);
            isJson = true;
        } else if (typeof parsed === 'string') {
             try {
                const inner = JSON.parse(parsed);
                content = JSON.stringify(inner, null, 2);
                isJson = true;
             } catch {
                content = parsed;
             }
        }
    } catch (e) {
        // Keep original text
    }

    const styles = {
        in:  { text: 'text-blue-400', bg: 'bg-blue-950/10', border: 'border-blue-900/20', icon: ArrowRightFromLine },
        out: { text: 'text-emerald-400', bg: 'bg-[#121214]', border: 'border-[#27272a]', icon: ArrowLeftToLine },
        err: { text: 'text-red-400', bg: 'bg-red-950/20', border: 'border-red-900/30', icon: XCircle }
    };

    const style = styles[type];
    const Icon = style.icon;

    return (
        <div className="mt-2 text-[10px] w-full min-w-0 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className={`flex items-center gap-1.5 mb-1 ${style.text} font-medium opacity-80`}>
                <Icon size={10} />
                {label}
            </div>
            <div className={`relative group rounded border ${style.border} ${style.bg} overflow-hidden`}>
                <pre className={`
                    p-2 font-mono text-[10px] leading-relaxed text-slate-300 
                    scrollbar-thin scrollbar-thumb-[#3f3f46] scrollbar-track-transparent
                    overflow-x-auto whitespace-pre-wrap break-all max-h-[300px]
                `}>
                    {content}
                </pre>
                {isJson && (
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-50 pointer-events-none transition-opacity">
                        <FileJson size={10} className="text-slate-500" />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Helper: Node Step Item ---
const NodeStepItem = ({ node, isLast }: { node: NodeExecution, isLast: boolean }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Auto-expand if failed
    useEffect(() => {
        if (node.status === 'FAILED') setIsExpanded(true);
    }, [node.status]);

    return (
        <div className="group relative pl-4">
            {/* Vertical Connector Line */}
            {!isLast && (
                <div className="absolute left-[5px] top-3 bottom-[-16px] w-px bg-[#27272a] group-hover:bg-[#3f3f46] transition-colors" />
            )}

            <div className="flex flex-col mb-2 relative">
                 {/* Horizontal Connector + Dot */}
                <div className="absolute -left-2 top-2 w-2 h-px bg-[#27272a]" />
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`
                        absolute -left-[9px] top-1 z-10 w-2.5 h-2.5 rounded-full border-2 border-[#09090b] shrink-0 cursor-pointer transition-transform hover:scale-110
                        ${node.status === 'SUCCESS' ? 'bg-emerald-500' : node.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500'}
                    `} 
                />

                {/* Node Header Row */}
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between gap-2 cursor-pointer py-1 rounded hover:bg-[#27272a]/50 -ml-1 pl-1 pr-2 transition-colors select-none"
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <span className={`text-[11px] font-medium truncate ${node.status === 'FAILED' ? 'text-red-300' : 'text-slate-300'}`}>
                           {node.nodeType}
                        </span>
                        {node.nodeLabel && (
                             <span className="text-[10px] text-slate-500 truncate">- {node.nodeLabel}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {node.duration && (
                            <span className="text-[9px] text-slate-500 font-mono bg-[#18181b] px-1 rounded border border-[#27272a]">
                                {(node.duration / 1000).toFixed(1)}s
                            </span>
                        )}
                        <ChevronRight size={10} className={`text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                </div>

                {/* Details Panel */}
                {isExpanded && (
                    <div className="pl-1 mt-0.5 pr-2 pb-2 space-y-1">
                        <DataViewer label="Input" data={node.inputs} type="in" />
                        <DataViewer label="Output" data={node.outputs} type="out" />
                        <DataViewer label="Error" data={node.error} type="err" />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Helper: Timeline Component (Handles Sorting) ---
const RunTimeline = ({ nodes }: { nodes: NodeExecution[] }) => {
    // ✅ CRITICAL: Sort nodes by startTime to ensure visual order matches execution order
    const sortedNodes = useMemo(() => {
        if (!nodes) return [];
        return [...nodes].sort((a, b) => {
            const dateA = new Date(a.startTime).getTime();
            const dateB = new Date(b.startTime).getTime();
            return dateA - dateB;
        });
    }, [nodes]);

    if (!sortedNodes || sortedNodes.length === 0) {
        return (
            <div className="flex items-center gap-2 px-6 py-2 text-xs text-slate-500 italic opacity-60">
                <AlertCircle size={12} />
                <span>No step details recorded.</span>
            </div>
        );
    }

    return (
        <>
            {/* Timeline Line Top Connector */}
            <div className="ml-[21px] mb-2 h-2 w-px bg-[#27272a] -mt-4" />
            
            <div className="flex flex-col gap-0.5"> 
                {sortedNodes.map((node, i) => (
                    <NodeStepItem 
                        key={node.id || i} 
                        node={node} 
                        isLast={i === sortedNodes.length - 1} 
                    />
                ))}
            </div>
        </>
    );
};

// --- Main Component ---
export function HistorySidebar({ workflowId }: HistorySidebarProps) {
  const utils = trpc.useContext();
  
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
    if (!confirm("Are you sure you want to delete all history?")) return;
    try {
        await clearHistoryMutation.mutateAsync({ workflowId });
        utils.history.getRuns.invalidate({ workflowId });
        toast.success("History cleared");
    } catch (error) {
        toast.error("Failed to clear history");
    }
  };

  const widthClass = isCollapsed ? 'w-[60px]' : 'w-[340px]';

  if (isLoading) return (
    <div className={`${widthClass} h-full border-l border-[#27272a] bg-[#18181b] flex flex-col items-center justify-center shrink-0`}>
       <div className="text-slate-500 text-xs animate-pulse flex items-center gap-2">
         {isCollapsed ? <Clock size={16} /> : <><Clock size={12} /> Loading...</>}
       </div>
    </div>
  );

  return (
    <div className={`${widthClass} h-full border-l border-[#27272a] bg-[#18181b] flex flex-col font-sans shrink-0 transition-all duration-300 relative group/sidebar`}>
      
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -left-3 top-4 z-50 bg-[#27272a] border border-[#3f3f46] text-slate-400 hover:text-white rounded-full p-1 shadow-md hover:bg-blue-600 hover:border-blue-600 transition-colors"
      >
        {isCollapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Header */}
      <div className={`h-14 border-b border-[#27272a] flex items-center bg-[#18181b] z-10 ${isCollapsed ? 'justify-center' : 'justify-between px-4'}`}>
        <div className="flex items-center gap-2">
            <History size={18} className="text-slate-400 shrink-0" />
            <span className={`font-semibold text-slate-200 text-sm whitespace-nowrap transition-opacity duration-200 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
              Run History
            </span>
        </div>
        
        {!isCollapsed && (
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-500 bg-[#27272a] px-2 py-0.5 rounded-full border border-[#3f3f46]">
                    {runs?.length || 0} Runs
                </span>
                <button 
                    onClick={handleClearHistory}
                    disabled={!runs?.length || clearHistoryMutation.isPending}
                    className="text-slate-500 hover:text-red-400 disabled:opacity-30 p-1 hover:bg-[#27272a] rounded transition-colors"
                    title="Clear All History"
                >
                    {clearHistoryMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
            </div>
        )}
      </div>

      {/* Runs List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-[#27272a]">
        {(!runs || runs.length === 0) && (
            <div className={`p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2`}>
              <TerminalSquare size={24} className="opacity-20" />
              {!isCollapsed && <span>No runs recorded yet.</span>}
            </div>
        )}

        {(runs as WorkflowRun[])?.map((run) => (
          <div key={run.id} className="border-b border-[#27272a]">
            {/* Run Row Header */}
            <div 
              onClick={() => toggleRun(run.id)}
              className={`
                cursor-pointer group hover:bg-[#27272a]/40 transition-all select-none
                ${expandedRunId === run.id ? 'bg-[#27272a]/30' : ''}
                ${isCollapsed ? 'p-3 flex justify-center' : 'p-3'}
              `}
            >
              {isCollapsed ? (
                // Collapsed State Icon
                <div className={`
                    w-2 h-2 rounded-full 
                    ${run.status === 'SUCCESS' ? 'bg-emerald-500' : run.status === 'FAILED' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}
                `} />
              ) : (
                // Expanded State Row
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {run.status === 'SUCCESS' ? (
                        <CheckCircle2 size={15} className="text-emerald-500" />
                      ) : run.status === 'FAILED' ? (
                        <XCircle size={15} className="text-red-500" />
                      ) : (
                        <Loader2 size={15} className="text-yellow-500 animate-spin" />
                      )}
                      
                      <span className={`
                        text-[10px] font-medium px-1.5 py-0.5 rounded border
                        ${run.scope === 'SINGLE' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          run.scope === 'PARTIAL' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}
                      `}>
                        {run.scope}
                      </span>
                    </div>
                    
                    <div className="text-slate-600 group-hover:text-slate-400 transition-colors">
                        {expandedRunId === run.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pl-6">
                    <span className="font-mono">{format(new Date(run.createdAt), 'MMM d, h:mm a')}</span>
                    <span className="opacity-30 font-mono">#{run.id.slice(-4)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Run Details Panel */}
            {!isCollapsed && expandedRunId === run.id && (
              <div className="bg-[#09090b] py-4 pr-2 pl-2 border-t border-[#27272a] shadow-inner min-h-[50px]">
                 {/* ✅ Use new Timeline Component with Sorting */}
                 <RunTimeline nodes={run.nodes} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}