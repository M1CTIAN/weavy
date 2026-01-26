import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
// ✅ FIX 1: Import from the correct file ('media') and use the correct task name
import { runLLMTask } from '@/jobs/media';

export const geminiRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        model: z.string().default('gemini-1.5-flash'),
        systemPrompt: z.string().optional(),
        userPrompt: z.string(),
        images: z.array(z.string()).optional(),
      })
    )
    .mutation(async (opts) => {
      const { input } = opts;

      console.log(`🚀 Triggering background job for model: ${input.model}`);

      // ✅ FIX 2: Trigger the correct task with the correct payload mapping
      const run = await runLLMTask.trigger({
        model: input.model,
        systemPrompt: input.systemPrompt,
        // Map 'userPrompt' (frontend) -> 'userMessage' (task)
        userMessage: input.userPrompt,
        // Map 'images' (frontend) -> 'imageUrls' (task)
        imageUrls: input.images,
      });

      // Return the Run ID immediately
      return { runId: run.id };
    }),
});