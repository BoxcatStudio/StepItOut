import { useSequencerStore } from "../store/useSequencerStore";
import { LayerRow, Knob } from "./LayerRow";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getTotalFrames } from "../engine/frameMath";

const GRID = {
  ORIGIN_X: 320,       // Left sidebar width
  ORIGIN_Y: 56,        // Timeline header height
  ROW_HEIGHT: 56,      // Track row height
  CELL_GAP: 4,         // Space between cells
  CELL_Y_PADDING: 6,   // Vertical padding from top/bottom of track
  FPS: 30,             // Locked sequence FPS
  BLOCKS_PER_SEC: [0, 7, 14, 21], // Frame starts
  BLOCKS_SPAN:    [7, 7, 7, 9],   // Frame lengths
};

export function SequencerGrid() {
  const sequence = useSequencerStore(s => s.sequence);
  const selectedLayerId = useSequencerStore(s => s.selectedLayerId);
  const setCellRange = useSequencerStore(s => s.setCellRange);
  const toggleMute = useSequencerStore(s => s.toggleMute);
  const setSelectedLayer = useSequencerStore(s => s.setSelectedLayer);
  const clearAll = useSequencerStore(s => s.clearAll);
  const setGlobalControl = useSequencerStore(s => s.setGlobalControl);
  const commitUndoSnapshot = useSequencerStore(s => s.commitUndoSnapshot);
  const groups = useSequencerStore(s => s.groups);
  const selectedLayerIds = useSequencerStore(s => s.selectedLayerIds);
  const toggleLayerMultiSelect = useSequencerStore(s => s.toggleLayerMultiSelect);
  const createGroup = useSequencerStore(s => s.createGroup);
  const removeLayerFromGroup = useSequencerStore(s => s.removeLayerFromGroup);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1000); // Fallback
  const isDragging = useRef(false);
  const dragValue = useRef<number>(0);
  const [pendingClear, setPendingClear] = useState<"all" | "patterns" | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; layerId: string } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setViewportWidth(entry.contentRect.width);
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const totalFrames = getTotalFrames(sequence.durationSeconds, sequence.fps);
  
  // Viewport calculation constraints: 8 seconds exactly fills the visible track width
  const trackViewportWidth = Math.max(100, viewportWidth - GRID.ORIGIN_X); 
  const timelineActualWidth = trackViewportWidth * (sequence.durationSeconds / 8);
  const numCells = Math.ceil((totalFrames / sequence.fps) * 4);
  
  // Shared geometry values for exact hit detection and rendering
  const framesPer8Sec = 8 * sequence.fps;
  const pixelsPerFrame = trackViewportWidth / framesPer8Sec;

  // Bypassing React renders for the playhead by updating its DOM ref directly
  useEffect(() => {
    let animFrame: number;
    const loop = () => {
      if (playheadRef.current) {
         const frame = useSequencerStore.getState().currentFrame;
         const dur = useSequencerStore.getState().sequence.durationSeconds;
         const currFps = useSequencerStore.getState().sequence.fps;
         const currTotalFrames = Math.max(1, Math.floor(dur * currFps));
         const progress = frame / currTotalFrames;
         
         const leftPos = GRID.ORIGIN_X + (progress * timelineActualWidth) - 2;
         playheadRef.current.style.left = `${leftPos}px`;
      }
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [timelineActualWidth]);

  const getStartFrameForCell = (cellIdx: number) => {
    const seconds = Math.floor(cellIdx / 4);
    const blockIndex = cellIdx % 4;
    return (seconds * sequence.fps) + GRID.BLOCKS_PER_SEC[blockIndex];
  };

  const getFrameSpanForCell = (cellIdx: number) => {
    return GRID.BLOCKS_SPAN[cellIdx % 4];
  };

  // Track which cell was last modified so we don't spam updates while dragging over it
  const lastPaintedCell = useRef<{ layerId: string; startFrame: number; span: number } | null>(null);

  const getCellFromEvent = (e: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return null;
    
    // Use container metrics for scroll-aware absolute calculation
    const rect = container.getBoundingClientRect();
    
    // X Math: find the exact frame under the cursor
    const localX = (e.clientX - rect.left) + container.scrollLeft - GRID.ORIGIN_X;
    if (localX < 0 || localX > timelineActualWidth) return null;
    
    const hitFrame = Math.floor(localX / pixelsPerFrame);
    
    // Convert raw frame inside the sequence to block index
    const seconds = Math.floor(hitFrame / sequence.fps);
    const frameInsideSec = hitFrame % sequence.fps;
    
    let blockIndexRange = 0;
    if (frameInsideSec >= GRID.BLOCKS_PER_SEC[3]) blockIndexRange = 3;
    else if (frameInsideSec >= GRID.BLOCKS_PER_SEC[2]) blockIndexRange = 2;
    else if (frameInsideSec >= GRID.BLOCKS_PER_SEC[1]) blockIndexRange = 1;

    const cellColumn = Math.max(0, Math.min(numCells - 1, (seconds * 4) + blockIndexRange));
    const startFrame = getStartFrameForCell(cellColumn);

    // Y Math: find the exact layer under the cursor
    const localY = (e.clientY - rect.top) + container.scrollTop - GRID.ORIGIN_Y;
    if (localY < 0) return null;

    const rowIndex = Math.floor(localY / GRID.ROW_HEIGHT);
    const layer = sequence.lights[rowIndex];

    if (!layer) return null;

    return { layerId: layer.id, startFrame, rawFrameIndex: hitFrame, span: getFrameSpanForCell(cellColumn) };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const hit = getCellFromEvent(e);
    if (!hit) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    setSelectedLayer(hit.layerId);
    
    // Check if what we clicked on was ALREADY active (check full cell span)
    const layerObj = sequence.lights.find(l => l.id === hit.layerId);
    if (!layerObj) return;
    let currentlyActive = false;
    for (let f = hit.startFrame; f < Math.min(hit.startFrame + hit.span, layerObj.pattern.length); f++) {
      if (layerObj.pattern[f]) { currentlyActive = true; break; }
    }

    // Shift inverses default behavior. Normally:
    // Click active space -> Erase
    // Click empty space -> Draw
    dragValue.current = e.shiftKey ? 0 : (currentlyActive ? 0 : 1);

    commitUndoSnapshot();

    // Apply immediately to the first cell clicked (clears/sets entire span)
    setCellRange(hit.layerId, hit.startFrame, hit.span, dragValue.current);
    lastPaintedCell.current = { layerId: hit.layerId, startFrame: hit.startFrame, span: hit.span };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const hit = getCellFromEvent(e);
    if (!hit) return;

    // If we haven't actually moved to a *new* valid cell since the last paint, do nothing
    if (
      lastPaintedCell.current &&
      lastPaintedCell.current.layerId === hit.layerId &&
      lastPaintedCell.current.startFrame === hit.startFrame
    ) {
      return;
    }

    setCellRange(hit.layerId, hit.startFrame, hit.span, dragValue.current);
    lastPaintedCell.current = { layerId: hit.layerId, startFrame: hit.startFrame, span: hit.span };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      isDragging.current = false;
      lastPaintedCell.current = null;
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#151515] relative overflow-hidden select-none">
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto custom-scrollbar relative"
      >
        <div 
           className="flex flex-col min-w-full pb-12 w-max"
           onPointerLeave={handlePointerUp}
           onPointerUp={handlePointerUp}
           onPointerCancel={handlePointerUp}
           onPointerDown={handlePointerDown}
           onPointerMove={handlePointerMove}
        >

          <div className="flex sticky top-0 z-40 bg-[#151515] border-b border-[#000]" style={{ height: GRID.ROW_HEIGHT }}>
             <div className="w-[360px] shrink-0 sticky left-0 z-50 bg-[#151515] border-r border-[#000] flex items-center justify-between px-2" style={{ width: GRID.ORIGIN_X }}>
                <div className="w-[120px] shrink-0 flex items-center justify-start gap-2 pl-2">
                   <button
                      onClick={() => setPendingClear("all")}
                       className="w-5 h-5 flex items-center justify-center shrink-0 text-[10px] text-white/50 bg-[#222] border border-red-500/20 hover:bg-red-500/80 hover:text-white rounded shadow-inner font-bold transition-colors"
                      title="Clear Composition"
                   >
                     ✕
                   </button>
                   <div className="w-[80px] flex items-center justify-center shrink-0">
                     <button
                        onClick={() => setPendingClear("patterns")}
                        className="text-[10px] w-[80px] text-red-500/80 font-bold tracking-wider hover:text-red-400 border border-red-500/20 rounded py-1 shadow-inner bg-[#111]"
                     >
                       CLEAR
                     </button>
                   </div>
                </div>



                <div className="h-8 w-px bg-white/5 shrink-0" />

                {/* Spacer to push content right */}
                <div className="flex-1" />

                {/* Knobs Group */}
                <div className="flex items-center gap-4 pr-2">
                  <div className="flex flex-col items-center gap-0.5">
                    <Knob label="ATK" value={sequence.lights[0]?.attack || 2} max={60} onChange={(v) => setGlobalControl("attack", v)} />
                    <span className="text-[7px] text-white/25 uppercase tracking-wider font-bold">Attack</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <Knob label="DEC" value={sequence.lights[0]?.decay || 6} max={60} onChange={(v) => setGlobalControl("decay", v)} />
                    <span className="text-[7px] text-white/25 uppercase tracking-wider font-bold">Decay</span>
                  </div>
                </div>
             </div>

             <div className="flex-1 flex border-b flex-col border-black relative overflow-hidden bg-[#1a1a1a]">
               <div className="flex-1 relative flex items-end" style={{ width: timelineActualWidth, minWidth: timelineActualWidth }}>
                 {Array.from({ length: numCells }).map((_, cellIdx) => {
                   const startFrame = getStartFrameForCell(cellIdx);
                   const isSecondBoundary = startFrame % sequence.fps === 0;
                   const isHalfBoundary = startFrame % sequence.fps === 14; // Start of block 3 is halfway for 30fps

                   const cellLeft = startFrame * pixelsPerFrame;
                   const targetWidth = getFrameSpanForCell(cellIdx) * pixelsPerFrame;

                   return (
                     <div key={cellIdx} className="absolute bottom-0 top-0" style={{ left: cellLeft, width: targetWidth }}>
                        {isSecondBoundary && (
                           <div className="absolute left-0 bottom-0 top-0 w-[2px] bg-white/40 flex items-end pl-1 pb-1 z-10 pointer-events-none">
                             <span className="text-[10px] text-white/70 font-bold leading-none">{startFrame / sequence.fps}s</span>
                           </div>
                        )}
                        {isHalfBoundary && (
                           <div className="absolute left-0 bottom-0 h-2 w-[1px] bg-white/20 flex items-end pl-1 pb-[1px] z-10 pointer-events-none">
                             <span className="text-[8px] text-white/30 font-bold leading-none">15f</span>
                           </div>
                        )}
                     </div>
                   );
                 })}
               </div>
             </div>
          </div>

          <div className="flex flex-col relative w-full">
            <div 
              ref={playheadRef}
              className="absolute top-0 bottom-0 w-[2px] bg-[#e89f41] z-20 shadow-[0_0_10px_rgba(232,159,65,0.8)] pointer-events-none"
              style={{ 
                left: GRID.ORIGIN_X - 2,
                display: totalFrames > 0 && sequence.lights.length > 0 ? "block" : "none" 
              }}
            />

            {/* Empty state handled upstream */}

            {sequence.lights.map((light) => {
              const isSelected = selectedLayerId === light.id;
              const isMultiSelected = selectedLayerIds.includes(light.id);
              const layerGroup = groups.find(g => g.layerIds.includes(light.id));

              return (
                <div
                  key={light.id}
                  className="flex w-full group/track relative border-b border-[#0a0a0a]"
                  style={{ height: GRID.ROW_HEIGHT, width: GRID.ORIGIN_X + timelineActualWidth }}
                >

                  <div
                    className={`shrink-0 sticky left-0 z-30 border-r border-[#0a0a0a] transition-colors ${isSelected ? "bg-[#252525]" : "bg-[#1e1e1e]"} ${light.muted ? "opacity-40 grayscale" : ""} ${isMultiSelected ? "ring-1 ring-inset ring-blue-400/40" : ""}`}
                    style={{ width: GRID.ORIGIN_X, borderLeft: layerGroup ? `3px solid ${layerGroup.color}` : "3px solid transparent" }}
                    onClick={(e) => {
                      if (e.shiftKey) {
                        e.stopPropagation();
                        toggleLayerMultiSelect(light.id);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, layerId: light.id });
                    }}
                  >
                    <LayerRow light={light} isSelected={isSelected} rowHeight={GRID.ROW_HEIGHT} onToggleMute={() => toggleMute(light.id)} />
                  </div>

                  <div 
                    className={`flex-1 relative cursor-pointer py-1.5 ${isSelected ? "bg-white/[0.02]" : ""}`}
                    style={{ width: timelineActualWidth, minWidth: timelineActualWidth }}
                    // Events are now handled at the parent level to allow cross-track dragging
                  >
                     {Array.from({ length: numCells }).map((_, cellIdx) => {
                       const startFrame = getStartFrameForCell(cellIdx);
                       const span = getFrameSpanForCell(cellIdx);
                       const isSecondBoundary = startFrame % sequence.fps === 0;
                       const isHalfBoundary = startFrame % sequence.fps === 14;
                       
                       let isActive = false;
                       for (let f = startFrame; f < Math.min(startFrame + span, totalFrames); f++) {
                         if (light.pattern[f]) { isActive = true; break; }
                       }
                       
                       const cellLeft = startFrame * pixelsPerFrame;
                       const targetWidth = Math.max(1, (span * pixelsPerFrame) - GRID.CELL_GAP);

                       return (
                         <div
                           key={cellIdx}
                           className="absolute"
                           style={{ 
                             left: cellLeft,
                             width: targetWidth,
                             top: GRID.CELL_Y_PADDING,
                             bottom: GRID.CELL_Y_PADDING
                           }}
                         >
                           {/* Second Divider Marker */}
                           {isSecondBoundary && cellIdx !== 0 && (
                               <div className="absolute -left-[2px] w-[2px] h-[160%] bg-white/20 top-1/2 -translate-y-1/2 pointer-events-none z-0" />
                           )}
                           
                           {/* Half-Second Divider Marker */}
                           {isHalfBoundary && (
                               <div className="absolute -left-[1px] w-[1px] h-[120%] bg-white/5 top-1/2 -translate-y-1/2 pointer-events-none z-0" />
                           )}
                           
                           {/* Active Cell Object */}
                           <div
                             className={`w-full h-full rounded-sm transition-all duration-75 overflow-hidden relative z-10 ${
                               isActive
                                 ? light.muted
                                   ? "bg-white/20 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
                                   : "bg-[#e89f41] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                                 : "bg-white/5 hover:bg-white/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.5)]"
                             }`}
                           >
                              {isActive && !light.muted && (
                                 <svg
                                   className="absolute inset-[3px] pointer-events-none opacity-60 z-20" 
                                   preserveAspectRatio="none" 
                                   viewBox="0 0 100 100"
                                   style={{ width: 'calc(100% - 6px)', height: 'calc(100% - 6px)' }}
                                 >
                                   <path 
                                     d={`M 0 100 L ${Math.min(100, (light.attack / span) * 100)} 0 L ${Math.min(100, ((light.attack + Math.max(0, span - light.attack - light.decay)) / span) * 100)} 0 L 100 100`} 
                                     fill="none" 
                                     stroke="white" 
                                     strokeWidth="2" 
                                     vectorEffect="non-scaling-stroke" 
                                   />
                                 </svg>
                              )}
                           </div>
                         </div>
                       );
                     })}
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Right-click context menu for grouping */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setContextMenu(null)} onContextMenu={e => { e.preventDefault(); setContextMenu(null); }} />
          <div
            className="fixed z-[200] bg-[#1a1a1a] border border-white/10 rounded shadow-2xl py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {(() => {
              const allToGroup = selectedLayerIds.includes(contextMenu.layerId)
                ? selectedLayerIds
                : [...selectedLayerIds, contextMenu.layerId];
              const inGroup = groups.find(g => g.layerIds.includes(contextMenu.layerId));
              return (
                <>
                  {allToGroup.length >= 2 && (
                    <button
                      onClick={() => {
                        createGroup(`Group ${groups.length + 1}`, allToGroup);
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      Group {allToGroup.length} layers
                    </button>
                  )}
                  {allToGroup.length < 2 && groups.length > 0 && (
                    <>
                      <div className="px-3 py-1 text-[8px] text-white/20 uppercase tracking-wider">Add to group</div>
                      {groups.map(g => (
                        <button
                          key={g.id}
                          onClick={() => {
                            if (!g.layerIds.includes(contextMenu.layerId)) {
                              useSequencerStore.setState(s => ({
                                groups: s.groups.map(gr => gr.id === g.id ? { ...gr, layerIds: [...gr.layerIds, contextMenu.layerId] } : gr)
                              }));
                            }
                            setContextMenu(null);
                          }}
                          className="w-full text-left px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/70 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                          {g.name}
                        </button>
                      ))}
                    </>
                  )}
                  {inGroup && (
                    <button
                      onClick={() => {
                        removeLayerFromGroup(contextMenu.layerId);
                        setContextMenu(null);
                      }}
                      className="w-full text-left px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/40 hover:bg-white/5 hover:text-red-400 transition-colors"
                    >
                      Remove from {inGroup.name}
                    </button>
                  )}
                  {allToGroup.length < 2 && groups.length === 0 && (
                    <div className="px-3 py-2 text-[8px] text-white/20">Shift+click more layers to group</div>
                  )}
                </>
              );
            })()}
          </div>
        </>,
        document.body
      )}

      {/* Clear Confirmation Modal — portaled to body to escape overflow clipping */}
      {pendingClear && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setPendingClear(null)}>
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-lg shadow-2xl w-[340px] p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-white/90 text-[12px] font-bold uppercase tracking-widest mb-2">
              {pendingClear === "all" ? "Remove All Channels?" : "Clear All Patterns?"}
            </h3>
            <p className="text-white/40 text-[10px] mb-4">
              {pendingClear === "all"
                ? "This will remove all channels and reset the sequences. This cannot be undone."
                : "This will zero out every channel's step data. Channels will remain."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setPendingClear(null)}
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80 bg-black/40 hover:bg-black/80 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  clearAll(pendingClear === "all");
                  setPendingClear(null);
                }}
                className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
              >
                {pendingClear === "all" ? "Remove All" : "Clear Patterns"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
