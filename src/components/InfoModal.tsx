import { useState, useEffect } from "react";
import { useSequencerStore } from "../store/useSequencerStore";

declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
  const projectName = useSequencerStore(s => s.projectName);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
        }
      } catch {
        // Silent — updater may not be available in dev
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#e89f41]/30 rounded-lg p-6 min-w-[320px] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[#e89f41] text-sm font-bold uppercase tracking-widest">STEP It Out</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg transition-colors">&times;</button>
        </div>

        <div className="space-y-3 text-[11px] tracking-wide">
          <div className="flex justify-between">
            <span className="text-white/40 uppercase">Project</span>
            <span className="text-white">{projectName || "Untitled"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40 uppercase">Version</span>
            <span className="text-[#e89f41] font-bold">v{APP_VERSION}</span>
          </div>
          {updateVersion && (
            <div className="flex justify-between">
              <span className="text-white/40 uppercase">Update Available</span>
              <span className="text-green-400 font-bold">v{updateVersion}</span>
            </div>
          )}
          {!updateVersion && (
            <div className="flex justify-between">
              <span className="text-white/40 uppercase">Status</span>
              <span className="text-white/60">Up to date</span>
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-white/20 text-center uppercase tracking-widest">
          Boxcat Studio
        </div>
      </div>
    </div>
  );
}
