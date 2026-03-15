import type { GeneratorConfig, LightLayer } from "../types";

export function generateGridPatterns(
  config: GeneratorConfig,
  layers: LightLayer[]
): Record<string, number[]> {
  const numLayers = layers.length;
  const result: Record<string, number[]> = {};
  
  if (numLayers === 0) return result;

  // Initialize empty patterns
  layers.forEach(l => {
    result[l.id] = new Array(l.pattern.length).fill(0);
  });

  const maxSteps = Math.max(...layers.map(l => l.pattern.length));
  
  // Helper to ensure step is within a layer's range
  const setStep = (lIndex: number, step: number, value: number = 1) => {
    if (lIndex >= 0 && lIndex < numLayers) {
      const layer = layers[lIndex];
      const mappedStep = Math.floor((step / maxSteps) * layer.pattern.length);
      if (mappedStep >= 0 && mappedStep < layer.pattern.length) {
        result[layer.id][mappedStep] = value;
      }
    }
  };

  switch (config.type) {
    case "random": {
      const { density, variation } = config.config;
      // Use an exponential curve so lower density values feel appropriately sparse
      const probability = Math.pow(density / 100, 2);
      
      layers.forEach((l, lIndex) => {
        for (let i = 0; i < l.pattern.length; i++) {
          // Better pseudo-random uniform distribution
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
      const { width, speed } = config.config; // width 1-100, speed 1-100
      const freq = speed / 10;
      const spread = width / 100; // determines how thick the wave is
      
      for (let step = 0; step < maxSteps; step++) {
        const normalizedY = (Math.sin((step / maxSteps) * Math.PI * 2 * freq) + 1) / 2;
        const centerThrust = normalizedY * (numLayers - 1);
        
        layers.forEach((_, lIndex) => {
          // If within the "width" proximity, activate
          const distance = Math.abs(lIndex - centerThrust);
          if (distance <= spread * numLayers) {
            setStep(lIndex, step, 1);
          }
        });
      }
      break;
    }

    case "mirror": {
      const { shape, amount, angle } = config.config;
      
      for (let step = 0; step < maxSteps; step++) {
        layers.forEach((_, lIndex) => {
          // Normalize coordinates -0.5 to 0.5 for rotation math
          const nx = (step / (maxSteps - 1 || 1)) - 0.5;
          const ny = (lIndex / (numLayers - 1 || 1)) - 0.5;
          
          // Apply rotation based on angle (0-100 mapped to 0-180 degrees)
          const rad = (angle / 100) * Math.PI;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rotatedX = nx * cos - ny * sin + 0.5;
          const rotatedY = nx * sin + ny * cos + 0.5;
          
          let active = false;
          // Scale amount to a usable thickness
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
        layers.forEach((_, lIndex) => {
          const normX = step / maxSteps;
          const normY = lIndex / numLayers;
          
          let sweepVal = 0;
          if (direction === "right") sweepVal = normX - normY * skew;
          if (direction === "left") sweepVal = (1 - normX) - normY * skew;
          if (direction === "down") sweepVal = normY - normX * skew;
          if (direction === "up") sweepVal = (1 - normY) - normX * skew;
          
          // If repeating, evaluate modulo 0.5. If not repeating, only evaluate the first wave cleanly centered around 0.5 or 0
          const evalVal = repeat ? Math.abs(sweepVal % 0.5) : Math.abs(sweepVal - (skew/2));
          
          if (evalVal < thickness) {
             setStep(lIndex, step, 1);
          }
        });
      }
      break;
    }

    case "block": {
      const { spacing, shuffle } = config.config;
      const skip = Math.max(1, Math.floor((spacing / 100) * 16));
      
      // Determine the fps visually from the grid by peeking the layer config. 
      // All layers share the same timeline duration, so fps = duration / pattern length
      // Default to 60 as a fallback. We essentially want to cluster changes per "second" mathematically
      // The store handles the 'sequence' data but here we only have layers
      // Assuming typical 60fps timeline:
      const framesPerSecond = 60;
      let currentSecond = -1;
      let startY = Math.floor(numLayers / 2) - 1;

      for (let step = 0; step < maxSteps; step += skip) {
        // Every second (60 frames), recalculate the Y shuffle to match the user request for 
        // "every second shuffle on Y" for clean rows.
        const secIndex = Math.floor(step / framesPerSecond);
        
        if (secIndex !== currentSecond) {
            currentSecond = secIndex;
            startY = Math.floor(numLayers / 2) - 1;
            
            if (shuffle > 0) {
              const prng = Math.sin(secIndex * 1.123) * 10000;
              const rand = prng - Math.floor(prng);
              const shiftRange = Math.floor((shuffle / 100) * (numLayers - 1));
              startY += Math.floor(rand * shiftRange) - Math.floor(shiftRange / 2);
            }
            startY = Math.max(0, Math.min(startY, numLayers - 2));
        }
        
        // draw 2x2
        setStep(startY, step, 1);
        setStep(startY + 1, step, 1);
        if (step + 1 < maxSteps) {
          setStep(startY, step + 1, 1);
          setStep(startY + 1, step + 1, 1);
        }
      }
      break;
    }

    case "chaser": {
      const { steps, stride, repeat } = config.config;
      // Stride of 0 means skipX is 0, which would break loopCount/loopOffset if steps is >0, 
      // but if steps is 0, loopCount breaks. Force minimums safely:
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
               currentY = (currentY + 1) % numLayers;
            }
          }
      }
      break;
    }

    case "ramp": {
      const { amount, direction } = config.config;
      // A cleaner, simpler grid distribution
      
      const probMax = amount / 100;
      
      for (let step = 0; step < maxSteps; step++) {
        const normX = step / (maxSteps - 1 || 1);
        const rampProb = direction === "in" ? normX * probMax : (1 - normX) * probMax;
        
        layers.forEach((_, lIndex) => {
           // We map the density smoothly across layers with a slight structural scatter
           // instead of pure chaos, providing a visible ramp in structure
           const threshold = (lIndex / numLayers) * 0.5 + 0.25;
           
           // Scatter randomly along the threshold mapping
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

