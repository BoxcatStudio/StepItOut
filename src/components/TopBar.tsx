import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useSequencerStore } from "../store/useSequencerStore";
import { getTotalFrames } from "../engine/frameMath";
import { startPlayback, stopPlayback } from "../engine/playback";
import { save } from "@tauri-apps/plugin-dialog";

function getNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "Light";
}

function TimeDisplay() {
  const currentFrame = useSequencerStore(s => s.currentFrame);
  const fps = useSequencerStore(s => s.sequence.fps);
  const s = String(Math.floor(currentFrame / fps)).padStart(2, "0");
  const f = String(currentFrame % fps).padStart(2, "0");
  return <span className="text-[#e89f41] font-bold text-[10px] tracking-widest uppercase">{s}s {f}f</span>;
}

export function TopBar() {
  const sequence = useSequencerStore(s => s.sequence);
  const addLights = useSequencerStore(s => s.addLights);
  const loadSequence = useSequencerStore(s => s.loadSequence);
  const isPlaying = useSequencerStore(s => s.isPlaying);
  const setIsPlaying = useSequencerStore(s => s.setIsPlaying);
  const setCurrentFrame = useSequencerStore(s => s.setCurrentFrame);
  const setFps = useSequencerStore(s => s.setFps);
  const setDurationSeconds = useSequencerStore(s => s.setDurationSeconds);
  const debugPopulateLayers = useSequencerStore(s => s.debugPopulateLayers);
  const sequenceBank = useSequencerStore(s => s.sequenceBank);
  const activeBankSlot = useSequencerStore(s => s.activeBankSlot);

  const totalFrames = getTotalFrames(sequence.durationSeconds, sequence.fps);

  useEffect(() => {
    if (isPlaying) {
      startPlayback(
        { fps: sequence.fps, totalFrames, initialFrame: useSequencerStore.getState().currentFrame },
        (frame) => setCurrentFrame(frame)
      );
    }
    return () => stopPlayback();
  }, [isPlaying, sequence.fps, totalFrames, setCurrentFrame]);

  const handleImport = async () => {
    try {
      const paths = await invoke<string[]>("open_files_dialog");
      if (paths.length > 0) {
        addLights(paths.map((p) => ({ name: getNameFromPath(p), filePath: p })));
      }
    } catch (e) {
      console.error("Import failed:", e);
    }
  };



  const handleLoad = async () => {
    try {
      const path = await invoke<string | null>("open_stepseq_dialog");
      if (path) {
        const data = await invoke<{
          fps: number;
          loop_seconds?: number;
          duration_seconds?: number;
          lights: Array<{
            id: string;
            name: string;
            file_path: string;
            division: string | number;
            pattern: number[];
            attack: number;
            decay: number;
            intensity: number;
            curve: string;
          }>;
          sequence_bank?: Array<any | null>;
          active_bank_slot?: number;
        }>("load_sequence", { path });

        const mappedBank = data.sequence_bank ? data.sequence_bank.map(bank => {
          if (!bank) return null;
          const mappedLayers: Record<string, any> = {};
          if (bank.layers) {
            Object.entries(bank.layers).forEach(([k, v]: [string, any]) => {
              mappedLayers[k] = {
                pattern: v.pattern,
                division: typeof v.division === 'string' ? 5 : v.division as import("../types").Division,
                attack: v.attack !== undefined && v.attack !== null ? v.attack : 2,
                decay: v.decay !== undefined && v.decay !== null ? v.decay : 6,
              };
            });
          }
          return {
            durationSeconds: bank.duration_seconds || data.loop_seconds || data.duration_seconds || 8,
            layers: mappedLayers
          };
        }) : undefined;
        
        loadSequence({
          seq: {
            fps: data.fps,
            durationSeconds: data.loop_seconds || data.duration_seconds || 8,
            lights: data.lights.map((l) => ({
              id: l.id,
              name: l.name,
              filePath: l.file_path,
              division: typeof l.division === 'string' ? 5 : l.division as import("../types").Division,
              pattern: l.pattern,
              attack: l.attack,
              decay: l.decay,
              intensity: l.intensity,
              curve: l.curve as import("../types").CurvePreset,
            })),
          },
          bank: mappedBank,
          activeSlot: data.active_bank_slot
        });
      }
    } catch (e) {
      console.error("Load failed:", e);
    }
  };

  const handleSave = async () => {
    try {
      const path = await invoke<string | null>("save_file_dialog", {
        default_name: "sequence.stepseq",
        filter_name: "STEP Projects",
        filter_ext: ["step", "stepseq"],
      });
      if (path) {
        // Force the active sequence into the sequenceBank payload to guarantee the 
        // current visual state is exactly what gets written to disk.
        const exportBank = [...sequenceBank];
        const currentLayers: Record<string, any> = {};
        sequence.lights.forEach(l => {
          currentLayers[l.id] = { pattern: [...l.pattern], division: l.division, attack: l.attack, decay: l.decay };
        });
        exportBank[activeBankSlot] = {
          durationSeconds: sequence.durationSeconds,
          layers: currentLayers,
        };

        const payloadSequenceBank = exportBank.map(bank => {
          if (!bank) return null;
          const layersObj: Record<string, any> = {};
          Object.entries(bank.layers).forEach(([layerId, l]) => {
            layersObj[layerId] = {
               pattern: l.pattern,
               division: String(l.division), // serialized as JSON Value downstream
               attack: l.attack,
               decay: l.decay
            };
          });
          return {
             duration_seconds: bank.durationSeconds,
             layers: layersObj
          };
        });

        const data = {
          fps: sequence.fps,
          loop_seconds: sequence.durationSeconds,
          lights: sequence.lights.map((l) => ({
            id: l.id,
            name: l.name,
            file_path: l.filePath,
            division: String(l.division),
            pattern: l.pattern,
            attack: l.attack,
            decay: l.decay,
            intensity: l.intensity,
            curve: l.curve,
          })),
          sequence_bank: payloadSequenceBank,
          active_bank_slot: activeBankSlot,
        };
        await invoke("save_sequence", { path, data });
      }
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  const handleExport = async () => {
    try {
      if (sequence.lights.length === 0) return;

      const path = await save({
        filters: [
          { name: "MP4 Video", extensions: ["mp4"] },
          { name: "STEP XML", extensions: ["xml"] }
        ],
        defaultPath: "sequence_export.mp4"
      });
      
      if (path) {
        if (path.toLowerCase().endsWith(".mp4")) {
            let width = 1920;
            let height = 1080;

            const firstPath = sequence.lights[0].filePath;
            try {
               const img = new Image();
               await new Promise<void>((resolve, reject) => {
                  img.onload = () => {
                   if (img.width && img.height) {
                       width = img.width;
                       height = img.height;
                       
                       const MAX_MP4_DIMENSION = 3840;
                       if (width > MAX_MP4_DIMENSION || height > MAX_MP4_DIMENSION) {
                           const scale = Math.min(MAX_MP4_DIMENSION / width, MAX_MP4_DIMENSION / height);
                           width = Math.round(width * scale);
                           height = Math.round(height * scale);
                       }

                       if (width % 2 !== 0) width -= 1;
                       if (height % 2 !== 0) height -= 1;
                    }
                    resolve();
                  };
                  img.onerror = reject;
                  
                  import("@tauri-apps/api/core").then(({ convertFileSrc, isTauri }) => {
                    if (isTauri()) {
                      try { img.src = convertFileSrc(firstPath); } catch { img.src = firstPath; }
                    } else { img.src = firstPath; }
                  }).catch(() => { img.src = firstPath; });
               });
            } catch (e) {
               console.warn("Could not determine actual resolution, using 1080p fallback");
            }

            const controller = new AbortController();
            window.__cancelExport = () => controller.abort();

            import("../engine/exporter").then(async ({ exportToMp4 }) => {
                const mp4Data = await exportToMp4({
                  sequence,
                  resolution: { width, height },
                  signal: controller.signal,
                  onProgress: (p) => {
                     if (window.__setExportProgress) {
                        window.__setExportProgress(p);
                     }
                  }
                });

                const { writeFile } = await import("@tauri-apps/plugin-fs");
                await writeFile(path, mp4Data);
                
                if (window.__setExportProgress) {
                    window.__setExportProgress({ phase: "done", progress: 1, message: `Saved to ${path}` });
                }
            }).catch(e => {
                console.error("Export failed during rendering/encoding:", e);
                if (String(e).includes("aborted")) {
                    if (window.__setExportProgress) window.__setExportProgress(null);
                    return;
                }
                if (window.__setExportProgress) {
                    window.__setExportProgress({ phase: "error", progress: 0, message: String(e) });
                }
            });
        } else if (path.toLowerCase().endsWith(".xml")) {
            // Build bank payload with current active state merged in
            const exportBank = [...sequenceBank];
            const currentLayers: Record<string, any> = {};
            sequence.lights.forEach(l => {
              currentLayers[l.id] = { pattern: [...l.pattern], division: l.division, attack: l.attack, decay: l.decay };
            });
            exportBank[activeBankSlot] = {
              durationSeconds: sequence.durationSeconds,
              layers: currentLayers,
            };

            const payloadSequenceBank = exportBank.map(bank => {
              if (!bank) return null;
              const layersObj: Record<string, any> = {};
              Object.entries(bank.layers).forEach(([layerId, l]) => {
                layersObj[layerId] = {
                  pattern: l.pattern,
                  division: String(l.division),
                  attack: l.attack,
                  decay: l.decay
                };
              });
              return {
                duration_seconds: bank.durationSeconds,
                layers: layersObj
              };
            });

            const data = {
              request: {
                sequence: {
                  fps: sequence.fps,
                  loop_seconds: sequence.durationSeconds,
                  lights: sequence.lights.map((l) => ({
                    id: l.id,
                    name: l.name,
                    file_path: l.filePath,
                    division: String(l.division),
                    pattern: l.pattern,
                    attack: l.attack,
                    decay: l.decay,
                    intensity: l.intensity,
                    curve: l.curve,
                  })),
                  sequence_bank: payloadSequenceBank,
                  active_bank_slot: activeBankSlot,
                },
                output_path: path,
              }
            };
            await invoke("export_to_premiere", data);
        }
      }
    } catch (e: any) {
      console.error("Export failed:", e);
      if (window.__setExportProgress) {
        window.__setExportProgress({ phase: "error", progress: 0, message: e.message || "Export failed" });
      }
    }
  };

  const isPausedNotZero = !isPlaying && useSequencerStore.getState().currentFrame > 0;

  return (
    <div className="flex flex-col shrink-0 font-sans tracking-wide bg-[#111] border-b border-[#0a0a0a] mb-[12px] shadow-[0_4px_10px_rgba(0,0,0,0.5)] z-50">
      <div className="flex items-center h-[44px] bg-[#0a0a0a] px-4 gap-5">
        
        {/* File Operations */}
        <div className="flex items-center gap-4">
          <button onClick={handleImport} className="text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors">Import</button>
          <button onClick={handleLoad} className="text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors">Load</button>
          <button onClick={handleSave} disabled={sequence.lights.length === 0} className="text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white disabled:opacity-30 transition-colors">Save</button>
          <button onClick={handleExport} disabled={sequence.lights.length === 0} className="text-[10px] font-bold uppercase tracking-widest text-[#e89f41]/70 hover:text-[#e89f41] disabled:opacity-30 transition-colors">Export</button>
        </div>

        {sequence.lights.length > 0 && (
          <>
            <div className="w-px h-3 bg-white/10" />

            {/* Timeline Settings */}
            <div className="flex items-center gap-4 text-[10px] font-bold text-[#e89f41] tracking-widest uppercase">
              <div className="flex items-center gap-1.5">
                <span className="text-white/30">FPS</span>
                <input type="number" min={1} max={120} value={sequence.fps} onChange={(e) => setFps(Number(e.target.value) || 30)} className="w-[32px] bg-transparent focus:outline-none text-center" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-white/30">DUR</span>
                <select value={sequence.durationSeconds} onChange={(e) => setDurationSeconds(Number(e.target.value))} className="bg-transparent focus:outline-none cursor-pointer text-center">
                  {[1, 2, 4, 8, 16, 32].map((s) => <option key={s} value={s} className="bg-[#111]">{s}s</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1" />

            {/* Transport Controls (Centered) */}
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsPlaying(true)} 
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isPlaying ? 'text-[#e89f41]' : 'text-white/50 hover:text-white'}`}
              >
                Play
              </button>
              <button 
                onClick={() => setIsPlaying(false)} 
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${isPausedNotZero ? 'text-white' : 'text-white/50 hover:text-white'}`}
              >
                Pause
              </button>
              <button 
                onClick={() => { setIsPlaying(false); setCurrentFrame(0); }} 
                className="text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-red-400 transition-colors"
              >
                Stop
              </button>
              
              <div className="w-px h-3 bg-white/10 mx-2" />

              {/* Current Time */}
              <div className="flex items-center justify-center min-w-[50px] text-center">
                <TimeDisplay />
              </div>
            </div>

            <div className="flex-1" />

            <div className="flex items-center">
               <button 
                 onClick={debugPopulateLayers}
                 className="text-[10px] font-bold uppercase tracking-widest text-white border border-[#e89f41]/50 bg-[#e89f41]/10 hover:bg-[#e89f41]/20 px-2 py-1 rounded transition-colors"
               >
                 DEBUG
               </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
