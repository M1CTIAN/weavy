import path from "path";
import dotenv from "dotenv";

// 1. Force Load Env Vars (Critical for Worker Process)
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { task } from "@trigger.dev/sdk/v3";
import fs from "fs";
import os from "os";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

function getFFmpegBinary(): string {
  if (ffmpegPath && fs.existsSync(ffmpegPath)) return ffmpegPath;
  return "ffmpeg";
}
const FFMPEG_BINARY = getFFmpegBinary();

// --- HELPER: Wait ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: Upload to Transloadit ---
async function uploadToTransloadit(filePath: string): Promise<string> {
  const authKey = process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;

  if (!authKey || !authSecret || !templateId) throw new Error("Transloadit credentials are missing.");

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const params = { auth: { key: authKey, expires }, template_id: templateId };
  
  const formData = new FormData();
  formData.append("params", JSON.stringify(params));
  const fileBuffer = await fs.promises.readFile(filePath);
  formData.append("file", new Blob([fileBuffer]), "image.png");

  const response = await fetch("https://api2.transloadit.com/assemblies", { method: "POST", body: formData });
  
  if (!response.ok) throw new Error(`Transloadit API Failed: ${await response.text()}`);
  
  const result = await response.json();
  if (result.error) throw new Error(`Transloadit Error: ${result.error}`);

  let fileUrl = result.results?.[':original']?.[0]?.ssl_url 
             || result.uploads?.[0]?.ssl_url 
             || result.results?.['compressed-image']?.[0]?.ssl_url;

  if (!fileUrl && result.ok === "ASSEMBLY_EXECUTING") return result.assembly_ssl_url;
  if (!fileUrl) throw new Error("Upload finished but URL is missing.");
  
  return fileUrl;
}

async function saveInputFile(urlOrData: string, outputPath: string) {
  if (urlOrData.startsWith("data:")) {
    const base64Data = urlOrData.split(",")[1];
    await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'));
    return;
  }
  const response = await fetch(urlOrData);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  // @ts-ignore
  await pipeline(response.body, createWriteStream(outputPath));
}

// --- TASK: EXTRACT FRAME ---
export const extractFrameTask = task({
  id: "media-extract-frame",
  maxDuration: 300,
  run: async (payload: { videoUrl: string; timestamp: string }) => {
    const { videoUrl, timestamp } = payload;
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-vid-${Date.now()}.mp4`);
    const outputPath = path.join(tmpDir, `output-frame-${Date.now()}.png`);

    try {
      await saveInputFile(videoUrl, inputPath);
      await execFileAsync(FFMPEG_BINARY, ['-ss', timestamp, '-i', inputPath, '-frames:v', '1', '-q:v', '2', '-y', outputPath]);
      
      if (!fs.existsSync(outputPath)) throw new Error(`FFmpeg failed.`);
      const publicUrl = await uploadToTransloadit(outputPath);
      return { imageUrl: publicUrl };

    } catch (error: any) {
      throw new Error(error.message || "Extraction error");
    } finally {
        await fs.promises.unlink(inputPath).catch(() => {});
        await fs.promises.unlink(outputPath).catch(() => {});
    }
  },
});

// --- TASK: CROP IMAGE ---
export const cropImageTask = task({
  id: "media-crop-image",
  maxDuration: 300,
  run: async (payload: { imageUrl: string; crop: any }) => {
    const { imageUrl, crop } = payload;
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-crop-${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `output-crop-${Date.now()}.png`);

    try {
      await saveInputFile(imageUrl, inputPath);
      const cropFilter = `crop=iw*${crop.width / 100}:ih*${crop.height / 100}:iw*${crop.x / 100}:ih*${crop.y / 100}`;
      await execFileAsync(FFMPEG_BINARY, ['-i', inputPath, '-vf', cropFilter, '-y', outputPath]);
      
      const publicUrl = await uploadToTransloadit(outputPath);
      return { imageUrl: publicUrl };

    } catch (error: any) {
      throw new Error(error.message || "Crop error");
    } finally {
        await fs.promises.unlink(inputPath).catch(() => {});
        await fs.promises.unlink(outputPath).catch(() => {});
    }
  },
});

// --- TASK: GEMINI LLM (ROBUST RETRY LOOP) ---
export const runLLMTask = task({
  id: "llm-run-gemini",
  maxDuration: 600, 
  run: async (payload: { model: string; systemPrompt?: string; userMessage: string; imageUrls?: string[] }) => {
    const { systemPrompt, userMessage, imageUrls } = payload;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing.");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Prepare Data once
    const promptParts: any[] = [];
    if (systemPrompt) promptParts.push(`System Instruction: ${systemPrompt}\n\n`);
    promptParts.push(userMessage);

    if (imageUrls && imageUrls.length > 0) {
        for (const url of imageUrls) {
            if (!url || typeof url !== 'string') continue;
            const resp = await fetch(url);
            const arrayBuffer = await resp.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const mimeType = resp.headers.get("content-type") || "image/png";
            promptParts.push({ inlineData: { data: base64, mimeType: mimeType } });
        }
    }

    // 🏆 PRIORITY LIST: Optimized for Free Tier Availability
    const modelCandidates = [
        "gemini-2.5-flash",
        "gemini-2.0-flash-lite-preview-02-05", 
        "gemini-flash-latest", 
        "gemini-pro-latest",
        "gemini-2.0-flash" 
    ];

    let lastError: any = null;

    for (const currentModel of modelCandidates) {
        try {
            const genModel = genAI.getGenerativeModel({ model: currentModel });
            const result = await genModel.generateContent(promptParts);
            return { text: result.response.text() };

        } catch (error: any) {
            lastError = error;
            console.warn(`⚠️ Failed ${currentModel}: ${error.message}`);

            // If 429 (Rate Limit), wait 5 seconds before trying next model
            if (error.message.includes("429")) {
                await wait(5000); 
            }
        }
    }

    throw new Error(`All models failed. Last error: ${lastError?.message}`);
  },
});

export const uploadMediaTask = task({
  id: "media-upload",
  maxDuration: 300,
  run: async (payload: { fileData: string; fileName: string }) => {
    const { fileData, fileName } = payload;
    const tmpDir = os.tmpdir();
    const safeName = `upload-${Date.now()}-${path.basename(fileName).replace(/[^a-z0-9.]/gi, '_')}`;
    const inputPath = path.join(tmpDir, safeName);
    try {
      await saveInputFile(fileData, inputPath);
      const publicUrl = await uploadToTransloadit(inputPath);
      return { url: publicUrl };
    } catch (e:any) { throw e; } 
    finally { await fs.promises.unlink(inputPath).catch(()=>{}); }
  },
});