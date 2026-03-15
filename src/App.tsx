import { SequencerGrid } from "./components/SequencerGrid";
import { TopBar } from "./components/TopBar";
import { BottomPanel } from "./components/BottomPanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useEffect, useState } from "react";
import { initStorePersistence, useSequencerStore } from "./store/useSequencerStore";
import { ExportProgressModal } from "./components/ExportProgress";
import { UpdateChecker } from "./components/UpdateChecker";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { TitleBar } from "./components/TitleBar";
import type { ExportProgress } from "./engine/exporter";
import { invoke } from "@tauri-apps/api/core";

function getNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "Light";
}

function App() {
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [previewLight, setPreviewLight] = useState<{ filePath: string; name: string } | null>(null);
  const { sequence } = useSequencerStore();

  useKeyboardShortcuts();

  useEffect(() => {
    initStorePersistence();
    window.__setExportProgress = setExportProgress;
    window.__showImagePreview = (filePath: string, name: string) => setPreviewLight({ filePath, name });
  }, []);

  return (
    <div className="h-screen w-screen bg-[#111] text-white flex flex-col overflow-hidden font-sans">
      <TitleBar />
      <TopBar />
      {sequence.lights.length > 0 ? (
        <>
          <div className="flex-[6] min-h-0 flex flex-col border-b border-white/10 z-10 bg-[#111]">
            <SequencerGrid />
          </div>
          <div className="flex-[4] min-h-[460px] bg-[#0a0a0a] flex flex-row relative z-20">
            <BottomPanel />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center relative">
          <button
            onClick={async () => {
              try {
                const paths = await invoke<string[]>("open_files_dialog");
                if (paths.length > 0) {
                  useSequencerStore.getState().addLights(paths.map((p) => ({
                    name: getNameFromPath(p),
                    filePath: p
                  })));
                }
              } catch (e) {
                console.error("Import failed:", e);
              }
            }}
            className="text-white/30 text-lg font-bold uppercase tracking-widest hover:text-[#e89f41] transition-colors"
          >
            Load clips to begin
          </button>
        </div>
      )}

      {/* Modals and Overlays */}
      <ExportProgressModal
        progress={exportProgress}
        onClose={() => setExportProgress(null)}
      />
      {previewLight && (
        <ImagePreviewModal
          filePath={previewLight.filePath}
          name={previewLight.name}
          onClose={() => setPreviewLight(null)}
        />
      )}
      <UpdateChecker />
    </div>
  );
}

declare global {
  interface Window {
    __setExportProgress: (p: ExportProgress | null) => void;
    __cancelExport: () => void;
    __showImagePreview: (filePath: string, name: string) => void;
  }
}
window.__setExportProgress = () => {};
window.__cancelExport = () => {};
window.__showImagePreview = () => {};

export default App;
