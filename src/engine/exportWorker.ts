// src/engine/exportWorker.ts

import * as Mp4Muxer from "mp4-muxer";
import { getOpacityAtFrame } from "./envelope";
import type { ExportConfig, ExportProgress } from "./exporter";

// We need a helper to load images without DOM (HTMLImageElement)
// We'll use fetch and createImageBitmap
async function loadImageBitmap(filePath: string): Promise<ImageBitmap> {
  // If we are given a tauri:// or absolute path, we might need a workaround.
  // We'll assume the main thread passes valid object URLs or tauri:// URIs
  // that `fetch` can reach. Tauri's custom protocols usually support `fetch`.
  
  if (filePath.startsWith("data:")) {
    const response = await fetch(filePath);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } else {
    // Attempt standard fetch. If this fails, the main thread might need to
    // convert the file to a blob or ArrayBuffer and pass it over.
    const response = await fetch(filePath);
    if (!response.ok) throw new Error("Failed to fetch image: " + filePath);
    const blob = await response.blob();
    return await createImageBitmap(blob);
  }
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;
  
  if (type !== 'START_EXPORT') return;
  
  const config = payload as ExportConfig;
  const { sequence, resolution } = config;
  const { width, height } = resolution;
  const fps = sequence.fps;
  const totalFrames = sequence.durationSeconds * fps;
  
  const postProgress = (progress: ExportProgress) => {
    self.postMessage({ type: 'PROGRESS', payload: progress });
  };
  
  try {
    postProgress({ phase: 'rendering', progress: 0, message: 'Preparing assets...' });

    // 1. Load all images as ImageBitmaps
    const imageCache = new Map<string, ImageBitmap>();
    for (const light of sequence.lights) {
      if (!imageCache.has(light.filePath)) {
        try {
          // Add a simple timeout with Promise.race
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Image load timed out: " + light.filePath)), 15000)
          );
          const img = await Promise.race([loadImageBitmap(light.filePath), timeoutPromise]);
          imageCache.set(light.filePath, img);
        } catch (err: any) {
          console.warn(`Failed to load image for export: ${light.filePath}`);
        }
      }
    }

    // 2. Discover supported encoder configuration
    let renderWidth = width;
    let renderHeight = height;
    let encoderConfig: VideoEncoderConfig | null = null;
    
    postProgress({ phase: "rendering", progress: 0.0, message: "Negotiating encoder settings..." });

    const codecsToTry = [
      "avc1.640034", "avc1.4d0034", "avc1.420034",
      "avc1.640028", "avc1.4d0028", "avc1.420028",
      "avc1.42001f",
    ];

    let foundConfig = false;
    while (renderWidth >= 256 && renderHeight >= 256 && !foundConfig) {
      for (const codec of codecsToTry) {
        try {
          const cfg: VideoEncoderConfig = {
              codec,
              width: renderWidth,
              height: renderHeight,
              bitrate: Math.max(1_000_000, Math.floor(5_000_000 * (renderWidth / width))),
              framerate: fps,
              avc: { format: "avc" }
          };
          const support = await VideoEncoder.isConfigSupported(cfg);
          if (support.supported) {
              encoderConfig = cfg;
              foundConfig = true;
              break;
          }
        } catch (e) { }
      }

      if (!foundConfig) {
        postProgress({ phase: "rendering", progress: 0.0, message: `Downscaling resolution... (${renderWidth}x${renderHeight})` });
        renderWidth = Math.round(renderWidth * 0.75);
        renderHeight = Math.round(renderHeight * 0.75);
        if (renderWidth % 2 !== 0) renderWidth -= 1;
        if (renderHeight % 2 !== 0) renderHeight -= 1;
      }
    }

    if (!encoderConfig) {
        throw new Error("VideoEncoder configuration is not supported on this device.");
    }

    // 3. Setup Canvas
    const canvas = new OffscreenCanvas(renderWidth, renderHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context for export canvas.");

    // 4. Setup Muxer and Encoder
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: {
        codec: "avc",
        width: renderWidth,
        height: renderHeight,
      },
      fastStart: "in-memory",
    });

    let encodingError: Error | null = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encodingError = e; },
    });

    videoEncoder.configure(encoderConfig);

    // 5. Render Loop
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      postProgress({ 
        phase: "rendering", 
        progress: frameIndex / totalFrames,
        message: `Rendering frame ${frameIndex + 1}/${totalFrames}` 
      });

      if (encodingError) throw encodingError;

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, renderWidth, renderHeight);
      ctx.globalCompositeOperation = "lighter";

      for (const light of sequence.lights) {
        const opacity = getOpacityAtFrame(light, frameIndex, sequence.durationSeconds, fps);
        if (opacity <= 0) continue;

        const img = imageCache.get(light.filePath);
        if (!img) continue;

        const imgAspect = img.width / img.height;
        const canvasAspect = renderWidth / renderHeight;

        let drawW = renderWidth;
        let drawH = renderHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (imgAspect > canvasAspect) {
          drawH = renderWidth / imgAspect;
          offsetY = (renderHeight - drawH) / 2;
        } else {
          drawW = renderHeight * imgAspect;
          offsetX = (renderWidth - drawW) / 2;
        }

        ctx.globalAlpha = opacity;
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      const frame = new VideoFrame(canvas, { timestamp: (frameIndex / fps) * 1_000_000 });
      videoEncoder.encode(frame, { keyFrame: frameIndex % fps === 0 });
      frame.close();
      
      await new Promise(r => setTimeout(r, 0)); // Yield to encoder/messages
    }

    postProgress({ phase: "encoding", progress: 1, message: "Finalizing video..." });

    // 6. Finalize
    await videoEncoder.flush();
    videoEncoder.close();

    if (encodingError) throw encodingError;

    muxer.finalize();
    const buffer = muxer.target.buffer;

    // Clean up Bitmaps
    for (const bitmap of imageCache.values()) {
      bitmap.close();
    }
    imageCache.clear();
    canvas.width = 0;
    canvas.height = 0;

    self.postMessage({ type: 'COMPLETE', payload: buffer });
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', payload: error?.message || String(error) });
  }
};
