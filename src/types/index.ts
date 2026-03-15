// Bars/BeatsPerBar removed in favor of strict duration + BPM

export type Division = 1 | 2 | 5 | 10 | 15 | 30;

export type CurvePreset =
  | "pulse"
  | "smooth"
  | "strobe"
  | "ramp"
  | "exponential"
  | "slow";

export interface LightLayer {
  id: string;
  name: string;
  filePath: string;
  division: Division;
  pattern: number[];
  attack: number;
  decay: number;
  intensity: number;
  curve: CurvePreset;
}

export interface StepSequence {
  fps: number;
  durationSeconds: number;
  lights: LightLayer[];
}

export type GeneratorType =
  | "random"
  | "wave"
  | "mirror"
  | "sweep"
  | "block"
  | "chaser"
  | "ramp";

export interface RandomConfig { density: number; variation: number; }
export interface WaveConfig { width: number; speed: number; }
export interface MirrorConfig { shape: "x" | "triangle" | "diamond" | "funnel"; amount: number; angle: number; }
export interface SweepConfig { direction: "left" | "right" | "up" | "down"; slope: number; amount: number; repeat: boolean; }
export interface BlockConfig { spacing: number; shuffle: number; }
export interface ChaserConfig { steps: number; stride: number; repeat: boolean; }
export interface RampConfig { amount: number; direction: "in" | "out"; }

export type GeneratorConfig =
  | { type: "random"; config: RandomConfig }
  | { type: "wave"; config: WaveConfig }
  | { type: "mirror"; config: MirrorConfig }
  | { type: "sweep"; config: SweepConfig }
  | { type: "block"; config: BlockConfig }
  | { type: "chaser"; config: ChaserConfig }
  | { type: "ramp"; config: RampConfig };
