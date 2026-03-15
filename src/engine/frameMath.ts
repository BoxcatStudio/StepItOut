export function getTotalFrames(
  durationSeconds: number,
  fps: number
): number {
  return Math.round(durationSeconds * fps);
}
