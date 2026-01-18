import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { tasks, runs } from "@trigger.dev/sdk/v3"; 
import crypto from "crypto";

// --- Helper: Transloadit Signature Generation ---
function signTransloaditRequest(type: 'image' | 'video') {
  const utcDate = new Date();
  utcDate.setHours(utcDate.getHours() + 1); 

  const authKey = process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;

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
      key: authKey, 
      expires: utcDate.toISOString(), 
    },
    template_id: templateId, 
  };

  const paramsString = JSON.stringify(params);
  
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
  // 1. Get Secure Upload Signature (Standard)
  getUploadSignature: publicProcedure
    .input(z.object({ 
      type: z.enum(['image', 'video']) 
    }))
    .mutation(async ({ input }) => {
      if (!process.env.TRANSLOADIT_SECRET) {
        throw new Error("Server missing Transloadit keys (TRANSLOADIT_SECRET)");
      }
      return signTransloaditRequest(input.type);
    }),

  // 2. POLLING ENDPOINT: Frontend calls this to check task status
  getRunStatus: publicProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input }) => {
      const run = await runs.retrieve(input.runId);
      return { 
        status: run.status, 
        output: run.output, 
        error: run.error 
      };
    }),

  // 3. Crop Image (Fire-and-Forget)
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
      // Triggers the task and returns immediately
      const handle = await tasks.trigger("media-crop-image", input);
      return { runId: handle.id };
    }),

  // 4. Extract Frame (Fire-and-Forget)
  extractFrame: publicProcedure
    .input(
      z.object({
        videoUrl: z.string(),
        timestamp: z.string().default("0"),
      })
    )
    .mutation(async ({ input }) => {
      const handle = await tasks.trigger("media-extract-frame", input);
      return { runId: handle.id };
    }),

  // 5. Upload (Fire-and-Forget)
  upload: publicProcedure
    .input(z.object({
      fileData: z.string(), 
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const handle = await tasks.trigger("media-upload", input);
      return { runId: handle.id };
    }),
});