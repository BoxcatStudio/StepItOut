import { useState } from "react";
import { useSequencerStore } from "../store/useSequencerStore";
import { PreviewMonitor } from "./PreviewMonitor";
import { Knob } from "./LayerRow";
import type {
  GeneratorType,
  RandomConfig,
  WaveConfig,
  MirrorConfig,
  SweepConfig,
  BlockConfig,
  ChaserConfig,
  RampConfig,
  ShapesConfig,
  LayerGroup,
} from "../types";

// Labeled knob: knob + label text below (defined outside component for stable identity)
function LabeledKnob({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number, e: any) => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Knob label={label} value={value} max={max} onChange={onChange} />
      <span className="text-[7px] text-white/25 uppercase tracking-wider font-bold">{label}</span>
    </div>
  );
}

// Shared generator card wrapper (defined outside component for stable identity)
function GenCard({ name, onApply, knobs, options, repeat, isActive }: {
  name: string;
  onApply: () => void;
  knobs: React.ReactNode;
  options?: React.ReactNode;
  repeat?: React.ReactNode;
  isActive?: boolean;
}) {
  return (
    <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full pt-5 px-2 pb-1.5">
      <button
        onClick={onApply}
        className="absolute top-1.5 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors flex items-center gap-1.5"
      >
        {name}
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#e89f41]" />}
      </button>
      <div className="flex justify-center items-center gap-6 flex-1">
        {knobs}
      </div>
      {options && (
        <div className="flex flex-wrap gap-2 text-[8px] font-bold uppercase tracking-wider justify-center mt-1">
          {options}
        </div>
      )}
      {repeat && (
        <div className="flex justify-end mt-0.5">
          {repeat}
        </div>
      )}
    </div>
  );
}

// Group item row in the Groups panel (defined outside for stable identity)
function GroupItem({ group, isActive, onSelect, onDelete, onRename, onAddSelected, hasSelection }: {
  group: LayerGroup;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onAddSelected?: () => void;
  hasSelection?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  return (
    <div className={`flex items-center gap-1.5 px-1.5 py-1.5 group/grp relative ${isActive ? "bg-black/30" : "hover:bg-black/20"} transition-colors`}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: group.color }} />
      {editing ? (
        <input
          autoFocus
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={() => { onRename(editName); setEditing(false); }}
          onKeyDown={e => {
            if (e.key === "Enter") { onRename(editName); setEditing(false); }
            if (e.key === "Escape") { setEditName(group.name); setEditing(false); }
          }}
          className="flex-1 bg-transparent text-[9px] font-bold text-white outline-none border-b border-white/30 uppercase tracking-widest"
        />
      ) : (
        <button
          onClick={onSelect}
          onDoubleClick={() => { setEditName(group.name); setEditing(true); }}
          className={`flex-1 text-left text-[9px] font-bold uppercase tracking-widest truncate transition-colors ${isActive ? "text-[#e89f41]" : "text-white/50 hover:text-white"}`}
        >
          {group.name}
        </button>
      )}
      <span className="text-[8px] text-white/20 shrink-0">{group.layerIds.length}</span>
      {hasSelection && onAddSelected ? (
        <button
          onClick={e => { e.stopPropagation(); onAddSelected(); }}
          className="text-[#e89f41]/60 hover:text-[#e89f41] transition-all text-[11px] font-bold shrink-0 leading-none"
          title="Add selected layers to group"
        >+</button>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover/grp:opacity-100 text-white/30 hover:text-red-400 transition-all text-[11px] font-bold shrink-0 leading-none"
          title="Delete group"
        >×</button>
      )}
    </div>
  );
}

export function BottomPanel() {
  const activeBankSlot = useSequencerStore(s => s.activeBankSlot);
  const sequenceBank = useSequencerStore(s => s.sequenceBank);
  const switchBankSlot = useSequencerStore(s => s.switchBankSlot);
  const applyLiveGenerator = useSequencerStore(s => s.applyLiveGenerator);
  const lastAppliedGenerator = useSequencerStore(s => s.lastAppliedGenerator);
  const groups = useSequencerStore(s => s.groups);
  const selectedGroupId = useSequencerStore(s => s.selectedGroupId);
  const selectedLayerIds = useSequencerStore(s => s.selectedLayerIds);
  const setSelectedGroup = useSequencerStore(s => s.setSelectedGroup);
  const deleteGroup = useSequencerStore(s => s.deleteGroup);
  const renameGroup = useSequencerStore(s => s.renameGroup);
  const createGroup = useSequencerStore(s => s.createGroup);
  const setGroupControl = useSequencerStore(s => s.setGroupControl);

  const [randomCfg, setRandomCfg] = useState<RandomConfig>({ density: 20, variation: 0 });
  const [waveCfg, setWaveCfg] = useState<WaveConfig>({ width: 20, speed: 50 });
  const [mirrorCfg, setMirrorCfg] = useState<MirrorConfig>({ shape: "triangle", amount: 50, angle: 0 });
  const [sweepCfg, setSweepCfg] = useState<SweepConfig>({ direction: "right", slope: 50, amount: 50, repeat: true });
  const [blockCfg, setBlockCfg] = useState<BlockConfig>({ timing: "beat", amount: 50, variation: 0 });
  const [chaserCfg, setChaserCfg] = useState<ChaserConfig>({ steps: 4, stride: 25, repeat: true });
  const [rampCfg, setRampCfg] = useState<RampConfig>({ amount: 50, direction: "in" });
  const [shapesCfg, setShapesCfg] = useState<ShapesConfig>({ shape: "arrow-up", period: 4, width: 30 });

  const applyGen = (type: GeneratorType, config: any) => {
    applyLiveGenerator({ type, config });
  };

  const renderSequenceGroup = (label: string, start: number, count: number) => (
    <div className="flex flex-col relative min-h-0 bg-[#111] hover:bg-[#131313] transition-colors pt-5 px-2 flex-1">
      <span className="absolute top-1.5 left-2 text-[9px] font-bold text-[#e89f41]/80 uppercase tracking-widest z-10">{label}</span>
      <div className="grid grid-cols-4 gap-[2px] h-full flex-1">
        {Array.from({ length: count }).map((_, i) => {
          const slotIndex = start + i;
          const isActive = activeBankSlot === slotIndex;
          const hasData = sequenceBank[slotIndex] !== null;

          let buttonStyle = "bg-black/40 text-white/30 hover:bg-black/80 hover:text-white";
          if (isActive) {
            buttonStyle = "bg-black/40 text-[#e89f41]";
          } else if (hasData) {
            buttonStyle = "bg-black/40 text-[#e89f41]/70 hover:text-[#e89f41] hover:bg-black/80";
          }

          return (
            <button
              key={slotIndex}
              onClick={() => switchBankSlot(slotIndex)}
              className={`relative w-full h-full min-h-[2.5rem] flex items-center justify-center text-[10px] font-bold transition-all group tracking-widest ${buttonStyle}`}
            >
              {slotIndex + 1}
              <div className={`absolute top-1 right-1 w-1 h-1 rounded-full transition-colors ${hasData ? 'bg-green-500/80' : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-full text-white bg-[#0a0a0a]">

      {/* LEFT COLUMN: SEQUENCES */}
      <div className="w-[260px] shrink-0 flex flex-col px-2 pt-2 pb-2 border-r border-black overflow-y-auto custom-scrollbar">
        <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-1 text-center shrink-0">SEQUENCES</h2>
        <div className="flex flex-col flex-1 min-h-0 gap-[2px] bg-black/50 p-[2px] border border-white/10 rounded-sm">
          {renderSequenceGroup("Build", 0, 8)}
          {renderSequenceGroup("Break", 8, 8)}
          {renderSequenceGroup("Drop", 16, 8)}
          {renderSequenceGroup("Custom", 24, 8)}
        </div>
      </div>

      {/* GROUPS COLUMN */}
      <div className="w-[180px] shrink-0 flex flex-col px-2 pt-2 pb-2 border-r border-black overflow-y-auto custom-scrollbar">
        <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-1 text-center shrink-0">GROUPS</h2>
        <div className="flex flex-col flex-1 min-h-0 bg-black/50 border border-white/10 rounded-sm overflow-hidden">

          {/* All Layers option */}
          <button
            onClick={() => setSelectedGroup(null)}
            className={`w-full text-left px-2 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors border-b border-white/5 ${!selectedGroupId ? "text-[#e89f41]" : "text-white/40 hover:text-white/70"}`}
          >
            All Layers
          </button>

          {/* Group list */}
          {groups.map(group => (
            <GroupItem
              key={group.id}
              group={group}
              isActive={selectedGroupId === group.id}
              onSelect={() => setSelectedGroup(group.id)}
              onDelete={() => deleteGroup(group.id)}
              onRename={(name) => renameGroup(group.id, name)}
              hasSelection={selectedLayerIds.length > 0}
              onAddSelected={() => {
                useSequencerStore.setState(s => ({
                  groups: s.groups.map(g => g.id === group.id
                    ? { ...g, layerIds: [...new Set([...g.layerIds, ...selectedLayerIds])] }
                    : g
                  ),
                  selectedLayerIds: [],
                }));
                setSelectedGroup(group.id);
              }}
            />
          ))}

          {groups.length === 0 && selectedLayerIds.length === 0 && (
            <div className="text-[8px] text-white/15 text-center py-4 px-2 leading-relaxed">
              Shift+click layers then right-click to group
            </div>
          )}

          {/* Create group from selected layers (1 or more) */}
          {selectedLayerIds.length >= 1 && (
            <div className="mt-auto border-t border-white/10 p-1.5">
              <button
                onClick={() => createGroup(`Group ${groups.length + 1}`, selectedLayerIds)}
                className="w-full text-[8px] font-bold uppercase tracking-wider text-[#e89f41]/70 hover:text-[#e89f41] transition-colors py-1 text-center"
              >
                + Group {selectedLayerIds.length > 1 ? `${selectedLayerIds.length} layers` : "layer"}
              </button>
            </div>
          )}

          {/* Attack / Decay knobs for selected group */}
          {selectedGroupId && (() => {
            const activeGroup = groups.find(g => g.id === selectedGroupId);
            if (!activeGroup) return null;
            const atk = activeGroup.attack ?? 2;
            const dcy = activeGroup.decay ?? 6;
            return (
              <div className="border-t border-white/10 px-2 pt-2 pb-1.5 flex flex-col gap-1">
                <span className="text-[7px] text-white/20 uppercase tracking-widest text-center">Group Envelope</span>
                <div className="flex justify-center gap-4">
                  <LabeledKnob label="Attack" value={atk} max={10} onChange={v => setGroupControl(selectedGroupId, v, dcy)} />
                  <LabeledKnob label="Decay" value={dcy} max={10} onChange={v => setGroupControl(selectedGroupId, atk, v)} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* MIDDLE COLUMN: GENERATORS */}
      <div className="w-[440px] shrink-0 flex flex-col px-2 pt-2 pb-2 border-r border-black overflow-y-auto custom-scrollbar relative">
        <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-0.5 shrink-0 text-center">GENERATORS</h2>
        {selectedGroupId && (
          <p className="text-[8px] text-white/30 text-center mb-0.5 shrink-0">
            ↳ {groups.find(g => g.id === selectedGroupId)?.name}
          </p>
        )}

        <div className="grid grid-cols-2 grid-rows-4 flex-1 gap-[2px] bg-black/50 p-[2px] border border-white/10 rounded-sm overflow-hidden">

          {/* Random */}
          <GenCard name="Random" onApply={() => applyGen("random", randomCfg)} isActive={lastAppliedGenerator === "random"}
            knobs={<>
              <LabeledKnob label="Density" value={randomCfg.density} max={100} onChange={v => { const next = {...randomCfg, density: v}; setRandomCfg(next); applyGen("random", next); }} />
              <LabeledKnob label="Variation" value={randomCfg.variation} max={100} onChange={v => { const next = {...randomCfg, variation: v}; setRandomCfg(next); applyGen("random", next); }} />
            </>}
          />

          {/* Wave */}
          <GenCard name="Wave" onApply={() => applyGen("wave", waveCfg)} isActive={lastAppliedGenerator === "wave"}
            knobs={<>
              <LabeledKnob label="Width" value={waveCfg.width} max={100} onChange={v => { const next = {...waveCfg, width: v}; setWaveCfg(next); applyGen("wave", next); }} />
              <LabeledKnob label="Speed" value={waveCfg.speed} max={100} onChange={v => { const next = {...waveCfg, speed: v}; setWaveCfg(next); applyGen("wave", next); }} />
            </>}
          />

          {/* Mirror */}
          <GenCard name="Mirror" onApply={() => applyGen("mirror", mirrorCfg)} isActive={lastAppliedGenerator === "mirror"}
            knobs={<>
              <LabeledKnob label="Amount" value={mirrorCfg.amount} max={100} onChange={v => { const next = {...mirrorCfg, amount: v}; setMirrorCfg(next); applyGen("mirror", next); }} />
              <LabeledKnob label="Angle" value={mirrorCfg.angle} max={100} onChange={v => { const next = {...mirrorCfg, angle: v}; setMirrorCfg(next); applyGen("mirror", next); }} />
            </>}
            options={["triangle","x","diamond","funnel"].map(shape => (
              <button key={shape} onClick={() => { const next = {...mirrorCfg, shape: shape as any}; setMirrorCfg(next); applyGen("mirror", next); }}
                      className={`transition-colors ${mirrorCfg.shape === shape ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{shape}</button>
            ))}
          />

          {/* Sweep */}
          <GenCard name="Sweep" onApply={() => applyGen("sweep", sweepCfg)} isActive={lastAppliedGenerator === "sweep"}
            knobs={<>
              <LabeledKnob label="Slope" value={sweepCfg.slope} max={100} onChange={v => { const next = {...sweepCfg, slope: v}; setSweepCfg(next); applyGen("sweep", next); }} />
              <LabeledKnob label="Amount" value={sweepCfg.amount} max={100} onChange={v => { const next = {...sweepCfg, amount: v}; setSweepCfg(next); applyGen("sweep", next); }} />
            </>}
            options={["left","right","up","down"].map(dir => (
              <button key={dir} onClick={() => { const next = {...sweepCfg, direction: dir as any}; setSweepCfg(next); applyGen("sweep", next); }}
                      className={`transition-colors ${sweepCfg.direction === dir ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{dir}</button>
            ))}
            repeat={
              <button onClick={() => { const next = {...sweepCfg, repeat: !sweepCfg.repeat}; setSweepCfg(next); applyGen("sweep", next); }}
                      className={`text-[8px] font-bold uppercase tracking-wider transition-colors ${sweepCfg.repeat ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Repeat</button>
            }
          />

          {/* Block */}
          <GenCard name="Block" onApply={() => applyGen("block", blockCfg)} isActive={lastAppliedGenerator === "block"}
            knobs={<>
              <LabeledKnob label="Amount" value={blockCfg.amount} max={100} onChange={v => { const next = {...blockCfg, amount: v}; setBlockCfg(next); applyGen("block", next); }} />
              <LabeledKnob label="Variation" value={blockCfg.variation} max={100} onChange={v => { const next = {...blockCfg, variation: v}; setBlockCfg(next); applyGen("block", next); }} />
            </>}
            options={(["beat","half-beat","quarter-beat"] as const).map(t => (
              <button key={t} onClick={() => { const next = {...blockCfg, timing: t}; setBlockCfg(next); applyGen("block", next); }}
                      className={`transition-colors ${blockCfg.timing === t ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{t}</button>
            ))}
          />

          {/* Chaser */}
          <GenCard name="Chaser" onApply={() => applyGen("chaser", chaserCfg)} isActive={lastAppliedGenerator === "chaser"}
            knobs={<>
              <LabeledKnob label="Steps" value={chaserCfg.steps} max={32} onChange={v => { const next = {...chaserCfg, steps: v}; setChaserCfg(next); applyGen("chaser", next); }} />
              <LabeledKnob label="Stride" value={chaserCfg.stride} max={100} onChange={v => { const next = {...chaserCfg, stride: v}; setChaserCfg(next); applyGen("chaser", next); }} />
            </>}
            repeat={
              <button onClick={() => { const next = {...chaserCfg, repeat: !chaserCfg.repeat}; setChaserCfg(next); applyGen("chaser", next); }}
                      className={`text-[8px] font-bold uppercase tracking-wider transition-colors ${chaserCfg.repeat ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Repeat</button>
            }
          />

          {/* Ramp */}
          <GenCard name="Ramp" onApply={() => applyGen("ramp", rampCfg)} isActive={lastAppliedGenerator === "ramp"}
            knobs={
              <LabeledKnob label="Amount" value={rampCfg.amount} max={100} onChange={v => { const next = {...rampCfg, amount: v}; setRampCfg(next); applyGen("ramp", next); }} />
            }
            options={["in","out"].map(dir => (
              <button key={dir} onClick={() => { const next = {...rampCfg, direction: dir as any}; setRampCfg(next); applyGen("ramp", next); }}
                      className={`transition-colors ${rampCfg.direction === dir ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Fade {dir}</button>
            ))}
          />

          {/* Shapes */}
          <GenCard name="Shapes" onApply={() => applyGen("shapes", shapesCfg)} isActive={lastAppliedGenerator === "shapes"}
            knobs={
              <LabeledKnob label="Width" value={shapesCfg.width} max={100} onChange={v => { const next = {...shapesCfg, width: v}; setShapesCfg(next); applyGen("shapes", next); }} />
            }
            options={<>
              {(["arrow-up","arrow-down","chevron","line","wave"] as const).map(s => (
                <button key={s} onClick={() => { const next = {...shapesCfg, shape: s}; setShapesCfg(next); applyGen("shapes", next); }}
                        className={`transition-colors ${shapesCfg.shape === s ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{s}</button>
              ))}
              <span className="text-white/10 mx-1">|</span>
              {([4, 8] as const).map(p => (
                <button key={p} onClick={() => { const next = {...shapesCfg, period: p}; setShapesCfg(next); applyGen("shapes", next); }}
                        className={`transition-colors ${shapesCfg.period === p ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{p}b</button>
              ))}
            </>}
          />

        </div>
      </div>

      {/* RIGHT COLUMN: PROGRAM MONITOR */}
      <div className="flex-1 flex flex-col px-4 pt-2 pb-2 bg-[#050505] min-w-[300px]">
         <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-1 shrink-0 text-center">PROGRAM MONITOR</h2>
         <div className="flex-1 min-h-0 border border-white/5 bg-black rounded shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] flex items-center justify-center p-2 relative overflow-hidden">
             <div className="w-full h-full relative" style={{ isolation: 'isolate' }}>
                <PreviewMonitor />
             </div>
         </div>
      </div>

    </div>
  );
}
