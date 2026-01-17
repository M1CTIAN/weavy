import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// --- HELPER: Handle both URLs and Base64 Images ---
async function processImage(imageInput: string): Promise<{ mimeType: string; data: string }> {
  // Case 1: Input is a URL (starts with "http") - FETCH IT
  if (imageInput.startsWith("http")) {
    try {
      const response = await fetch(imageInput);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const contentType = response.headers.get("content-type") || "image/png";
      return { mimeType: contentType, data: buffer.toString("base64") };
    } catch (error) {
      console.error("Error processing image URL:", error);
      throw new Error("Failed to process image URL for Gemini");
    }
  }

  // Case 2: Input is Base64 (starts with "data:image/...") - PARSE IT
  if (imageInput.startsWith("data:")) {
    const [metadata, base64Data] = imageInput.split(",");
    const mimeType = metadata.match(/:(.*?);/)?.[1] || "image/png";
    return { mimeType, data: base64Data };
  }

  // Case 3: Raw Base64 or invalid - Try passing as-is
  return { mimeType: 'image/jpeg', data: imageInput };
}

export const geminiRouter = router({
  generate: publicProcedure
    .input(
      z.object({
        model: z.string().default('gemini-1.5-flash'), // Default if frontend sends nothing
        systemPrompt: z.string().optional(),
        userPrompt: z.string(),
        images: z.array(z.string()).optional(),
      })
    )
    .mutation(async (opts) => {
      const { input } = opts;
      
      // 1. Pre-process images
      const hasImages = input.images && input.images.length > 0;
      let imageParts: any[] = [];
      
      if (hasImages) {
        try {
          const processed = await Promise.all(input.images!.map(img => processImage(img)));
          imageParts = processed.map(img => ({
            inlineData: {
              data: img.data,
              mimeType: img.mimeType,
            },
          }));
        } catch (e) {
          console.error("Image processing failed:", e);
          throw new Error("Failed to process input images. Check URLs or file format.");
        }
      }

      // 2. STRICT EXECUTION: Only use the selected model
      const modelName = input.model;
      console.log(`🤖 Running with model: ${modelName}...`);

      try {
        const geminiModel = genAI.getGenerativeModel({ model: modelName });

        let finalPrompt = input.userPrompt;
        if (input.systemPrompt) {
          finalPrompt = `System Instruction: ${input.systemPrompt}\n\nUser Message: ${input.userPrompt}`;
        }

        let result;
        if (imageParts.length > 0) {
          result = await geminiModel.generateContent([finalPrompt, ...imageParts]);
        } else {
          result = await geminiModel.generateContent(finalPrompt);
        }

        const response = await result.response;
        const text = response.text();
        
        console.log("✅ Success!");
        return { output: text };

      } catch (error: any) {
        console.error(`❌ Failed with ${modelName}:`, error.message);
        // Throw the actual error so the frontend knows exactly what went wrong
        throw new Error(`Gemini Error (${modelName}): ${error.message}`);
      }
    }),
});