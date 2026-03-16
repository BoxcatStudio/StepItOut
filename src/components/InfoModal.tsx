import { useState, useEffect } from "react";
import { useSequencerStore } from "../store/useSequencerStore";

declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

interface InfoModalProps {
  onClose: () => void;
}

export function InfoModal({ onClose }: InfoModalProps) {
  const projectName = useSequencerStore(s => s.projectName);

  type CheckStatus = "checking" | "up-to-date" | "available" | "error";
  type InstallStatus = "idle" | "installing" | "done";

  const [checkStatus, setCheckStatus] = useState<CheckStatus>("checking");
  const [checkError, setCheckError] = useState<string | null>(null);
  const [updateObj, setUpdateObj] = useState<any>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [installStatus, setInstallStatus] = useState<InstallStatus>("idle");
  const [installProgress, setInstallProgress] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update) {
          setUpdateVersion(update.version);
          setUpdateObj(update);
          setCheckStatus("available");
        } else {
          setCheckStatus("up-to-date");
        }
      } catch (e) {
        setCheckError(String(e));
        setCheckStatus("error");
      }
    })();
  }, []);

  const handleInstall = async () => {
    if (!updateObj || installStatus !== "idle") return;
    setInstallStatus("installing");
    setInstallProgress(0);
    try {
      let downloaded = 0;
      let total = 0;
      await updateObj.downloadAndInstall((event: any) => {
        if (event.event === "Started") {
          total = event.data?.contentLength ?? 0;
        } else if (event.event === "Progress") {
          downloaded += event.data?.chunkLength ?? 0;
          if (total > 0) setInstallProgress(Math.round((downloaded / total) * 100));
        } else if (event.event === "Finished") {
          setInstallProgress(100);
        }
      });
      setInstallStatus("done");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setCheckError(String(e));
      setCheckStatus("error");
      setInstallStatus("idle");
    }
  };

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

          {/* Update status row */}
          <div className="flex justify-between items-center">
            <span className="text-white/40 uppercase">Status</span>
            {checkStatus === "checking" && (
              <span className="text-white/30 animate-pulse">Checking...</span>
            )}
            {checkStatus === "up-to-date" && (
              <span className="text-white/60">Up to date</span>
            )}
            {checkStatus === "error" && (
              <span className="text-red-400/80">Check failed</span>
            )}
            {checkStatus === "available" && installStatus === "idle" && (
              <span className="text-green-400 font-bold">v{updateVersion} available</span>
            )}
            {installStatus === "installing" && (
              <span className="text-[#e89f41] font-bold">
                {installProgress < 100 ? `Downloading ${installProgress}%` : "Installing..."}
              </span>
            )}
            {installStatus === "done" && (
              <span className="text-green-400 font-bold">Restarting...</span>
            )}
          </div>

          {/* Error detail */}
          {checkStatus === "error" && checkError && (
            <div className="text-[8px] text-red-400/50 leading-relaxed break-all bg-black/30 rounded p-2">
              {checkError}
            </div>
          )}

          {/* Install button */}
          {checkStatus === "available" && installStatus === "idle" && (
            <button
              onClick={handleInstall}
              className="w-full mt-1 py-2 text-[10px] font-bold uppercase tracking-widest text-white bg-[#e89f41] hover:bg-[#d4913c] rounded transition-colors"
            >
              Install v{updateVersion}
            </button>
          )}

          {/* Progress bar */}
          {installStatus === "installing" && (
            <div className="w-full bg-black/40 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-[#e89f41] transition-all duration-300"
                style={{ width: `${installProgress}%` }}
              />
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
