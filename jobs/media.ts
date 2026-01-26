import { task } from "@trigger.dev/sdk/v3";
import fs from "fs";
import path from "path";
import os from "os";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

function getFFmpegBinary(): string {
  if (ffmpegPath && fs.existsSync(ffmpegPath)) {
    return ffmpegPath;
  }
  return "ffmpeg";
}

const FFMPEG_BINARY = getFFmpegBinary();

// --- HELPER: Upload to Transloadit ---
async function uploadToTransloadit(filePath: string): Promise<string> {
  const authKey = process.env.TRANSLOADIT_KEY;
  const authSecret = process.env.TRANSLOADIT_SECRET;
  const templateId = process.env.TRANSLOADIT_TEMPLATE_ID;

  if (!authKey || !authSecret || !templateId) {
    throw new Error("Transloadit credentials are missing.");
  }

  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const params = {
    auth: { key: authKey, expires },
    template_id: templateId,
  };
  const paramsString = JSON.stringify(params);

  const formData = new FormData();
  formData.append("params", paramsString);

  const fileBuffer = await fs.promises.readFile(filePath);
  const fileBlob = new Blob([fileBuffer]);
  formData.append("file", fileBlob, "image.png");

  console.log(`Uploading ${fileBuffer.length} bytes via Direct Fetch...`);

  const response = await fetch("https://api2.transloadit.com/assemblies", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Transloadit API Failed (${response.status}): ${txt}`);
  }

  const result = await response.json();
  if (result.error) throw new Error(`Transloadit Error: ${result.error}`);

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

  if (!fileUrl) {
    if (result.ok === "ASSEMBLY_EXECUTING") return result.assembly_ssl_url;
    throw new Error("Upload finished but URL is missing.");
  }

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
      console.log(`Using FFmpeg Binary: ${FFMPEG_BINARY}`);
      await saveInputFile(videoUrl, inputPath);

      // Check input size
      const inStats = await fs.promises.stat(inputPath);
      if (inStats.size === 0) throw new Error("Input video file is 0 bytes.");

      // ExecFile with array args (Safe & Clean)
      await execFileAsync(FFMPEG_BINARY, [
        '-ss', timestamp,
        '-i', inputPath,
        '-frames:v', '1',
        '-q:v', '2',
        '-y', outputPath
      ]);

      if (!fs.existsSync(outputPath)) throw new Error(`FFmpeg failed to create output.`);

      const publicUrl = await uploadToTransloadit(outputPath);

      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      return { imageUrl: publicUrl };

    } catch (error: any) {
      console.error("Extraction Failed:", error);
      await fs.promises.unlink(inputPath).catch(() => { });
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
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `input-crop-${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `output-crop-${Date.now()}.png`);

    try {
      await saveInputFile(imageUrl, inputPath);

      const cropFilter = `crop=iw*${crop.width / 100}:ih*${crop.height / 100}:iw*${crop.x / 100}:ih*${crop.y / 100}`;

      await execFileAsync(FFMPEG_BINARY, [
        '-i', inputPath,
        '-vf', cropFilter,
        '-y', outputPath
      ]);

      if (!fs.existsSync(outputPath)) throw new Error("Output file missing");

      const publicUrl = await uploadToTransloadit(outputPath);

      await fs.promises.unlink(inputPath).catch(() => { });
      await fs.promises.unlink(outputPath).catch(() => { });

      return { imageUrl: publicUrl };

    } catch (error: any) {
      console.error("Crop failed:", error);
      await fs.promises.unlink(inputPath).catch(() => { });
      throw new Error(error.message || "Unknown ffmpeg error");
    }
  },
});

// --- TASK: GEMINI LLM ---
export const runLLMTask = task({
  id: "llm-run-gemini",
  maxDuration: 300,
  run: async (payload: { model: string; systemPrompt?: string; userMessage: string; imageUrls?: string[] }) => {
    const { model, systemPrompt, userMessage, imageUrls } = payload;
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is missing from .env");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = model || "gemini-1.5-flash";
    const genModel = genAI.getGenerativeModel({ model: modelName });

    try {
      const promptParts: any[] = [];
      if (systemPrompt) promptParts.push(`System Instruction: ${systemPrompt}\n\n`);
      promptParts.push(userMessage);

      if (imageUrls && imageUrls.length > 0) {
        for (const url of imageUrls) {
          const resp = await fetch(url);
          const arrayBuffer = await resp.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const mimeType = resp.headers.get("content-type") || "image/png";
          promptParts.push({ inlineData: { data: base64, mimeType: mimeType } });
        }
      }

      const result = await genModel.generateContent(promptParts);
      const response = await result.response;
      return { text: response.text() };
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Unknown LLM error");
    }
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
      await fs.promises.unlink(inputPath).catch(() => { });
      return { url: publicUrl };
    } catch (error: any) {
      await fs.promises.unlink(inputPath).catch(() => { });
      throw new Error(error.message || "Unknown upload error");
    }
  },
});