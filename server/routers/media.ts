import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { tasks, runs } from "@trigger.dev/sdk/v3"; 
import crypto from "crypto";

// --- Helper: Trigger.dev Polling ---
async function triggerAndWait(taskId: string, payload: any) {
  const handle = await tasks.trigger(taskId, payload);
  console.log(`Task ${taskId} triggered. ID: ${handle.id}. Polling for result...`);

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    const run = await runs.retrieve(handle.id);

    if (run.status === "COMPLETED") {
      return run.output;
    }
    
    if (run.status === "FAILED" || run.status === "CANCELED" || run.status === "CRASHED") {
       throw new Error(run.error?.message || "Task failed during execution");
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error("Task timed out waiting for result.");
}

// --- Helper: Transloadit Signature Generation ---
function signTransloaditRequest(type: 'image' | 'video') {
  const utcDate = new Date();
  utcDate.setHours(utcDate.getHours() + 1); 

  // 👇 UPDATED: Uses your variable names
  const authKey = process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;

  // Select Template ID
  const templateId = type === 'video' 
    ? process.env.TRANSLOADIT_VIDEO_TEMPLATE_ID 
    : process.env.TRANSLOADIT_TEMPLATE_ID;

  if (!templateId) {
    throw new Error(`Missing Transloadit Template ID for ${type}`);
  }
  if (!authKey || !authSecret) {
    throw new Error("Missing Transloadit Key or Secret in .env");
  }

  const params = {
    auth: { 
      key: authKey, // Using 'TRANSLOADIT_KEY'
      expires: utcDate.toISOString(), 
    },
    template_id: templateId, 
  };

  const paramsString = JSON.stringify(params);
  
  // Calculate Signature using 'TRANSLOADIT_SECRET'
  const signature = crypto
    .createHmac('sha1', authSecret)
    .update(paramsString)
    .digest('hex');

  return {
    signature: `sha1:${signature}`,
    params: paramsString
  };
}

export const mediaRouter = router({
  // 1. Get Secure Upload Signature
  getUploadSignature: publicProcedure
    .input(z.object({ 
      type: z.enum(['image', 'video']) 
    }))
    .mutation(async ({ input }) => {
      // Validate secret exists before trying to sign
      if (!process.env.TRANSLOADIT_SECRET) {
        throw new Error("Server missing Transloadit keys (TRANSLOADIT_SECRET)");
      }
      return signTransloaditRequest(input.type);
    }),

  // ... (keep cropImage, extractFrame, upload procedures exactly as they were) ...
  cropImage: publicProcedure
    .input(
      z.object({
        imageUrl: z.string(),
        crop: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      // @ts-ignore
      const result = await triggerAndWait("media-crop-image", input);
      return { imageUrl: (result as any).imageUrl };
    }),

  extractFrame: publicProcedure
    .input(
      z.object({
        videoUrl: z.string(),
        timestamp: z.string().default("0"),
      })
    )
    .mutation(async ({ input }) => {
      // @ts-ignore
      const result = await triggerAndWait("media-extract-frame", input);
      return { imageUrl: (result as any).imageUrl };
    }),

  upload: publicProcedure
    .input(z.object({
      fileData: z.string(), 
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      // @ts-ignore
      return await triggerAndWait("media-upload", input);
    }),
});