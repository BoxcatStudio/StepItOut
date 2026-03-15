import type { StepSequence } from "../types";

export interface ExportProgress {
  phase: "rendering" | "encoding" | "done" | "error";
  progress: number; // 0 to 1
  message?: string;
}

export interface ExportConfig {
  sequence: StepSequence;
  resolution: { width: number; height: number };
  onProgress?: (progress: ExportProgress) => void;
  signal?: AbortSignal;
}

export async function exportToMp4({ sequence, resolution, onProgress, signal }: ExportConfig): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    // Spawn Web Worker
    const worker = new Worker(new URL('./exportWorker.ts', import.meta.url), { type: 'module' });

    // Handle Abortion strictly by destroying the worker instance
    if (signal) {
      if (signal.aborted) {
        worker.terminate();
        return reject(new Error("Export aborted"));
      }
      signal.addEventListener("abort", () => {
        worker.terminate();
        reject(new Error("Export aborted"));
      }, { once: true });
    }

    worker.onmessage = (e: MessageEvent) => {
      const { type, payload } = e.data;
      if (type === 'PROGRESS') {
        onProgress?.(payload);
      } else if (type === 'COMPLETE') {
        worker.terminate(); // Force garbage collection of internal worker resources
        resolve(new Uint8Array(payload));
      } else if (type === 'ERROR') {
        worker.terminate(); // Force garbage collection on error
        reject(new Error(payload));
      }
    };

    worker.onerror = (err) => {
      worker.terminate(); // Force garbage collection on fatal thread error
      reject(err);
    };

    // Kick off export
    worker.postMessage({
      type: 'START_EXPORT',
      payload: { sequence, resolution }
    });
  });
}
