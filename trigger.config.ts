import type { TriggerConfig } from "@trigger.dev/sdk/v3";

export const config: TriggerConfig = {
  project: "proj_gzxpcmjzaslucncjstnh",
  logLevel: "log",
  runtime: "node",
  maxDuration: 5000, 
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 5000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    external: ["ffmpeg-static"],
  },
  dirs: ["./jobs"],
};