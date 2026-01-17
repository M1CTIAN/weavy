"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { LayoutGrid, List, Search, Workflow, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WorkflowsSidebar } from '@/components/WorkflowsSidebar';
import { WorkflowContextMenu } from '@/components/WorkflowContextMenu';
import { WorkflowLibrary } from '@/components/WorkflowLibrary';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// --- HELPER: Date Formatter ---
const formatDate = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  } catch (e) {
    return "Unknown date";
  }
};

// ==========================================
// SUB-COMPONENTS
// ==========================================

const GridView = ({ workflows }: { workflows: any[] }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
      {workflows.map((workflow) => (
        <WorkflowContextMenu key={workflow.id} workflow={workflow}>
          <Link href={`/editor/${workflow.id}`} className="group block h-full">
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden hover:border-purple-500/50 transition-all group-hover:shadow-lg group-hover:shadow-purple-900/10 h-full flex flex-col">
              {/* Thumbnail / Icon */}
              <div className="aspect-video bg-[#202024] flex items-center justify-center border-b border-[#27272a] relative">
                <div className="absolute inset-0 bg-linear-to-tr from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Workflow className="text-slate-600 group-hover:text-purple-500 transition-colors relative z-10" size={28} />
              </div>
              
              {/* Details */}
              <div className="p-4 flex-1 flex flex-col justify-end">
                {/* ✅ Database Name */}
                <h3 className="font-medium text-sm text-slate-200 group-hover:text-white truncate">
                    {workflow.name}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1">Last edited {formatDate(workflow.updatedAt)}</p>
              </div>
            </div>
          </Link>
        </WorkflowContextMenu>
      ))}
    </div>
  );
};

const ListView = ({ workflows }: { workflows: any[] }) => {
  return (
    <div className="animate-in fade-in duration-300">
      {/* Header Row */}
      <div className="grid grid-cols-[3fr_1fr_2fr_2fr] gap-4 px-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <div>Name</div>
        <div>Files</div>
        <div>Last modified <span className="text-[10px]">↓</span></div>
        <div>Created at</div>
      </div>
      
      {/* Rows */}
      <div className="flex flex-col gap-3">
        {workflows.map((workflow) => (
          <WorkflowContextMenu key={workflow.id} workflow={workflow}>
            <Link href={`/editor/${workflow.id}`} className="block group">
              <div className="grid grid-cols-[3fr_1fr_2fr_2fr] gap-4 items-center px-4 py-3 bg-[#18181b] border border-[#27272a] rounded-xl hover:border-purple-500/50 transition-all hover:bg-[#1c1c21]">
                {/* Name Column */}
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-[#202024] rounded-lg flex items-center justify-center shrink-0 border border-[#27272a] group-hover:border-purple-500/30 transition-colors">
                    <Workflow className="text-slate-600 group-hover:text-purple-400 transition-colors" size={18} />
                  </div>
                  {/* ✅ Database Name */}
                  <span className="font-medium text-sm text-slate-200 group-hover:text-white truncate">
                    {workflow.name}
                  </span>
                </div>
                
                {/* Other Columns */}
                <div className="text-slate-600 text-sm">-</div>
                <div className="text-slate-400 text-xs truncate font-medium">{formatDate(workflow.updatedAt)}</div>
                <div className="text-slate-500 text-xs truncate">{formatDate(workflow.createdAt)}</div>
              </div>
            </Link>
          </WorkflowContextMenu>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// MAIN PAGE EXPORT
// ==========================================

export default function WorkflowsPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState(""); 
  const router = useRouter();
  const utils = trpc.useContext();
  
  // 1. FETCH FROM DATABASE
  const { data: workflows, isLoading } = trpc.workflow.getAll.useQuery(undefined, {
      refetchOnMount: "always",
      staleTime: 0,
  });

  // 2. FILTER & EXCLUDE ID
  const filteredWorkflows: any[] = (workflows as any[])?.filter((workflow: any) => 
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    workflow.id !== 'ee132f70-312b-452f-a230-28bde4e98b3b' // 🚫 Exclude "Weavy Welcome" ID
  ) || [];

  const createMutation = trpc.workflow.save.useMutation({
    onSuccess: (data: any) => {
        toast.success("Workflow created!");
        utils.workflow.getAll.invalidate(); 
        if (data?.id) router.push(`/editor/${data.id}`);
    },
    onError: (error: any) => toast.error(`Failed to create: ${error.message}`)
  } as any);

  const handleCreate = () => {
    createMutation.mutate({ name: "Untitled Workflow", nodes: [], edges: [] });
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-[#09090b] text-slate-500 text-sm">Loading...</div>;

  const isDatabaseEmpty = !workflows || workflows.length === 0;
  const isSearchResultsEmpty = !isDatabaseEmpty && filteredWorkflows.length === 0;

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 flex">
      <WorkflowsSidebar />

      <div className="flex-1 pl-64">
        <div className="p-10 max-w-400 mx-auto">
            
            {/* Top Section */}
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-sm font-medium text-slate-400">Arpit Raj's Workspace</h2>
                <Button 
                    onClick={handleCreate}
                    disabled={createMutation.isPending}
                    className="bg-[#DFFF5E] hover:bg-[#cfee5e] text-black font-semibold h-9 px-4 text-xs gap-2 rounded-lg"
                >
                    <Plus size={14} />
                    Create New File
                </Button>
            </div>

            {/* Workflow Library */}
            <WorkflowLibrary />

            {/* My Files Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 mt-12">
                <h1 className="text-xl font-semibold text-white">My files</h1>

                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-purple-500 transition-colors" size={14} />
                        <Input 
                            placeholder="Search" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-8 bg-[#18181b] border-[#27272a] text-sm text-slate-200 h-9 w-64 focus-visible:ring-purple-500 focus-visible:border-purple-500 transition-all placeholder:text-slate-600"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-lg p-1">
                        <Button variant="ghost" size="icon" onClick={() => setViewMode('list')} className={cn("h-7 w-7 rounded-md", viewMode === 'list' ? "bg-[#27272a] text-white" : "text-slate-500 hover:text-slate-300")}>
                            <List size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setViewMode('grid')} className={cn("h-7 w-7 rounded-md", viewMode === 'grid' ? "bg-[#27272a] text-white" : "text-slate-500 hover:text-slate-300")}>
                            <LayoutGrid size={16} />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Files List/Grid (Populated from DB) */}
            {isDatabaseEmpty ? (
                <div className="text-center text-slate-500 py-20 border border-dashed border-[#27272a] rounded-xl bg-[#18181b]/50">
                    <p className="text-sm">No workflows found. Create one to get started.</p>
                </div>
            ) : isSearchResultsEmpty ? (
                <div className="text-center text-slate-500 py-20 border border-dashed border-[#27272a] rounded-xl bg-[#18181b]/50">
                    <p className="text-sm">No results found for "{searchQuery}"</p>
                    <Button variant="link" onClick={() => setSearchQuery("")} className="text-purple-400 h-auto p-0 text-xs mt-1">Clear search</Button>
                </div>
            ) : (
                <>
                {viewMode === 'grid' ? <GridView workflows={filteredWorkflows} /> : <ListView workflows={filteredWorkflows} />}
                
                <div className="flex items-center justify-end gap-4 mt-8 text-xs text-slate-500 font-medium">
                    <span>1-{filteredWorkflows.length} of {filteredWorkflows.length}</span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-white disabled:opacity-30" disabled><ChevronLeft size={14} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-white disabled:opacity-30" disabled><ChevronRight size={14} /></Button>
                    </div>
                </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
}