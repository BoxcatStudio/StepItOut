export type PlaybackCallback = (frame: number, deltaMs: number) => void;

let rafId: number | null = null;
let startTime = 0;
let fps = 30;
let totalFrames = 240;
let callback: PlaybackCallback | null = null;

function tick(now: number) {
  if (!callback) return;
  const elapsedMs = now - startTime;
  const currentFrame = Math.floor((elapsedMs / 1000) * fps) % totalFrames;
  const deltaMs = elapsedMs > 0 ? 1000 / 60 : 0;
  callback(currentFrame, deltaMs);
  rafId = requestAnimationFrame(tick);
}

export function startPlayback(
  opts: { fps: number; totalFrames: number; initialFrame: number },
  cb: PlaybackCallback
) {
  stopPlayback();
  fps = opts.fps;
  totalFrames = opts.totalFrames;
  callback = cb;
  
  // Offset the start time by the current frame so resuming works smoothly without drift
  const initialTimeOffset = (opts.initialFrame / fps) * 1000;
  startTime = performance.now() - initialTimeOffset;
  
  rafId = requestAnimationFrame(tick);
}

export function stopPlayback() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  callback = null;
}
