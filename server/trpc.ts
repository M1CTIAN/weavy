import { initTRPC, TRPCError } from '@trpc/server';
import { Context } from './context';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

// ✅ NEW: Protected Middleware
// Checks if 'userId' exists. If not, throws 401 Unauthorized.
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      userId: ctx.userId, // TypeScript now knows userId is guaranteed to exist
    },
  });
});

// Use this for any action that saves/reads user data
export const protectedProcedure = t.procedure.use(isAuthed);