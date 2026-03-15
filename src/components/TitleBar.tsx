import { getCurrentWindow } from "@tauri-apps/api/window";

declare const __APP_VERSION__: string;
const noDrag = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export function TitleBar() {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      className="h-8 bg-[#0a0a0a] flex items-center justify-between px-3 shrink-0 select-none border-b border-white/5"
    >
      {/* App Title */}
      <div className="flex items-center gap-2 pointer-events-none">
        <span className="text-[10px] font-bold text-[#e89f41]/80 uppercase tracking-[0.2em]">
          STEP It Out
        </span>
        <span className="text-[8px] text-white/20 font-mono">v{__APP_VERSION__}</span>
      </div>

      {/* Window Controls */}
      <div className="flex items-center gap-0.5" style={noDrag}>
        <button
          onClick={() => appWindow.minimize()}
          style={noDrag}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 rounded-sm transition-colors"
        >
          <svg style={noDrag} width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          style={noDrag}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 rounded-sm transition-colors"
        >
          <svg style={noDrag} width="9" height="9" viewBox="0 0 9 9" fill="none"><rect x="0.5" y="0.5" width="8" height="8" stroke="currentColor" strokeWidth="1" /></svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          style={noDrag}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-red-500/80 hover:text-white rounded-sm transition-colors"
        >
          <svg style={noDrag} width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" /></svg>
        </button>
      </div>
    </div>
  );
}
