import { useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; install: () => Promise<void> }
  | { status: "downloading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;

    async function checkForUpdate() {
      try {
        const update = await check();
        if (cancelled || !update) return;

        setState({
          status: "available",
          version: update.version,
          install: async () => {
            let totalBytes = 0;
            let downloadedBytes = 0;

            setState({ status: "downloading", progress: 0 });

            await update.downloadAndInstall((event) => {
              if (event.event === "Started" && event.data.contentLength) {
                totalBytes = event.data.contentLength;
              } else if (event.event === "Progress") {
                downloadedBytes += event.data.chunkLength;
                const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
                setState({ status: "downloading", progress });
              } else if (event.event === "Finished") {
                setState({ status: "ready" });
              }
            });

            setState({ status: "ready" });
          },
        });
      } catch (e) {
        if (!cancelled) {
          setState({ status: "error", message: String(e) });
        }
      }
    }

    checkForUpdate();
    return () => { cancelled = true; };
  }, []);

  if (state.status === "idle") return null;

  if (state.status === "available") {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1a1a1a] border border-[#e89f41]/50 rounded-lg p-4 shadow-lg z-50 max-w-xs">
        <p className="text-white text-sm font-medium mb-1">Update available</p>
        <p className="text-white/50 text-xs mb-3">Version {state.version} is ready to install.</p>
        <div className="flex gap-2">
          <button
            onClick={state.install}
            className="px-3 py-1 bg-[#e89f41] text-black text-xs font-bold rounded hover:bg-[#f0b05a] transition-colors"
          >
            Update now
          </button>
          <button
            onClick={() => setState({ status: "idle" })}
            className="px-3 py-1 bg-white/10 text-white/60 text-xs rounded hover:bg-white/20 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  if (state.status === "downloading") {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1a1a1a] border border-[#e89f41]/50 rounded-lg p-4 shadow-lg z-50 max-w-xs">
        <p className="text-white text-sm font-medium mb-2">Downloading update...</p>
        <div className="w-full bg-white/10 rounded-full h-1.5">
          <div
            className="bg-[#e89f41] h-1.5 rounded-full transition-all"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>
    );
  }

  if (state.status === "ready") {
    return (
      <div className="fixed bottom-4 right-4 bg-[#1a1a1a] border border-[#e89f41]/50 rounded-lg p-4 shadow-lg z-50 max-w-xs">
        <p className="text-white text-sm font-medium mb-2">Update ready</p>
        <p className="text-white/50 text-xs mb-3">Restart to apply the update.</p>
        <button
          onClick={() => relaunch()}
          className="px-3 py-1 bg-[#e89f41] text-black text-xs font-bold rounded hover:bg-[#f0b05a] transition-colors"
        >
          Restart now
        </button>
      </div>
    );
  }

  // error state — show briefly then hide
  if (state.status === "error") {
    return null; // Silent fail — don't bother user with update errors
  }

  return null;
}
