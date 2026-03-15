import { ExportProgress as ProgressData } from "../engine/exporter";

interface ExportProgressProps {
  progress: ProgressData | null;
  onClose: () => void;
}

export function ExportProgressModal({ progress, onClose }: ExportProgressProps) {
  if (!progress) return null;

  const percentage = Math.round(progress.progress * 100);
  const isDone = progress.phase === "done" || progress.phase === "error";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#111] border border-[#333] rounded-lg p-6 w-[400px] shadow-2xl flex flex-col gap-4">
        <h2 className="text-[#e89f41] font-bold tracking-widest uppercase text-sm">
          {progress.phase === "error" ? "Export Failed" : "Exporting MP4"}
        </h2>
        
        <div className="text-white/70 text-xs">
          {progress.message || `Phase: ${progress.phase}`}
        </div>

        <div className="h-2 w-full bg-[#222] rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${progress.phase === "error" ? "bg-red-500" : "bg-[#e89f41]"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-bold text-white/50 tracking-widest">
          <span>{percentage}%</span>
          {isDone ? (
            <button 
              onClick={onClose}
              className="text-[#e89f41] hover:text-white uppercase px-3 py-1 bg-white/5 hover:bg-white/10 rounded transition-colors"
            >
              Close
            </button>
          ) : (
            <button 
              onClick={() => {
                if (window.__cancelExport) {
                  window.__cancelExport();
                }
                onClose();
              }}
              className="text-red-400 hover:text-red-300 uppercase px-3 py-1 bg-red-900/20 hover:bg-red-900/40 rounded transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
