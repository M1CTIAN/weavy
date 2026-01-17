import { router, publicProcedure } from '../trpc';
import { z } from 'zod';
import { prisma } from '../../lib/prisma'; // ✅ Correct path to your existing file

export const historyRouter = router({
  // 1. Get All Runs (Filtered by Workflow ID)
  getRuns: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(async ({ input }) => {
      return await prisma.workflowRun.findMany({
        where: {
          workflowId: input.workflowId
        },
        orderBy: { createdAt: 'desc' },
        include: { nodes: true }
      });
    }),

  // 2. Start Run (Creates the WorkflowRun entry)
  startRun: publicProcedure
    .input(z.object({
      scope: z.enum(['FULL', 'SINGLE', 'PARTIAL']),
      workflowId: z.string(), // 👈 Added workflowId so the run is linked
    }))
    .mutation(async ({ input }) => {
      return await prisma.workflowRun.create({
        data: {
          scope: input.scope,
          status: 'PENDING',
          workflowId: input.workflowId, // 👈 Store the link
        },
      });
    }),

  // 3. Log Node Start (Creates a pending NodeExecution)
  logNodeStart: publicProcedure
    .input(z.object({
      runId: z.string(),
      nodeId: z.string(),
      nodeType: z.string(),
      nodeLabel: z.string().optional(),
      inputs: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      return await prisma.nodeExecution.create({
        data: {
          runId: input.runId, // Matches schema 'runId'
          nodeId: input.nodeId,
          nodeType: input.nodeType,
          nodeLabel: input.nodeLabel || input.nodeType,
          status: 'PENDING',
          inputs: input.inputs ? JSON.stringify(input.inputs) : null,
        },
      });
    }),

  // 4. Log Node Finish (Updates NodeExecution with results)
  logNodeFinish: publicProcedure
    .input(z.object({
      executionId: z.string(),
      status: z.enum(['SUCCESS', 'FAILED']),
      outputs: z.any().optional(),
      error: z.string().optional(),
      duration: z.number(),
    }))
    .mutation(async ({ input }) => {
      return await prisma.nodeExecution.update({
        where: { id: input.executionId },
        data: {
          status: input.status,
          endTime: new Date(),
          duration: input.duration,
          outputs: input.outputs ? JSON.stringify(input.outputs) : null,
          error: input.error,
        },
      });
    }),

  // 5. Complete Run (Finalizes the WorkflowRun status)
  completeRun: publicProcedure
    .input(z.object({
      runId: z.string(),
      status: z.enum(['SUCCESS', 'FAILED']),
    }))
    .mutation(async ({ input }) => {
      return await prisma.workflowRun.update({
        where: { id: input.runId },
        data: { status: input.status },
      });
    }),
    
  // 6. Clear Runs (Deletes history for a specific workflow)
  clearRuns: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      const runsToDelete = await prisma.workflowRun.findMany({
        where: { workflowId: input.workflowId },
        select: { id: true }
      });

      const ids = runsToDelete.map(r => r.id);

      if (ids.length > 0) {
        // ✅ Delete NodeExecutions first (using runId)
        await prisma.nodeExecution.deleteMany({
          where: { runId: { in: ids } }
        });

        // ✅ Delete WorkflowRuns
        await prisma.workflowRun.deleteMany({
          where: { id: { in: ids } }
        });
      }

      return { success: true };
    }),
});