import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server'; // Make sure this path points to your appRouter

export const trpc = createTRPCReact<AppRouter>();