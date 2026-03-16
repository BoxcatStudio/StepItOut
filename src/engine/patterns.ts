import type { GeneratorConfig, LightLayer } from "../types";

export function generateGridPatterns(
  config: GeneratorConfig,
  layers: LightLayer[]
): Record<string, number[]> {
  const numLayers = layers.length;
  const result: Record<string, number[]> = {};

  if (numLayers === 0) return result;

  // Only initialize patterns for non-muted layers — muted layers keep their existing patterns
  layers.forEach(l => {
    if (!l.muted) {
      result[l.id] = new Array(l.pattern.length).fill(0);
    }
  });

  // Active (non-muted) layers for generator logic
  const activeLayers = layers.filter(l => !l.muted);
  const numActive = activeLayers.length;
  if (numActive === 0) return result;

  const maxSteps = Math.max(...activeLayers.map(l => l.pattern.length));

  // Helper to set a frame on an active layer by its index within activeLayers
  const setStep = (aIndex: number, step: number, value: number = 1) => {
    if (aIndex >= 0 && aIndex < numActive) {
      const layer = activeLayers[aIndex];
      const mappedStep = Math.floor((step / maxSteps) * layer.pattern.length);
      if (mappedStep >= 0 && mappedStep < layer.pattern.length) {
        result[layer.id][mappedStep] = value;
      }
    }
  };

  switch (config.type) {
    case "random": {
      const { density, variation } = config.config;
      const probability = Math.pow(density / 100, 2);

      activeLayers.forEach((l, lIndex) => {
        for (let i = 0; i < l.pattern.length; i++) {
          const prng = Math.sin(lIndex * 13.37 + i * 9.11 + variation) * 10000;
          const rand = prng - Math.floor(prng);
          if (rand < probability) {
            result[l.id][i] = 1;
          }
        }
      });
      break;
    }

    case "wave": {
      const { width, speed } = config.config;
      const freq = speed / 10;
      const spread = width / 100;

      for (let step = 0; step < maxSteps; step++) {
        const normalizedY = (Math.sin((step / maxSteps) * Math.PI * 2 * freq) + 1) / 2;
        const centerThrust = normalizedY * (numActive - 1);

        activeLayers.forEach((_, lIndex) => {
          const distance = Math.abs(lIndex - centerThrust);
          if (distance <= spread * numActive) {
            setStep(lIndex, step, 1);
          }
        });
      }
      break;
    }

    case "mirror": {
      const { shape, amount, angle } = config.config;

      for (let step = 0; step < maxSteps; step++) {
        activeLayers.forEach((_, lIndex) => {
          const nx = (step / (maxSteps - 1 || 1)) - 0.5;
          const ny = (lIndex / (numActive - 1 || 1)) - 0.5;

          const rad = (angle / 100) * Math.PI;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rotatedX = nx * cos - ny * sin + 0.5;
          const rotatedY = nx * sin + ny * cos + 0.5;

          let active = false;
          const thickness = 0.05 + (amount / 100) * 0.4;

          switch (shape) {
            case "x":
              active = Math.abs(rotatedX - rotatedY) < thickness || Math.abs(rotatedX + rotatedY - 1) < thickness;
              break;
            case "triangle":
              active = Math.abs(Math.abs(rotatedX - 0.5) * 2 - rotatedY) < thickness;
              break;
            case "diamond":
              active = Math.abs(rotatedX - 0.5) + Math.abs(rotatedY - 0.5) >= (0.5 - thickness) && Math.abs(rotatedX - 0.5) + Math.abs(rotatedY - 0.5) < 0.5;
              break;
            case "funnel":
              active = Math.abs((Math.abs(rotatedY - 0.5) * 2) - rotatedX) < thickness ||
                       Math.abs((Math.abs(rotatedY - 0.5) * 2) + rotatedX - 1) < thickness;
              break;
          }

          if (active) setStep(lIndex, step, 1);
        });
      }
      break;
    }

    case "sweep": {
      const { direction, slope, amount, repeat } = config.config;
      const skew = slope / 50;
      const thickness = (amount / 100) * 0.3;

      for (let step = 0; step < maxSteps; step++) {
        activeLayers.forEach((_, lIndex) => {
          const normX = step / maxSteps;
          const normY = lIndex / numActive;

          let sweepVal = 0;
          if (direction === "right") sweepVal = normX - normY * skew;
          if (direction === "left") sweepVal = (1 - normX) - normY * skew;
          if (direction === "down") sweepVal = normY - normX * skew;
          if (direction === "up") sweepVal = (1 - normY) - normX * skew;

          const evalVal = repeat ? Math.abs(sweepVal % 0.5) : Math.abs(sweepVal - (skew / 2));

          if (evalVal < thickness) {
            setStep(lIndex, step, 1);
          }
        });
      }
      break;
    }

    case "block": {
      // Beat-aligned vertical stacks
      const { timing, amount, variation } = config.config;

      // Infer fps from pattern length and typical duration
      // Layers all share the same fps; derive it from pattern length assuming 8s default
      // We use maxSteps directly: framesPerBeat = fps (1 beat per second)
      // Since we don't have fps here, we compute beat boundaries from maxSteps and timing
      // Assume the pattern length represents the full duration at 30fps:
      // beat = maxSteps / durationSeconds, but we don't have duration.
      // Best approach: treat 1 beat = 30 frames (matching grid's 4 cells/sec at 30fps = 1 beat/sec)
      const framesPerBeat = 30;
      const framesPerGroup =
        timing === "quarter-beat" ? Math.round(framesPerBeat / 4) :
        timing === "half-beat"   ? Math.round(framesPerBeat / 2) :
                                   framesPerBeat; // "beat"

      const stackHeight = Math.max(1, Math.round((amount / 100) * numActive));

      for (let beatStart = 0; beatStart < maxSteps; beatStart += framesPerGroup) {
        // Pick Y offset using seeded PRNG based on beat index and variation
        const beatIndex = Math.floor(beatStart / framesPerGroup);
        const prng = Math.sin(beatIndex * 7.391 + variation * 0.137) * 10000;
        const rand = prng - Math.floor(prng);
        const maxOffset = Math.max(0, numActive - stackHeight);
        const yOffset = Math.floor(rand * (maxOffset + 1));

        // Activate stackHeight consecutive layers starting at yOffset
        for (let i = 0; i < stackHeight; i++) {
          const lIndex = yOffset + i;
          if (lIndex >= numActive) break;
          const layer = activeLayers[lIndex];
          // Fill the full group span
          const endFrame = Math.min(beatStart + framesPerGroup, layer.pattern.length);
          for (let f = beatStart; f < endFrame; f++) {
            result[layer.id][f] = 1;
          }
        }
      }
      break;
    }

    case "chaser": {
      const { steps, stride, repeat } = config.config;
      const safeSteps = Math.max(1, steps);
      const skipX = Math.max(1, Math.floor((stride / 100) * 16));

      const loopCount = repeat ? Math.ceil(maxSteps / (safeSteps * skipX)) : 1;

      for (let loop = 0; loop < loopCount; loop++) {
        let currentY = 0;
        const loopOffset = loop * (safeSteps * skipX);

        for (let i = 0; i < safeSteps; i++) {
          const stepX = loopOffset + (i * skipX);
          if (stepX < maxSteps) {
            setStep(currentY, stepX, 1);
            currentY = (currentY + 1) % numActive;
          }
        }
      }
      break;
    }

    case "shapes": {
      // Beat-aligned directional shapes (arrows, chevrons, lines, waves)
      const { shape, period, width } = config.config;

      // 1 beat = 30 frames, period = 4 or 8 beats
      const framesPerBeat = 30;
      const framesPerCycle = period * framesPerBeat;
      const bandWidth = Math.max(1, Math.round((width / 100) * numActive));

      for (let beatStart = 0; beatStart < maxSteps; beatStart += framesPerBeat) {
        // Progress through the cycle (0 to 1)
        const cycleFrame = beatStart % framesPerCycle;
        const progress = cycleFrame / framesPerCycle; // 0..1 through cycle

        let centerY: number;

        switch (shape) {
          case "arrow-up":
            // Staircase: starts at bottom, climbs to top over the period
            centerY = (numActive - 1) * (1 - progress);
            break;
          case "arrow-down":
            // Staircase: starts at top, falls to bottom over the period
            centerY = (numActive - 1) * progress;
            break;
          case "chevron": {
            // V-shape: goes down first half, back up second half
            const half = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
            centerY = (numActive - 1) * half;
            break;
          }
          case "line":
            // All layers at once — center band stays fixed
            centerY = (numActive - 1) / 2;
            break;
          case "wave":
            // Sinusoidal movement
            centerY = ((Math.sin(progress * Math.PI * 2) + 1) / 2) * (numActive - 1);
            break;
          default:
            centerY = (numActive - 1) / 2;
        }

        // Activate a band of `bandWidth` layers centred on centerY
        const halfBand = (bandWidth - 1) / 2;
        const layerStart = Math.max(0, Math.round(centerY - halfBand));
        const layerEnd = Math.min(numActive - 1, Math.round(centerY + halfBand));

        for (let lIndex = layerStart; lIndex <= layerEnd; lIndex++) {
          const layer = activeLayers[lIndex];
          const endFrame = Math.min(beatStart + framesPerBeat, layer.pattern.length);
          for (let f = beatStart; f < endFrame; f++) {
            result[layer.id][f] = 1;
          }
        }
      }
      break;
    }

    case "ramp": {
      const { amount, direction } = config.config;
      const probMax = amount / 100;

      for (let step = 0; step < maxSteps; step++) {
        const normX = step / (maxSteps - 1 || 1);
        const rampProb = direction === "in" ? normX * probMax : (1 - normX) * probMax;

        activeLayers.forEach((_, lIndex) => {
          const threshold = (lIndex / numActive) * 0.5 + 0.25;
          const prng = Math.sin(lIndex * 0.5 + step * 0.1) * 10;

          if ((prng - Math.floor(prng)) * threshold < rampProb) {
            setStep(lIndex, step, 1);
          }
        });
      }
      break;
    }
  }

  return result;
}
