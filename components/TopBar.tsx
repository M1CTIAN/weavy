import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Loader2, 
  Save, 
  X, 
  Play, 
  PlayCircle 
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import useFlowStore from '@/store/flowStore';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { WorkflowToolbar } from '@/components/WorkflowToolbar'; 
import 'reactflow/dist/style.css';
import { useWorkflowExecutor } from '@/hooks/useWorkflowExecutor';

interface TopBarProps {
    workflowId?: string;
    workflowName: string;
    setWorkflowName: (n: string) => void;
    isSidebarCollapsed: boolean;
    isLoading?: boolean;
    hasUnsavedChanges?: boolean;
    onSave?: () => Promise<boolean>;
    isSaving?: boolean;
}

export const TopBar = ({ 
    workflowId, 
    workflowName, 
    setWorkflowName, 
    isSidebarCollapsed,
    isLoading = false,
    hasUnsavedChanges = false,
    onSave,
    isSaving = false
}: TopBarProps) => {
  const router = useRouter();
  const nodes = useFlowStore((state) => state.nodes);
  const edges = useFlowStore((state) => state.edges);
  const utils = trpc.useContext();
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const { executeSelection } = useWorkflowExecutor();

  const handleSaveClick = async () => {
    if (!onSave) return;
    const success = await onSave();
    if (success) {
      toast.success("Workflow saved!");
    } else {
      toast.error("Failed to save workflow");
    }
  };

  const handleGoBack = async () => {
      if (hasUnsavedChanges) {
        setPendingAction(() => () => router.push('/workflows'));
        setShowUnsavedModal(true);
        return;
      }

      if (isLoading) {
          router.push('/workflows');
          return;
      }

      router.push('/workflows');
  };

  const handleConfirmSaveAndExit = async () => {
    if (onSave) {
      const success = await onSave();
      if (success) {
        toast.success("Workflow saved!");
        pendingAction?.();
      } else {
        toast.error("Failed to save workflow");
      }
    }
    setShowUnsavedModal(false);
    setPendingAction(null);
  };

  const handleDiscardChanges = () => {
    setShowUnsavedModal(false);
    pendingAction?.();
    setPendingAction(null);
  };

  return (
    <>
      {/* 1. Main Container: Fixed height, absolute position. 
         2. Padding Right (pr-16): Ensures buttons NEVER overlap the History sidebar toggle.
      */}
      <div className="h-16 absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-40 pointer-events-none pr-16">
          
          {/* Left Side: Back & Name (Shrinks if needed) */}
          <div className={`flex items-center gap-4 pointer-events-auto transition-opacity duration-300 shrink-0 ${isSidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleGoBack}
                  disabled={isLoading}
                  className="h-10 w-10 text-slate-400 hover:text-white hover:bg-[#1E1E21] rounded-xl shrink-0"
              >
                  <ArrowLeft size={20} />
              </Button>
              
              <div className="flex flex-col relative">
                  <input 
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      disabled={isLoading} 
                      className={`bg-[#1E1E21] text-white text-sm font-medium px-3 py-1.5 rounded-md border border-[#2A2A2E] focus:border-purple-500 outline-none transition-all w-32 md:w-64 placeholder:text-slate-600 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="Workflow Name"
                  />
                  {isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 size={14} className="animate-spin text-slate-500" />
                      </div>
                  )}
              </div>
          </div>

          {/* Right Side: Scrollable Container 
             1. min-w-0, flex-1: Allows this section to shrink properly.
             2. justify-end: Aligns content to the right.
          */}
          <div className="flex items-center justify-end flex-1 min-w-0 ml-4 pointer-events-auto">
              
              {/* Scrollable Wrapper 
                 1. overflow-x-auto: Enables horizontal scrolling.
                 2. no-scrollbar: Hides the ugly scrollbar (requires generic CSS or Tailwind plugin).
                 3. whitespace-nowrap: Keeps buttons in a single line.
              */}
              <div className="flex items-center gap-2 md:gap-3 overflow-x-auto no-scrollbar py-2 px-1 max-w-full">
                  
                  {/* Execution Controls */}
                  <div className="flex items-center gap-2 mr-2 shrink-0">
                      <Button 
                          variant="ghost"
                          onClick={() => executeSelection(true)}
                          className="h-9 px-3 gap-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46] whitespace-nowrap"
                          title="Run only selected nodes"
                      >
                        <PlayCircle size={16} className="text-blue-400" />
                        <span className="hidden sm:inline">Run Selected</span>
                      </Button>

                      <Button 
                          onClick={() => executeSelection(false)}
                          className="h-9 px-3 gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] border-none whitespace-nowrap shrink-0"
                      >
                        <Play size={16} fill="currentColor" />
                        <span className="hidden sm:inline">Run Workflow</span>
                        <span className="inline sm:hidden">Run</span>
                      </Button>
                  </div>

                  <div className="w-px h-6 bg-[#27272a] shrink-0" />

                  {hasUnsavedChanges && (
                      <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20 shrink-0">
                          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                          <span className="hidden md:inline text-xs font-medium text-orange-400 whitespace-nowrap">Unsaved</span>
                      </div>
                  )}
                  
                  <Button 
                      onClick={handleSaveClick}
                      disabled={isLoading || !hasUnsavedChanges || isSaving}
                      className={`h-9 px-3 gap-2 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
                          hasUnsavedChanges 
                              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                              : 'bg-[#27272a] text-slate-400 cursor-not-allowed'
                      }`}
                  >
                      {isSaving ? (
                          <>
                              <Loader2 size={14} className="animate-spin" />
                              Saving...
                          </>
                      ) : (
                          <>
                              <Save size={14} />
                              Save
                          </>
                      )}
                  </Button>
                  
                  <div className="shrink-0">
                    <WorkflowToolbar />
                  </div>
              </div>
          </div>
      </div>

      {/* Unsaved Changes Modal (Unchanged) */}
      {showUnsavedModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pointer-events-auto">
              <div className="bg-[#1E1E21] border border-[#2A2A2E] rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
                  <div className="flex items-start justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white">Unsaved Changes</h2>
                      <button 
                          onClick={() => {
                              setShowUnsavedModal(false);
                              setPendingAction(null);
                          }}
                          className="text-slate-400 hover:text-white transition-colors"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-6">
                      You have unsaved changes. Would you like to save before leaving?
                  </p>
                  
                  <div className="flex gap-3">
                      <Button
                          onClick={handleDiscardChanges}
                          variant="outline"
                          className="flex-1 bg-transparent border-[#2A2A2E] text-slate-300 hover:bg-[#27272a] hover:text-white h-9 text-sm"
                      >
                          Discard
                      </Button>
                      <Button
                          onClick={handleConfirmSaveAndExit}
                          disabled={isSaving}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white h-9 text-sm font-semibold"
                      >
                          {isSaving ? (
                              <>
                                  <Loader2 size={14} className="animate-spin mr-2" />
                                  Saving...
                              </>
                          ) : (
                              'Save & Exit'
                          )}
                      </Button>
                  </div>
              </div>
          </div>
      )}
    </>
  );
};