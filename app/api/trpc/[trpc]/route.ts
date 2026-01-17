import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server"; // Ensure this points to your main router
import { createContext } from "@/server/context"; // 👈 Import your actual context creator

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext, // 👈 Use the imported function, NOT () => ({})
  });

export { handler as GET, handler as POST };