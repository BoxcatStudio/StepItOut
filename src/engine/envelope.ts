import type { LightLayer, CurvePreset } from "../types";
import { getTotalFrames } from "./frameMath";

export interface Envelope {
  startFrame: number;
  attackFrames: number;
  holdFrames: number;
  decayFrames: number;
  intensity: number;
  curve: CurvePreset;
}

// Cache envelope builds keyed by pattern array reference.
// Pattern arrays are replaced (new reference) whenever a pattern changes,
// so this cache stays valid for the lifetime of a pattern without invalidation logic.
const _envelopeCache = new WeakMap<number[], Envelope[]>();

export function getOpacityAtFrame(
  layer: LightLayer,
  frame: number,
  durationSeconds: number,
  fps: number
): number {
  const totalFrames = getTotalFrames(durationSeconds, fps);
  const envelopes = buildEnvelopes(layer, durationSeconds, fps);
  let maxOpacity = 0;

  for (const env of envelopes) {
    const opacity = evaluateEnvelope(env, frame, totalFrames);
    maxOpacity = Math.max(maxOpacity, opacity);
  }

  return Math.min(1, maxOpacity * layer.intensity);
}

function buildEnvelopes(
  layer: LightLayer,
  durationSeconds: number,
  fps: number
): Envelope[] {
  if (_envelopeCache.has(layer.pattern)) {
    return _envelopeCache.get(layer.pattern)!;
  }

  const envelopes: Envelope[] = [];
  void getTotalFrames(durationSeconds, fps); // keep signature stable
  const patLen = layer.pattern.length;

  // Group consecutive non-zero frames into runs, then create ONE envelope per run.
  let i = 0;
  while (i < patLen) {
    if (layer.pattern[i] === 0) { i++; continue; }

    // Found start of a run
    const runStart = i;
    while (i < patLen && layer.pattern[i] !== 0) { i++; }
    const runLen = i - runStart;

    // For cells ≤ 3 frames: no attack/decay — first frame at 100% (strobe mode)
    if (runLen <= 3) {
      envelopes.push({
        startFrame: runStart,
        attackFrames: 0,
        holdFrames: runLen,
        decayFrames: 0,
        intensity: 1,
        curve: layer.curve,
      });
      continue;
    }

    // For longer runs: apply attack/decay within the run boundaries
    const attack = Math.min(layer.attack, runLen - 1);
    const decay = Math.min(layer.decay, Math.max(0, runLen - attack - 1));
    const hold = Math.max(1, runLen - attack - decay);

    envelopes.push({
      startFrame: runStart,
      attackFrames: attack,
      holdFrames: hold,
      decayFrames: decay,
      intensity: 1,
      curve: layer.curve,
    });
  }

  _envelopeCache.set(layer.pattern, envelopes);
  return envelopes;
}

function evaluateEnvelope(
  env: Envelope,
  frame: number,
  totalFrames: number
): number {
  const endFrame = env.startFrame + env.attackFrames + env.holdFrames + env.decayFrames;
  let localFrame = frame - env.startFrame;

  if (localFrame < 0) {
    localFrame += totalFrames;
  }
  if (localFrame >= totalFrames) {
    localFrame -= totalFrames;
  }

  const relEnd = endFrame - env.startFrame;
  if (localFrame < 0 || localFrame >= relEnd) return 0;

  if (localFrame < env.attackFrames) {
    const t = env.attackFrames > 0 ? localFrame / env.attackFrames : 1;
    return applyCurve(t, env.curve, "up");
  }

  localFrame -= env.attackFrames;
  if (localFrame < env.holdFrames) {
    return 1;
  }

  localFrame -= env.holdFrames;
  const t = env.decayFrames > 0 ? 1 - localFrame / env.decayFrames : 0;
  return applyCurve(t, env.curve, "down");
}

function applyCurve(t: number, curve: CurvePreset, direction: "up" | "down"): number {
  const x = Math.max(0, Math.min(1, t));
  switch (curve) {
    case "pulse":
      return x;
    case "smooth":
      return direction === "up" ? easeInOutQuad(x) : 1 - easeInOutQuad(1 - x);
    case "strobe":
      return x > 0.5 ? 1 : 0;
    case "ramp":
      return x;
    case "exponential":
      return direction === "up" ? easeExpIn(x) : 1 - easeExpIn(1 - x);
    case "slow":
      return direction === "up" ? easeOutQuad(x) : 1 - easeOutQuad(1 - x);
    default:
      return x;
  }
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeExpIn(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

export function getOpacityKeyframes(
  layer: LightLayer,
  durationSeconds: number,
  fps: number
): Array<{ frame: number; value: number }> {
  const totalFrames = getTotalFrames(durationSeconds, fps);
  const keyframes: Array<{ frame: number; value: number }> = [];
  const step = Math.max(1, Math.floor(totalFrames / 120));

  for (let f = 0; f < totalFrames; f += step) {
    const opacity = getOpacityAtFrame(layer, f, durationSeconds, fps);
    if (opacity > 0 || (f === 0 || f === totalFrames - 1)) {
      keyframes.push({ frame: f, value: opacity });
    }
  }

  return keyframes;
}
