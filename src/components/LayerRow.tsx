import { useEffect, useRef } from "react";
import { useSequencerStore } from "../store/useSequencerStore";
import { getOpacityAtFrame } from "../engine/envelope";
import { LayerThumbnail } from "./LayerThumbnail";
import type { LightLayer, Division } from "../types";
import { DIVISIONS } from "../types";

interface LayerRowProps {
  light: LightLayer;
  isSelected: boolean;
  rowHeight?: number;
  onPreview?: (light: LightLayer) => void;
  onToggleMute?: () => void;
}

const ROW_HEIGHT = 56; // Matched to SequencerGrid.tsx

export function Knob({ label: _label, value, max, onChange }: { label: string, value: number, max: number, onChange: (v: number, e: any) => void }) {
  const percentage = value / max;
  
  // SVG Ring calculations
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  // A 270 degree arc is 3/4 of a circle
  const arcLength = circumference * 0.75;
  // How much track is empty
  const emptyTrackLength = arcLength - (percentage * arcLength);
  
  // strokeDasharray sets the length of the visible line, then the length of the gap.
  // We want the total visible line to be the arc length (so the background track is exactly 270deg long),
  // and the gap to be the rest of the circle.
  
  // Angle calculated starting from straight down (90deg) minus half the gap (45deg)
  const angle = -135 + (percentage * 270);
  
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    useSequencerStore.getState().commitUndoSnapshot();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    
    const startY = e.clientY;
    const startValue = value;
    
    const onMove = (moveEvent: PointerEvent) => {
      const deltaY = startY - moveEvent.clientY;
      onChange(Math.max(0, Math.min(max, Math.round(startValue + deltaY * 0.5))), moveEvent);
    };
    
    const onUp = (upEvent: PointerEvent) => {
      el.releasePointerCapture(upEvent.pointerId);
      el.removeEventListener('pointermove', onMove as EventListener);
      el.removeEventListener('pointerup', onUp as EventListener);
    };
    
    el.addEventListener('pointermove', onMove as EventListener);
    el.addEventListener('pointerup', onUp as EventListener);
  };


  return (
    <div className="flex flex-col items-center justify-center group cursor-ns-resize" 
         onPointerDown={handlePointerDown}
         onWheel={(e) => {
           e.preventDefault();
           const delta = e.deltaY > 0 ? -1 : 1;
           onChange(Math.max(0, Math.min(max, value + delta)), e);
         }}
    >
      <div className="relative w-[36px] h-[36px] rounded-full bg-[#111] border border-black shadow-[0_2px_5px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)] flex items-center justify-center">
        
        {/* Track Rings */}
        {/* -rotate-90 starts 0 straight up, so we rotate 135deg clockwise so 0 is bottom left */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none drop-shadow-[0_0_2px_rgba(232,159,65,0.5)] rotate-[135deg]">
          {/* Background Track */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#222"
            strokeWidth="2.5"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
          />
          {/* Value Track */}
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="#e89f41"
            strokeWidth="2.5"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={emptyTrackLength}
            strokeLinecap="round"
            className="transition-all duration-75 ease-out"
          />
        </svg>

        {/* Inner Knob Surface & Indicator */}
        <div 
          className="absolute inset-[4px] rounded-full border border-black bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] shadow-inner flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Indicator Pill */}
          <div className="absolute top-[3px] w-[3px] h-[6px] bg-[#e89f41] rounded-full shadow-[0_0_3px_#e89f41]" />
        </div>

        {/* Center Label — hidden by default, opt-in with showLabel */}
      </div>
    </div>
  );
}

export function LayerRow(props: LayerRowProps) {
  const { light, isSelected, onToggleMute } = props;
  const setSelectedLayer = useSequencerStore(s => s.setSelectedLayer);
  const updateLight = useSequencerStore(s => s.updateLight);
  const removeLight = useSequencerStore(s => s.removeLight);
  const setGlobalControl = useSequencerStore(s => s.setGlobalControl);
  


  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrame: number;
    const loop = () => {
      const state = useSequencerStore.getState();
      const currentFrame = state.currentFrame;
      const { durationSeconds, fps } = state.sequence;
      
      const opacity = getOpacityAtFrame(light, currentFrame, durationSeconds, fps);
      if (highlightRef.current) {
        // Subtle orange highlight on the right
        highlightRef.current.style.opacity = (opacity * 0.6).toString();
      }
      animationFrame = requestAnimationFrame(loop);
    };
    animationFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrame);
  }, [light]);

  return (
    <div
      className={`flex shrink-0 relative group/row w-full transition-colors overflow-hidden ${isSelected ? 'bg-white/[0.05]' : 'bg-transparent hover:bg-white/[0.02]'}`}
      style={{ height: props.rowHeight || ROW_HEIGHT }}
      onClick={() => setSelectedLayer(light.id)}
    >
      <div 
        className="flex items-center px-1.5 py-1.5 relative w-full h-full justify-between"
      >
        {/* Layer Controls & Thumbnail Column (120px) */}
        <div className="w-[120px] shrink-0 flex items-center justify-start gap-2 relative pl-2">
          
          {/* Delete Layer Button */}
          <button
            onClick={(e) => {
                e.stopPropagation();
                removeLight(light.id);
            }}
            className="w-5 h-5 flex items-center justify-center opacity-0 hover:opacity-100 group-hover/row:opacity-100 text-[10px] text-white/30 hover:text-red-400 transition-all shrink-0"
            title="Delete Layer"
          >
            ✕
          </button>

          {/* Mute Button */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMute?.(); }}
            className={`w-5 h-5 flex items-center justify-center text-[8px] font-bold rounded transition-all shrink-0 ${light.muted ? "bg-white/20 text-white/60" : "opacity-0 group-hover/row:opacity-100 text-white/20 hover:text-white/50"}`}
            title={light.muted ? "Unmute" : "Mute"}
          >
            M
          </button>

          <div
            className="relative shrink-0 rounded overflow-hidden shadow-[0_2px_4px_rgba(0,0,0,0.5)] bg-black w-[80px] h-[44px] cursor-pointer hover:ring-1 hover:ring-[#e89f41]/40 transition-all"
            onClick={(e) => { e.stopPropagation(); window.__showImagePreview?.(light.filePath, light.name); }}
          >
             <LayerThumbnail filePath={light.filePath} size={44} />
          </div>
        </div>
        

        <div className="h-8 w-px bg-white/5 shrink-0" />

        {/* Per-Layer Division Selector */}
        <div className="flex items-center gap-[3px] px-1.5 shrink-0">
          {DIVISIONS.map((d) => (
            <button
              key={d}
              onClick={(e) => {
                e.stopPropagation();
                useSequencerStore.getState().setLayerDivision(light.id, d as Division);
              }}
              className={`min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-bold rounded transition-colors ${
                light.division === d
                  ? "bg-[#e89f41] text-black shadow-[0_0_4px_rgba(232,159,65,0.4)]"
                  : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
              }`}
              title={`${d} steps/sec`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Spacer to push content right */}
        <div className="flex-1" />

        {/* Knobs Group */}
        <div className="flex items-center gap-4 pr-2">
           {/* Attack Knob */}
           <div className="w-[36px] flex items-center justify-center">
              <Knob label="Attack" value={light.attack} max={60} onChange={(v, e) => e.shiftKey ? setGlobalControl("attack", v) : updateLight(light.id, { attack: v })} />
           </div>

           {/* Decay Knob */}
           <div className="w-[36px] flex items-center justify-center">
              <Knob label="Decay" value={light.decay} max={60} onChange={(v, e) => e.shiftKey ? setGlobalControl("decay", v) : updateLight(light.id, { decay: v })} />
           </div>
        </div>
      </div>
      
      {/* Realtime Trigger Highlight */}
      <div 
        ref={highlightRef}
        className="absolute top-0 right-0 w-1.5 h-full bg-[#e89f41] opacity-0 pointer-events-none"
      />
    </div>
  );
}
