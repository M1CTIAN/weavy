import { trpc } from '@/utils/trpc';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export function useExecutionLog() {
  const utils = trpc.useContext();
  const params = useParams();

  // ✅ AUTOMATICALLY GET ID FROM URL
  // Handles cases where params might be undefined or arrays
  const rawId = params?.workflowId;
  const workflowId = Array.isArray(rawId) ? rawId[0] : rawId;

  const startRun = trpc.history.startRun.useMutation();
  const startNode = trpc.history.logNodeStart.useMutation();
  const finishNode = trpc.history.logNodeFinish.useMutation();
  const completeRun = trpc.history.completeRun.useMutation();

  // 1. Single Node Execution (For individual Node "Run" buttons)
  const logExecution = async (
    nodeId: string,
    nodeType: string,
    inputs: any,
    fn: () => Promise<any>
  ) => {
    if (!workflowId) {
        toast.error("Workflow ID missing. Cannot run.");
        throw new Error("Workflow ID missing");
    }

    // Start the run linked to this workflow
    const run = await startRun.mutateAsync({ 
        scope: 'SINGLE',
        workflowId 
    });

    const execution = await startNode.mutateAsync({
      runId: run.id,
      nodeId,
      nodeType,
      inputs,
    });

    try {
      const result = await fn();
      const duration = Date.now() - new Date(run.createdAt).getTime(); 
      
      await finishNode.mutateAsync({
        executionId: execution.id,
        status: 'SUCCESS',
        outputs: typeof result === 'string' ? result : JSON.stringify(result),
        duration,
      });
      await completeRun.mutateAsync({ runId: run.id, status: 'SUCCESS' });
      
      utils.history.getRuns.invalidate({ workflowId });
      return result;

    } catch (err: any) {
      await finishNode.mutateAsync({
        executionId: execution.id,
        status: 'FAILED',
        error: err.message,
        duration: 0,
      });
      await completeRun.mutateAsync({ runId: run.id, status: 'FAILED' });
      
      utils.history.getRuns.invalidate({ workflowId });
      throw err;
    }
  };

  // 2. Batch Helpers (For the Main Toolbar "Run Workflow" button)
  const createRun = async (scope: 'FULL' | 'PARTIAL') => {
    if (!workflowId) throw new Error("Workflow ID missing");
    return await startRun.mutateAsync({ 
        scope,
        workflowId
    });
  };

  const finalizeRun = async (runId: string, status: 'SUCCESS' | 'FAILED') => {
    await completeRun.mutateAsync({ runId, status });
    if (workflowId) {
        utils.history.getRuns.invalidate({ workflowId });
    }
  };

  const logNodeStep = async (
    runId: string, 
    nodeId: string, 
    nodeType: string, 
    inputs: any,
    fn: () => Promise<any>
  ) => {
    const startTime = Date.now();
    const execution = await startNode.mutateAsync({
        runId, nodeId, nodeType, inputs
    });

    try {
        const result = await fn();
        await finishNode.mutateAsync({
            executionId: execution.id,
            status: 'SUCCESS',
            outputs: typeof result === 'string' ? result : JSON.stringify(result),
            duration: Date.now() - startTime
        });
        return result;
    } catch (err: any) {
        await finishNode.mutateAsync({
            executionId: execution.id,
            status: 'FAILED',
            error: err.message,
            duration: Date.now() - startTime
        });
        throw err; 
    }
  };

  return { logExecution, createRun, finalizeRun, logNodeStep };
}