import { router } from './trpc';
import { workflowRouter } from './routers/workflow';
import { geminiRouter } from './routers/gemini';
import { mediaRouter } from './routers/media'; // <--- Import
import { historyRouter } from './routers/history';

export const appRouter = router({
  workflow: workflowRouter,
  gemini: geminiRouter,
  media: mediaRouter, 
  history: historyRouter,
});

export type AppRouter = typeof appRouter;