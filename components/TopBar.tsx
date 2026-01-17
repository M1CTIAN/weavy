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

  // ✅ FIX: Pass workflowId to the executor hook
  // We default to empty string if undefined, but typically workflowId is present in Editor
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
      <div className="h-16 absolute top-0 left-0 right-0 flex items-center justify-between px-6 z-40 pointer-events-none">
          
          {/* Left Side: Back & Name */}
          <div className={`flex items-center gap-4 pointer-events-auto transition-opacity duration-300 ${isSidebarCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
              <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleGoBack}
                  disabled={isLoading}
                  className="h-10 w-10 text-slate-400 hover:text-white hover:bg-[#1E1E21] rounded-xl"
              >
                  <ArrowLeft size={20} />
              </Button>
              
              <div className="flex flex-col relative">
                  <input 
                      value={workflowName}
                      onChange={(e) => setWorkflowName(e.target.value)}
                      disabled={isLoading} 
                      className={`bg-[#1E1E21] text-white text-sm font-medium px-3 py-1.5 rounded-md border border-[#2A2A2E] focus:border-purple-500 outline-none transition-all w-64 placeholder:text-slate-600 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      placeholder="Workflow Name"
                  />
                  {isLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 size={14} className="animate-spin text-slate-500" />
                      </div>
                  )}
              </div>
          </div>

          {/* Right Side: Actions */}
          <div className="flex items-center gap-3 pointer-events-auto">
              
              {/* Execution Controls */}
              <div className="flex items-center gap-2 mr-2">
                  <Button 
                      variant="ghost"
                      onClick={() => executeSelection(true)} // true = Partial Run
                      className="h-9 px-3 gap-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-[#27272a] border border-transparent hover:border-[#3f3f46]"
                      title="Run only selected nodes"
                  >
                    <PlayCircle size={16} className="text-blue-400" />
                    Run Selected
                  </Button>

                  <Button 
                      onClick={() => executeSelection(false)} // false = Full Run
                      className="h-9 px-3 gap-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] border-none"
                  >
                    <Play size={16} fill="currentColor" />
                    Run Workflow
                  </Button>
              </div>

              {/* Divider */}
              <div className="w-px h-6 bg-[#27272a]" />

              {/* Unsaved Badge */}
              {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                      <span className="text-xs font-medium text-orange-400">Unsaved</span>
                  </div>
              )}
              
              {/* Save Button */}
              <Button 
                  onClick={handleSaveClick}
                  disabled={isLoading || !hasUnsavedChanges || isSaving}
                  className={`h-9 px-3 gap-2 text-xs font-semibold rounded-lg transition-all ${
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
              <WorkflowToolbar />
          </div>
      </div>

      {/* Unsaved Changes Modal */}
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