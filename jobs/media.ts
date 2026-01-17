import { task } from "@trigger.dev/sdk/v3";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";
// We don't use the SDK for upload anymore, just manual fetch
// import { Transloadit } from "transloadit"; 

const execAsync = promisify(exec);

// 👇 Verify this path matches your system
const FFMPEG_PATH = "C:/Users/Arpit Raj/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.0.1-essentials_build/bin/ffmpeg.exe";

// --- HELPER: Upload to Transloadit (Manual Fetch) ---
async function uploadToTransloadit(filePath: string): Promise<string> {
  const authKey = process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;

  if (!authKey || !authSecret || !templateId) {
    throw new Error("Transloadit credentials are missing.");
  }

  // 1. Prepare Params
  // Expiry: 1 hour from now
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const params = {
    auth: { key: authKey, expires },
    template_id: templateId,
  };
  const paramsString = JSON.stringify(params);

  // 2. Generate Signature (HMAC-SHA1) - Required for direct API
  // Note: If this is too complex, we can try without signature first if "Signature Authentication" is off in your Transloadit account.
  // But usually, it's safer to just send the raw params if your template allows it.

  // 3. Prepare Form Data
  const formData = new FormData();
  formData.append("params", paramsString);

  // Read file as Blob
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileBlob = new Blob([fileBuffer]);
  formData.append("file", fileBlob, "image.png");

  console.log(`Uploading ${fileBuffer.length} bytes via Direct Fetch...`);

  // 4. POST to Transloadit
  const response = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Transloadit API Failed (${response.status}): ${txt}`);
  }

  const result = await response.json();

  // 5. Parse Result
  console.log("Transloadit Status:", result.ok);

  if (result.error) {
    throw new Error(`Transloadit Error: ${result.error} - ${result.message}`);
  }

  // Wait/Check URL
  // Since we use the simple template, the result is usually immediate.
  const uploads = result.uploads || [];
  const results = result.results || {};

  let fileUrl = "";

  if (results[':original'] && results[':original'][0]) {
    fileUrl = results[':original'][0].ssl_url || "";
  } else if (uploads.length > 0) {
    fileUrl = uploads[0].ssl_url || "";
  } else if (results['compressed-image'] && results['compressed-image'][0]) {
    fileUrl = results['compressed-image'][0].ssl_url || "";
  }

  fileUrl = fileUrl || "";

  if (!fileUrl) {
    // If "ASSEMBLY_EXECUTING", we might need the Assembly URL to poll, 
    // but for small files + simple template, it is usually instant.
    console.log("Full Response:", JSON.stringify(result));
    if (result.ok === "ASSEMBLY_EXECUTING") {
      // If it's still executing, we return the assembly URL so you can check it manually, 
      // OR we throw to say "It's taking too long".
      // For now, let's try to grab the assembly_ssl_url as a fallback so at least you have a link to the status.
      console.warn("Assembly still executing. Returning status URL instead of image.");
      return result.assembly_ssl_url;
    }
    throw new Error("Upload finished but URL is missing.");
  }

  console.log("Transloadit URL:", fileUrl);
  return fileUrl;
}

// --- HELPER: Save Input ---
async function saveInputFile(urlOrData: string, outputPath: string) {
  if (urlOrData.startsWith("data:")) {
    const base64Data = urlOrData.split(",")[1];
    if (!base64Data) throw new Error("Invalid Data URI");
    await fs.promises.writeFile(outputPath, Buffer.from(base64Data, 'base64'));
    return;
  }

  console.log("Downloading input...");
  const response = await fetch(urlOrData);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  if (!response.body) throw new Error("No body in response");
  // @ts-ignore
  await pipeline(response.body, createWriteStream(outputPath));
}

// --- TASK: EXTRACT FRAME ---
export const extractFrameTask = task({
  id: "media-extract-frame",
  maxDuration: 300,
  run: async (payload: { videoUrl: string; timestamp: string }) => {
    const { videoUrl, timestamp } = payload;

    if (!fs.existsSync(FFMPEG_PATH)) throw new Error(`FFmpeg not found`);

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-vid-${Date.now()}.mp4`);
    const outputPath = path.join(tmpDir, `output-frame-${Date.now()}.png`);

    try {
      await saveInputFile(videoUrl, inputPath);

      const inStats = await fs.promises.stat(inputPath);
      if (inStats.size === 0) throw new Error("Input video file is 0 bytes.");

      const command = `"${FFMPEG_PATH}" -ss ${timestamp} -i "${inputPath}" -frames:v 1 -q:v 2 -y "${outputPath}"`;
      await execAsync(command);

      if (!fs.existsSync(outputPath)) throw new Error(`FFmpeg failed to create output.`);

      const publicUrl = await uploadToTransloadit(outputPath);

      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      return { imageUrl: publicUrl };

    } catch (error: any) {
      console.error("Extraction Failed:", error);
      throw new Error(error.message || "Unknown error");
    }
  },
});

// --- TASK: CROP IMAGE ---
export const cropImageTask = task({
  id: "media-crop-image",
  maxDuration: 300,
  run: async (payload: { imageUrl: string; crop: { x: number; y: number; width: number; height: number } }) => {
    const { imageUrl, crop } = payload;

    if (!fs.existsSync(FFMPEG_PATH)) throw new Error(`FFmpeg not found`);

    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-crop-${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `output-crop-${Date.now()}.png`);

    try {
      await saveInputFile(imageUrl, inputPath);

      const command = `"${FFMPEG_PATH}" -i "${inputPath}" -vf "crop=iw*${crop.width / 100}:ih*${crop.height / 100}:iw*${crop.x / 100}:ih*${crop.y / 100}" -y "${outputPath}"`;
      await execAsync(command);

      if (!fs.existsSync(outputPath)) throw new Error("Output file missing");

      const publicUrl = await uploadToTransloadit(outputPath);

      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      return { imageUrl: publicUrl };

    } catch (error: any) {
      console.error("Crop failed:", error);
      throw new Error(error.message || "Unknown ffmpeg error");
    }
  },
});


export const runLLMTask = task({
  id: "llm-run-gemini",
  maxDuration: 60, // 1 minute timeout
  run: async (payload: {
    model: string;
    systemPrompt?: string;
    userMessage: string;
    imageUrls?: string[]
  }) => {
    const { model, systemPrompt, userMessage, imageUrls } = payload;

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY is missing from .env");

    const genAI = new GoogleGenerativeAI(apiKey);

    // Select model (default to gemini-1.5-flash if invalid)
    const modelName = model || "gemini-1.5-flash";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    try {
      // Prepare content parts
      const promptParts: any[] = [];

      // 1. Add System Prompt (if supported/hacky way for simple models)
      // Gemini often treats system prompts as just the first part of the context
      if (systemPrompt) {
        promptParts.push(`System Instruction: ${systemPrompt}\n\n`);
      }

      // 2. Add User Message
      promptParts.push(userMessage);

      // 3. Add Images (Fetch and convert to Base64 for the SDK)
      if (imageUrls && imageUrls.length > 0) {
        for (const url of imageUrls) {
          console.log("Fetching image for LLM:", url);
          const resp = await fetch(url);
          const arrayBuffer = await resp.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = resp.headers.get("content-type") || "image/png";

          promptParts.push({
            inlineData: {
              data: base64,
              mimeType: mimeType
            }
          });
        }
      }

      console.log(`Sending to Gemini (${modelName})...`);
      const result = await genModel.generateContent(promptParts);
      const response = await result.response;
      const text = response.text();

      return { text };

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Unknown LLM error");
    }
  },
});

export const uploadMediaTask = task({
  id: "media-upload",
  maxDuration: 300, // 5 minutes for large videos
  run: async (payload: { fileData: string; fileName: string }) => {
    const { fileData, fileName } = payload;

    // 1. Save Base64 to Temp File
    const tmpDir = os.tmpdir();
    // Sanitize filename or just use timestamp to avoid issues
    const safeName = `upload-${Date.now()}-${path.basename(fileName).replace(/[^a-z0-9.]/gi, '_')}`;
    const inputPath = path.join(tmpDir, safeName);

    try {
      console.log(`Receiving upload: ${fileName}...`);
      await saveInputFile(fileData, inputPath);

      // 2. Upload to Transloadit
      // (This uses your existing robust uploadToTransloadit helper)
      const publicUrl = await uploadToTransloadit(inputPath);

      // 3. Cleanup
      await fs.promises.unlink(inputPath).catch(() => { });

      return { url: publicUrl };

    } catch (error: any) {
      console.error("Upload Failed:", error);
      await fs.promises.unlink(inputPath).catch(() => { });
      throw new Error(error.message || "Unknown upload error");
    }
  },
});