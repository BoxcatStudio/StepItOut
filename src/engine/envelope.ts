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
  const envelopes: Envelope[] = [];
  const totalFrames = getTotalFrames(durationSeconds, fps);
  const patLen = layer.pattern.length;

  for (let i = 0; i < patLen; i++) {
    if (layer.pattern[i] === 0) continue;

    // Find distance to the next active frame (including wrap-around)
    let nextStepDistFrame = totalFrames;
    for (let j = 1; j <= patLen; j++) {
      const idx = (i + j) % patLen;
      if (layer.pattern[idx] !== 0) {
        let nextFrame = idx;
        if (j > 0 && idx <= i) {
          nextFrame += totalFrames; // Wrapped
        }
        nextStepDistFrame = nextFrame - i;
        break;
      }
    }

    const startFrame = i;
    const attackFrames = layer.attack;
    const holdFrames = 1; // Exactly 1 frame impulse by default
    
    // Decay curve is clipped if it overlaps into the next hit
    const overlapLimit = Math.max(0, nextStepDistFrame - attackFrames - holdFrames);
    const decayFrames = Math.floor(Math.min(layer.decay, overlapLimit));

    envelopes.push({
      startFrame,
      attackFrames,
      holdFrames,
      decayFrames,
      intensity: 1,
      curve: layer.curve,
    });
  }

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
