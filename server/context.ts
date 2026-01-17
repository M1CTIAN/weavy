import { auth } from '@clerk/nextjs/server';

export const createContext = async () => {
  // 1. Get the auth object (await it because it's a promise in newer Clerk versions)
  const session = await auth();

  return {
    userId: session.userId, // 👈 Now this ID is available in every TRPC route
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;