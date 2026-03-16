import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type {
  LightLayer,
  StepSequence,
  GeneratorConfig,
  LayerGroup,
} from "../types";
import { generateGridPatterns } from "../engine/patterns";
import { getTotalFrames } from "../engine/frameMath";

export function hasNonZeroPatterns(lights: LightLayer[]): boolean {
  return lights.some(l => l.pattern.some(v => v !== 0));
}

function generateId(): string {
  return `light-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createDefaultLayer(name: string, filePath: string): LightLayer {
  return {
    id: generateId(),
    name,
    filePath,
    division: 5,
    pattern: [],
    attack: 2,
    decay: 6,
    intensity: 1,
    curve: "pulse",
  };
}

import type { Division } from "../types";

type PatternBank = {
  durationSeconds: number;
  layers: Record<string, {
    pattern: number[];
    division: Division;
    attack?: number;
    decay?: number;
  }>;
  lastAppliedGenerator?: string | null;
  groups?: LayerGroup[];
};

type UndoableState = {
  sequence: StepSequence;
  sequenceBank: Array<PatternBank | null>;
  activeBankSlot: number;
};

const GROUP_COLORS = ["#4a9eff", "#7cfc00", "#ff6b6b", "#c084fc", "#f97316", "#06b6d4", "#84cc16", "#f43f5e"];

interface SequencerState {
  projectName: string;
  sequence: StepSequence;
  sequenceBank: Array<PatternBank | null>;
  activeBankSlot: number;
  currentFrame: number;
  isPlaying: boolean;
  selectedLayerId: string | null;
  lastAppliedGenerator: string | null;
  groups: LayerGroup[];
  selectedGroupId: string | null;
  selectedLayerIds: string[];
  past: UndoableState[];
  future: UndoableState[];
}

interface SequencerActions {
  setFps: (fps: number) => void;
  setDurationSeconds: (duration: number) => void;
  addLight: (name: string, filePath: string) => void;
  addLights: (items: Array<{ name: string; filePath: string }>) => void;
  removeLight: (id: string) => void;
  updateLight: (id: string, updates: Partial<LightLayer>) => void;
  setGlobalControl: (key: keyof LightLayer, value: any) => void;
  setFrameTrigger: (lightId: string, frameIndex: number, value: number) => void;
  setCellRange: (lightId: string, startFrame: number, span: number, value: number) => void;
  toggleMute: (lightId: string) => void;
  createGroup: (name: string, layerIds: string[]) => void;
  deleteGroup: (groupId: string) => void;
  renameGroup: (groupId: string, name: string) => void;
  setSelectedGroup: (groupId: string | null) => void;
  toggleLayerMultiSelect: (layerId: string) => void;
  clearLayerMultiSelect: () => void;
  removeLayerFromGroup: (layerId: string) => void;
  setGroupControl: (groupId: string, attack: number, decay: number) => void;
  applyLiveGenerator: (config: GeneratorConfig) => void;
  setCurrentFrame: (frame: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedLayer: (id: string | null) => void;
  setProjectName: (name: string) => void;
  loadSequence: (data: { seq: StepSequence, bank?: Array<PatternBank | null>, activeSlot?: number, projectName?: string, groups?: LayerGroup[] }) => void;
  resetSequence: () => void;
  switchBankSlot: (slotIndex: number) => void;
  clearAll: (shiftKey: boolean) => void;
  debugPopulateLayers: () => void;
  commitUndoSnapshot: () => void;
  undo: () => void;
  redo: () => void;
}

const defaultSequence: StepSequence = {
  fps: 30,
  durationSeconds: 8,
  lights: [], // Empty state requested by user
};

export const useSequencerStore = create<SequencerState & SequencerActions>(
  (set, get) => ({
    projectName: "",
    sequence: defaultSequence,
    sequenceBank: new Array(32).fill(null),
    activeBankSlot: 0,
    currentFrame: 0,
    isPlaying: false,
    selectedLayerId: null,
    lastAppliedGenerator: null,
    groups: [],
    selectedGroupId: null,
    selectedLayerIds: [],
    past: [],
    future: [],

    setProjectName: (name) => set({ projectName: name }),

    commitUndoSnapshot: () => set((state) => {
      // Targeted structural sharing: only deep-clone the active sequence memory.
      // The other 31 untouched bank slots pass their references instantly without cloning.
      const newBank = state.sequenceBank.map((bank, index) => {
        if (index !== state.activeBankSlot || !bank) return bank;
        const clonedLayers: Record<string, any> = {};
        for (const [key, value] of Object.entries(bank.layers)) {
           clonedLayers[key] = {
             pattern: [...value.pattern],
             division: value.division,
             attack: value.attack,
             decay: value.decay
           };
        }
        return {
           durationSeconds: bank.durationSeconds,
           layers: clonedLayers
        };
      });

      const snapshot: UndoableState = {
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map(l => ({ ...l, pattern: [...l.pattern] }))
        },
        sequenceBank: newBank,
        activeBankSlot: state.activeBankSlot
      };
      // Keep only up to 50 undos to protect memory linearly
      const newPast = [...state.past, snapshot];
      if (newPast.length > 50) newPast.shift();

      return {
        past: newPast,
        future: []
      };
    }),

    undo: () => set((state) => {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      const currentSnapshot: UndoableState = {
        sequence: state.sequence,
        sequenceBank: state.sequenceBank,
        activeBankSlot: state.activeBankSlot
      };
      return {
         past: newPast,
         future: [...state.future, currentSnapshot],
         sequence: previous.sequence,
         sequenceBank: previous.sequenceBank,
         activeBankSlot: previous.activeBankSlot,
      };
    }),

    redo: () => set((state) => {
      if (state.future.length === 0) return state;
      const next = state.future[state.future.length - 1];
      const newFuture = state.future.slice(0, state.future.length - 1);
      const currentSnapshot: UndoableState = {
        sequence: state.sequence,
        sequenceBank: state.sequenceBank,
        activeBankSlot: state.activeBankSlot
      };
      return {
         past: [...state.past, currentSnapshot],
         future: newFuture,
         sequence: next.sequence,
         sequenceBank: next.sequenceBank,
         activeBankSlot: next.activeBankSlot,
      };
    }),

    setFps: (fps) => {
      get().commitUndoSnapshot();
      set((state) => {
        const { durationSeconds } = state.sequence;
        const newFrames = getTotalFrames(durationSeconds, fps);
        return {
          sequence: {
            ...state.sequence,
            fps,
            lights: state.sequence.lights.map((l) => {
              const oldFrames = l.pattern.length;
              if (newFrames === oldFrames) return l;
              
              const newPattern = new Array(newFrames).fill(0);
              for (let i = 0; i < Math.min(oldFrames, newFrames); i++) {
                newPattern[i] = l.pattern[i];
              }
              return { ...l, pattern: newPattern };
            })
          },
        };
      });
    },

    setDurationSeconds: (durationSeconds) => {
      get().commitUndoSnapshot();
      set((state) => {
        const { fps } = state.sequence;
        const newFrames = getTotalFrames(durationSeconds, fps);
        return {
          sequence: {
            ...state.sequence,
            durationSeconds,
            lights: state.sequence.lights.map((l) => {
              const oldFrames = l.pattern.length;
              if (newFrames === oldFrames) return l;
              
              const newPattern = new Array(newFrames).fill(0);
              for (let i = 0; i < Math.min(oldFrames, newFrames); i++) {
                newPattern[i] = l.pattern[i];
              }
              return { ...l, pattern: newPattern };
            })
          },
        };
      });
    },

    addLight: (name, filePath) => {
      get().commitUndoSnapshot();
      set((state) => {
        const layer = createDefaultLayer(name, filePath);
        const frames = getTotalFrames(state.sequence.durationSeconds, state.sequence.fps);
        layer.pattern = new Array(frames).fill(0);
        return {
          sequence: {
            ...state.sequence,
            lights: [...state.sequence.lights, layer],
          },
          selectedLayerId: layer.id,
        };
      });
    },

    addLights: (items) => {
      get().commitUndoSnapshot();
      set((state) => {
        const { durationSeconds, fps } = state.sequence;
        const newLights = items.map(({ name, filePath }) => {
          const layer = createDefaultLayer(name, filePath);
          const frames = getTotalFrames(durationSeconds, fps);
          layer.pattern = new Array(frames).fill(0);
          return layer;
        });
        const lastId = newLights.length > 0 ? newLights[newLights.length - 1].id : null;
        return {
          sequence: {
            ...state.sequence,
            lights: [...state.sequence.lights, ...newLights],
          },
          selectedLayerId: lastId,
        };
      });
    },

    removeLight: (id) => {
      get().commitUndoSnapshot();
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.filter((l) => l.id !== id),
        },
        selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
        selectedLayerIds: state.selectedLayerIds.filter(lid => lid !== id),
        groups: state.groups.map(g => ({ ...g, layerIds: g.layerIds.filter(lid => lid !== id) })),
      }));
    },

    updateLight: (id, updates) =>
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map((l) => (l.id === id ? { ...l, ...updates } : l)),
        },
      })),

    setGlobalControl: (key, value) =>
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map((l) => ({ ...l, [key]: value } as LightLayer)),
        },
      })),

    setFrameTrigger: (lightId, frameIndex, value) =>
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map((l) => {
            if (l.id !== lightId) return l;
            const next = [...l.pattern];
            next[frameIndex] = value;
            return { ...l, pattern: next };
          }),
        },
      })),

    setCellRange: (lightId, startFrame, span, value) =>
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map((l) => {
            if (l.id !== lightId) return l;
            const next = [...l.pattern];
            for (let f = startFrame; f < Math.min(startFrame + span, next.length); f++) {
              next[f] = value;
            }
            return { ...l, pattern: next };
          }),
        },
      })),

    toggleMute: (lightId) =>
      set((state) => ({
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map((l) =>
            l.id === lightId ? { ...l, muted: !l.muted } : l
          ),
        },
      })),

    createGroup: (name, layerIds) =>
      set((state) => ({
        groups: [
          ...state.groups,
          {
            id: `group-${Date.now()}`,
            name,
            color: GROUP_COLORS[state.groups.length % GROUP_COLORS.length],
            layerIds,
          },
        ],
        selectedLayerIds: [],
      })),

    deleteGroup: (groupId) =>
      set((state) => ({
        groups: state.groups.filter(g => g.id !== groupId),
        selectedGroupId: state.selectedGroupId === groupId ? null : state.selectedGroupId,
      })),

    renameGroup: (groupId, name) =>
      set((state) => ({
        groups: state.groups.map(g => g.id === groupId ? { ...g, name } : g),
      })),

    setSelectedGroup: (groupId) => set({ selectedGroupId: groupId }),

    toggleLayerMultiSelect: (layerId) =>
      set((state) => ({
        selectedLayerIds: state.selectedLayerIds.includes(layerId)
          ? state.selectedLayerIds.filter(id => id !== layerId)
          : [...state.selectedLayerIds, layerId],
      })),

    clearLayerMultiSelect: () => set({ selectedLayerIds: [] }),

    removeLayerFromGroup: (layerId) =>
      set((state) => ({
        groups: state.groups.map(g => ({
          ...g,
          layerIds: g.layerIds.filter(id => id !== layerId),
        })),
      })),

    setGroupControl: (groupId, attack, decay) =>
      set((state) => {
        const group = state.groups.find(g => g.id === groupId);
        if (!group) return state;
        return {
          groups: state.groups.map(g =>
            g.id === groupId ? { ...g, attack, decay } : g
          ),
          sequence: {
            ...state.sequence,
            lights: state.sequence.lights.map(l =>
              group.layerIds.includes(l.id) ? { ...l, attack, decay } : l
            ),
          },
        };
      }),

    applyLiveGenerator: (config) => {
      get().commitUndoSnapshot();
      set((state) => {
        const { selectedGroupId, groups } = state;
        let targetLayers = state.sequence.lights;
        if (selectedGroupId) {
          const group = groups.find(g => g.id === selectedGroupId);
          if (group) {
            targetLayers = state.sequence.lights.filter(l => group.layerIds.includes(l.id));
          }
        }

        const generatedPatterns = generateGridPatterns(config, targetLayers);

        return {
          sequence: {
            ...state.sequence,
            lights: state.sequence.lights.map((l) => {
              if (generatedPatterns[l.id]) {
                return { ...l, pattern: generatedPatterns[l.id] };
              }
              return l;
            }),
          },
          lastAppliedGenerator: config.type,
        };
      });
    },

    setCurrentFrame: (frame) => set({ currentFrame: frame }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),
    loadSequence: ({ seq, bank, activeSlot, projectName, groups }) => {
      get().commitUndoSnapshot();
      set((state) => ({
        sequence: seq,
        sequenceBank: bank || state.sequenceBank,
        activeBankSlot: activeSlot ?? state.activeBankSlot,
        projectName: projectName ?? state.projectName,
        groups: groups ?? state.groups,
      }));
    },
    resetSequence: () => {
      get().commitUndoSnapshot();
      set({ sequence: defaultSequence });
    },
    debugPopulateLayers: () => {
      get().commitUndoSnapshot();
      set((state) => {
      const { durationSeconds, fps } = state.sequence;
      const frames = getTotalFrames(durationSeconds, fps);
      const newLights = Array.from({ length: 8 }).map((_, i) => {
        const layer = createDefaultLayer(`test_clip_${i + 1}`, `/test_clip_${i + 1}.png`);
        layer.pattern = new Array(frames).fill(0);
        layer.division = 5;
        // Inject a unique sparse placeholder logic
        for (let f = 0; f < frames; f += (15 + i * 5)) {
          if (f < frames) layer.pattern[f] = 1;
        }
        return layer;
      });
      return {
        sequence: {
          ...state.sequence,
          lights: [...state.sequence.lights, ...newLights].slice(0, 16) // soft cap
        }
      };
      });
    },

    clearAll: (shiftKey) => {
      get().commitUndoSnapshot();
      set((state) => {
      if (shiftKey) {
        return {
          sequence: { ...state.sequence, lights: [] },
          selectedLayerId: null
        };
      }
      return {
        sequence: {
          ...state.sequence,
          lights: state.sequence.lights.map(l => ({ ...l, pattern: new Array(l.pattern.length).fill(0) }))
        }
      };
      });
    },
    switchBankSlot: (slotIndex) => {
      get().commitUndoSnapshot();
      set((state) => {
        if (state.activeBankSlot === slotIndex) return state;

        // Auto-save current sequence patterns into current slot (only if non-empty)
        const newBank = [...state.sequenceBank];

        if (hasNonZeroPatterns(state.sequence.lights)) {
          const currentLayers: Record<string, { pattern: number[]; division: import("../types").Division; attack: number; decay: number; }> = {};
          state.sequence.lights.forEach(l => {
            currentLayers[l.id] = { pattern: [...l.pattern], division: l.division, attack: l.attack, decay: l.decay };
          });
          newBank[state.activeBankSlot] = {
            durationSeconds: state.sequence.durationSeconds,
            layers: currentLayers,
            lastAppliedGenerator: state.lastAppliedGenerator,
            groups: state.groups,
          };
        } else {
          newBank[state.activeBankSlot] = null;
        }

        let nextSequence = { ...state.sequence };
        
        if (newBank[slotIndex] !== null) {
          // Load existing slot patterns onto current layers
          const loadedBank = newBank[slotIndex] as PatternBank;
          
          nextSequence.durationSeconds = loadedBank.durationSeconds;
          const newFrames = getTotalFrames(nextSequence.durationSeconds, nextSequence.fps);

          nextSequence.lights = state.sequence.lights.map(l => {
            if (loadedBank.layers[l.id]) {
              const savedLayer = loadedBank.layers[l.id];
              return { 
                ...l, 
                pattern: [...savedLayer.pattern],
                division: savedLayer.division,
                attack: savedLayer.attack || l.attack,
                decay: savedLayer.decay || l.decay
              };
            } else {
              return { ...l, pattern: new Array(newFrames).fill(0) };
            }
          });
        } else {
          // Empty slot initializes cleanly
          const newFrames = getTotalFrames(nextSequence.durationSeconds, nextSequence.fps);
          nextSequence.lights = state.sequence.lights.map(l => ({
            ...l,
            pattern: new Array(newFrames).fill(0),
            attack: 2,
            decay: 6
          }));
        }

        const loadedGen = newBank[slotIndex]?.lastAppliedGenerator ?? null;
        const loadedGroups = newBank[slotIndex]?.groups ?? [];

        return {
          sequenceBank: newBank,
          activeBankSlot: slotIndex,
          sequence: nextSequence,
          lastAppliedGenerator: loadedGen,
          groups: loadedGroups,
          selectedGroupId: null,
        };
      });
    },
  })
);

let autoSaveTimeout: ReturnType<typeof setTimeout>;

export const initStorePersistence = async () => {
  try {
    const dataStr = await invoke<string>("auto_load_state");
    if (dataStr) {
      const data = JSON.parse(dataStr);
      useSequencerStore.setState({
         projectName: data.projectName || "",
         sequence: data.sequence,
         sequenceBank: data.sequenceBank,
         activeBankSlot: data.activeBankSlot || 0,
         groups: data.groups || [],
      });
    }
  } catch(e) {
    // No saved state found — fresh start
  }
  
  useSequencerStore.subscribe((state) => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
       const data = JSON.stringify({
         projectName: state.projectName,
         sequence: state.sequence,
         sequenceBank: state.sequenceBank,
         activeBankSlot: state.activeBankSlot,
         groups: state.groups,
       });
       invoke("auto_save_state", { stateJson: data }).catch(console.error);
    }, 500); 
  });
};
