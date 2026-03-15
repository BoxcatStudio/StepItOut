import { useRef, useEffect } from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";
import { useSequencerStore } from "../store/useSequencerStore";
import { getOpacityAtFrame } from "../engine/envelope";
import { WebGLCompositor } from "../engine/webgl";

function getImageSrc(filePath: string): string {
  if (isTauri()) {
    try {
      return convertFileSrc(filePath);
    } catch {
      return "";
    }
  }
  return filePath.startsWith("http") ? filePath : "";
}

export function PreviewMonitor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const textureCache = useRef<Map<string, WebGLTexture>>(new Map());
  const compositorRef = useRef<WebGLCompositor | null>(null);

  // Initialize WebGL once
  useEffect(() => {
    if (!canvasRef.current || compositorRef.current) return;
    try {
      compositorRef.current = new WebGLCompositor(canvasRef.current);
    } catch (e) {
      console.error("WebGL Initialization failed", e);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      let aspect = 16 / 9;

      const currentSequence = useSequencerStore.getState().sequence;
      if (currentSequence.lights.length > 0) {
        const firstImg = imageCache.current.get(currentSequence.lights[0].filePath);
        if (firstImg && firstImg.complete && firstImg.height > 0) {
          aspect = firstImg.width / firstImg.height;
        }
      }

      let cw = rect.width;
      let ch = rect.height;
      if (cw / ch > aspect) {
        cw = ch * aspect;
      } else {
        ch = cw / aspect;
      }
      if (compositorRef.current) {
        compositorRef.current.resize(cw, ch);
      }
    };

    const draw = () => {
      const compositor = compositorRef.current;
      if (!compositor) return;

      compositor.clear();

      const currentSequence = useSequencerStore.getState().sequence;
      const currentFrame = useSequencerStore.getState().currentFrame;

      if (currentSequence.lights.length === 0) return;

      for (const light of currentSequence.lights) {
        // Lazy load images if they haven't been requested yet
        if (!imageCache.current.has(light.filePath)) {
          // Set an empty marker so we don't request it 60 times a second while loading
          imageCache.current.set(light.filePath, new Image());
          const src = getImageSrc(light.filePath);
          if (src) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
               imageCache.current.set(light.filePath, img);
               if (compositorRef.current) {
                 const tex = compositorRef.current.createTexture(img);
                 textureCache.current.set(light.filePath, tex);
               }
            };
            img.src = src;
          }
        }

        const opacity = getOpacityAtFrame(
          light,
          currentFrame,
          currentSequence.durationSeconds,
          currentSequence.fps
        );
        if (opacity <= 0) continue;

        const tex = textureCache.current.get(light.filePath);
        const img = imageCache.current.get(light.filePath);
        
        if (!tex || !img || !img.complete) continue;

        compositor.drawTexture(tex, opacity, img.width, img.height);
      }
    };

    let animFrame: number;
    const renderLoop = () => {
       draw();
       animFrame = requestAnimationFrame(renderLoop);
    };

    resize();
    renderLoop();

    const ro = new ResizeObserver(() => {
       resize();
       draw();
    });
    ro.observe(container);

    return () => {
       ro.disconnect();
       cancelAnimationFrame(animFrame);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center relative overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
      />
    </div>
  );
}
