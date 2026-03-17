export function getTotalFrames(
  durationSeconds: number,
  fps: number
): number {
  return Math.round(durationSeconds * fps);
}

/**
 * Returns an array of frame spans for one second at the given fps and division.
 * Shorter cells are distributed evenly throughout the second.
 *
 * Examples at 30fps:
 *   1  → [30]
 *   2  → [15, 15]
 *   4  → [7, 7, 7, 9]  (special case)
 *   8  → [4, 4, 3, 4, 4, 4, 3, 4]
 *   16 → [2, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 2, 2]
 *   30 → [1 × 30]
 */
export function getCellLayout(fps: number, division: number): number[] {
  if (division === 4 && fps === 30) return [7, 7, 7, 9]; // special case — keep current behavior
  if (division === 1) return [fps];
  if (division >= fps) return Array(fps).fill(1);

  const base = Math.ceil(fps / division);
  const excess = base * division - fps; // how many cells need to be 1 frame shorter

  if (excess === 0) {
    return Array(division).fill(base);
  }

  // Distribute shorter cells evenly throughout the second
  const layout: number[] = Array(division).fill(base);
  for (let i = 0; i < excess; i++) {
    const pos = Math.round(((i + 0.5) * division) / excess) - 1;
    layout[Math.min(pos, division - 1)] = base - 1;
  }
  return layout;
}

/**
 * Returns cumulative start frames for each cell within one second.
 * e.g. layout [7,7,7,9] → starts [0, 7, 14, 21]
 */
export function getCellStartFrames(layout: number[]): number[] {
  const starts: number[] = [0];
  for (let i = 1; i < layout.length; i++) {
    starts.push(starts[i - 1] + layout[i - 1]);
  }
  return starts;
}

/**
 * Given a frame offset within a second and a cell layout,
 * returns the cell index that frame falls into.
 */
export function getCellIndexForFrame(frameInSec: number, starts: number[], _layout: number[]): number {
  for (let i = starts.length - 1; i >= 0; i--) {
    if (frameInSec >= starts[i]) return i;
  }
  return 0;
}
