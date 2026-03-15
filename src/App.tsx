import { SequencerGrid } from "./components/SequencerGrid";
import { TopBar } from "./components/TopBar";
import { BottomPanel } from "./components/BottomPanel";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useEffect, useState } from "react";
import { initStorePersistence, useSequencerStore } from "./store/useSequencerStore";
import { ExportProgressModal } from "./components/ExportProgress";
import { UpdateChecker } from "./components/UpdateChecker";
import type { ExportProgress } from "./engine/exporter";
import { invoke } from "@tauri-apps/api/core";

function getNameFromPath(path: string): string {
  return path.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, "") ?? "Light";
}

function App() {
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const { sequence } = useSequencerStore();

  useKeyboardShortcuts();

  useEffect(() => {
    initStorePersistence();
    window.__setExportProgress = setExportProgress;
  }, []);

  return (
    <div className="h-screen w-screen bg-[#111] text-white flex flex-col overflow-hidden font-sans">
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
      <UpdateChecker />
    </div>
  );
}

// Attach a global way to dispatch export progress events without plumbing it through all props
// We could also put this in Zustand but since it's transient UI state, a global event works well.
declare global {
  interface Window {
    __setExportProgress: (p: ExportProgress | null) => void;
    __cancelExport: () => void;
  }
}
window.__setExportProgress = () => {
  // We'll hook this up in the App component to the state setter
};
window.__cancelExport = () => {};

export default App;
