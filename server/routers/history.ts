import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '../../lib/prisma';

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
        // ✅ CRITICAL: Include nodes and sort them by time
        include: { 
            nodes: {
                orderBy: {
                    startTime: 'asc' 
                }
            } 
        }
      });
    }),

  // 2. Start Run
  startRun: publicProcedure
    .input(z.object({
      scope: z.enum(['FULL', 'SINGLE', 'PARTIAL']),
      workflowId: z.string(),
    }))
    .mutation(async ({ input }) => {
      return await prisma.workflowRun.create({
        data: {
          scope: input.scope,
          status: 'PENDING',
          workflowId: input.workflowId,
        },
      });
    }),

  // 3. Log Node Start
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
          runId: input.runId,
          nodeId: input.nodeId,
          nodeType: input.nodeType,
          nodeLabel: input.nodeLabel || input.nodeType,
          status: 'PENDING',
          inputs: input.inputs ? JSON.stringify(input.inputs) : null,
          startTime: new Date(),
        },
      });
    }),

  // 4. Log Node Finish
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

  // 5. Complete Run
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
    
  // 6. Clear Runs
  clearRuns: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      // Delete runs (Cascade will handle nodes automatically if schema allows, but this is safe)
      return await prisma.workflowRun.deleteMany({
        where: { workflowId: input.workflowId },
      });
    }),
});