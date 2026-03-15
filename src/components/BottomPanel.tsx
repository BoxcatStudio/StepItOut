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
  RampConfig 
} from "../types";

export function BottomPanel() {
  const activeBankSlot = useSequencerStore(s => s.activeBankSlot);
  const sequenceBank = useSequencerStore(s => s.sequenceBank);
  const switchBankSlot = useSequencerStore(s => s.switchBankSlot);
  const applyLiveGenerator = useSequencerStore(s => s.applyLiveGenerator);

  const [randomCfg, setRandomCfg] = useState<RandomConfig>({ density: 20, variation: 0 });
  const [waveCfg, setWaveCfg] = useState<WaveConfig>({ width: 20, speed: 50 });
  const [mirrorCfg, setMirrorCfg] = useState<MirrorConfig>({ shape: "triangle", amount: 50, angle: 0 });
  const [sweepCfg, setSweepCfg] = useState<SweepConfig>({ direction: "right", slope: 50, amount: 50, repeat: true });
  const [blockCfg, setBlockCfg] = useState<BlockConfig>({ spacing: 25, shuffle: 0 });
  const [chaserCfg, setChaserCfg] = useState<ChaserConfig>({ steps: 4, stride: 25, repeat: true });
  const [rampCfg, setRampCfg] = useState<RampConfig>({ amount: 50, direction: "in" });

  const applyGen = (type: GeneratorType, config: any) => {
    applyLiveGenerator({ type, config });
  };

  const renderSequenceGroup = (label: string, start: number, count: number) => (
    <div className="flex flex-col relative min-h-0 bg-[#111] hover:bg-[#131313] transition-colors pt-6 px-3 flex-1">
      <span className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 uppercase tracking-widest z-10">{label}</span>
      <div className="grid grid-cols-4 gap-[2px] h-full flex-1">
        {Array.from({ length: count }).map((_, i) => {
          const slotIndex = start + i;
          const isActive = activeBankSlot === slotIndex;
          const hasData = sequenceBank[slotIndex] !== null;
          
          let buttonStyle = "bg-black/40 text-white/30 hover:bg-black/80 hover:text-white";
          if (isActive) {
            buttonStyle = "bg-[#e89f41]/20 text-[#e89f41]";
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
              {/* Dot Indicator */}
              <div className={`absolute top-1 right-1 w-1 h-1 rounded-full transition-colors ${hasData ? 'bg-green-500/80' : 'bg-transparent'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-full text-white bg-[#0a0a0a]">
      
      {/* LEFT COLUMN: SEQUENCES (Fixed Width) */}
      <div className="w-[280px] shrink-0 flex flex-col px-4 pt-2 pb-4 border-r border-black overflow-y-auto custom-scrollbar">
        <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-2 text-center shrink-0">SEQUENCES</h2>
        <div className="flex flex-col flex-1 min-h-0 gap-[2px] bg-black/50 p-[2px] border border-white/10 rounded-sm">
          {renderSequenceGroup("Build", 0, 8)}
          {renderSequenceGroup("Break", 8, 8)}
          {renderSequenceGroup("Drop", 16, 8)}
          {renderSequenceGroup("Custom", 24, 8)}
        </div>
      </div>

      {/* MIDDLE COLUMN: GENERATORS (Fixed Width) */}
      <div className="w-[450px] shrink-0 flex flex-col px-4 pt-2 pb-4 border-r border-black overflow-y-auto custom-scrollbar relative">
        <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-2 shrink-0 text-center">GENERATORS</h2>
        
        <div className="grid grid-cols-2 grid-rows-4 flex-1 gap-[2px] bg-black/50 p-[2px] border border-white/10 rounded-sm overflow-hidden">
          
          {/* Random */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("random", randomCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Random
            </button>
            <div className="flex justify-around items-end p-3 flex-1 pb-4 pt-6">
              <Knob label="Density" value={randomCfg.density} max={100} onChange={v => { const next = {...randomCfg, density: v}; setRandomCfg(next); applyGen("random", next); }} />
              <Knob label="Variation" value={randomCfg.variation} max={100} onChange={v => { const next = {...randomCfg, variation: v}; setRandomCfg(next); applyGen("random", next); }} />
            </div>
          </div>

          {/* Wave */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("wave", waveCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Wave
            </button>
            <div className="flex justify-around items-end p-3 flex-1 pb-4 pt-6">
              <Knob label="Width" value={waveCfg.width} max={100} onChange={v => { const next = {...waveCfg, width: v}; setWaveCfg(next); applyGen("wave", next); }} />
              <Knob label="Speed" value={waveCfg.speed} max={100} onChange={v => { const next = {...waveCfg, speed: v}; setWaveCfg(next); applyGen("wave", next); }} />
            </div>
          </div>

          {/* Mirror */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("mirror", mirrorCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Mirror
            </button>
            <div className="flex flex-col p-3 flex-1 pb-2 pt-6">
               <div className="flex justify-around items-end mb-2">
                 <Knob label="Amount" value={mirrorCfg.amount} max={100} onChange={v => { const next = {...mirrorCfg, amount: v}; setMirrorCfg(next); applyGen("mirror", next); }} />
                 <Knob label="Angle" value={mirrorCfg.angle} max={100} onChange={v => { const next = {...mirrorCfg, angle: v}; setMirrorCfg(next); applyGen("mirror", next); }} />
               </div>
               <div className="flex flex-wrap gap-2 text-[8px] font-bold uppercase tracking-wider justify-start">
                  {["triangle","x","diamond","funnel"].map(shape => (
                    <button key={shape} onClick={() => { const next = {...mirrorCfg, shape: shape as any}; setMirrorCfg(next); applyGen("mirror", next); }} 
                            className={`transition-colors ${mirrorCfg.shape === shape ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{shape}</button>
                  ))}
               </div>
            </div>
          </div>

          {/* Sweep */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("sweep", sweepCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Sweep
            </button>
            <div className="flex flex-col p-3 flex-1 pb-2 pt-6 relative">
               <div className="flex justify-around items-end mb-2">
                 <Knob label="Slope" value={sweepCfg.slope} max={100} onChange={v => { const next = {...sweepCfg, slope: v}; setSweepCfg(next); applyGen("sweep", next); }} />
                 <Knob label="Amount" value={sweepCfg.amount} max={100} onChange={v => { const next = {...sweepCfg, amount: v}; setSweepCfg(next); applyGen("sweep", next); }} />
               </div>
               <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wider h-4">
                  <div className="flex gap-2">
                    {["left","right","up","down"].map(dir => (
                      <button key={dir} onClick={() => { const next = {...sweepCfg, direction: dir as any}; setSweepCfg(next); applyGen("sweep", next); }}
                              className={`transition-colors ${sweepCfg.direction === dir ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>{dir}</button>
                    ))}
                  </div>
                  <button onClick={() => { const next = {...sweepCfg, repeat: !sweepCfg.repeat}; setSweepCfg(next); applyGen("sweep", next); }}
                          className={`absolute right-3 bottom-2 transition-colors ${sweepCfg.repeat ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Repeat</button>
               </div>
            </div>
          </div>

          {/* Block */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("block", blockCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Block
            </button>
            <div className="flex justify-around items-end p-3 flex-1 pb-4 pt-6">
              <Knob label="Spacing" value={blockCfg.spacing} max={100} onChange={v => { const next = {...blockCfg, spacing: v}; setBlockCfg(next); applyGen("block", next); }} />
              <Knob label="Shuffle" value={blockCfg.shuffle} max={100} onChange={v => { const next = {...blockCfg, shuffle: v}; setBlockCfg(next); applyGen("block", next); }} />
            </div>
          </div>

          {/* Chaser */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("chaser", chaserCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Chaser
            </button>
            <div className="flex flex-col p-3 flex-1 pb-2 pt-6 relative">
               <div className="flex justify-around items-end mb-2">
                 <Knob label="Steps" value={chaserCfg.steps} max={32} onChange={v => { const next = {...chaserCfg, steps: v}; setChaserCfg(next); applyGen("chaser", next); }} />
                 <Knob label="Stride" value={chaserCfg.stride} max={100} onChange={v => { const next = {...chaserCfg, stride: v}; setChaserCfg(next); applyGen("chaser", next); }} />
               </div>
               <div className="flex items-center text-[8px] font-bold uppercase tracking-wider h-4">
                  <button onClick={() => { const next = {...chaserCfg, repeat: !chaserCfg.repeat}; setChaserCfg(next); applyGen("chaser", next); }}
                          className={`absolute right-3 bottom-2 transition-colors ${chaserCfg.repeat ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Repeat</button>
               </div>
            </div>
          </div>

          {/* Ramp */}
          <div className="flex flex-col bg-[#111] hover:bg-[#131313] transition-colors relative h-full">
            <button 
              onClick={() => applyGen("ramp", rampCfg)}
              className="absolute top-2 left-2 text-[9px] font-bold text-[#e89f41]/80 hover:text-[#e89f41] uppercase tracking-widest z-10 transition-colors"
            >
              Ramp
            </button>
            <div className="flex flex-col p-3 flex-1 pb-2 pt-6 relative">
               <div className="flex justify-around items-end mb-2">
                 <Knob label="Amount" value={rampCfg.amount} max={100} onChange={v => { const next = {...rampCfg, amount: v}; setRampCfg(next); applyGen("ramp", next); }} />
               </div>
               <div className="flex justify-start gap-4 text-[8px] font-bold uppercase tracking-wider h-4">
                  {["in","out"].map(dir => (
                    <button key={dir} onClick={() => { const next = {...rampCfg, direction: dir as any}; setRampCfg(next); applyGen("ramp", next); }}
                            className={`transition-colors ${rampCfg.direction === dir ? 'text-[#e89f41]' : 'text-white/30 hover:text-white/70'}`}>Fade {dir}</button>
                  ))}
               </div>
            </div>
          </div>

        </div>
      </div>

      {/* RIGHT COLUMN: PROGRAM MONITOR (Remaining Space) */}
      <div className="flex-1 flex flex-col px-4 pt-2 pb-4 bg-[#050505] min-w-[300px]">
         <h2 className="text-[#e89f41]/70 text-[10px] font-bold uppercase tracking-widest mb-2 shrink-0 text-center">PROGRAM MONITOR</h2>
         <div className="flex-1 min-h-0 border border-white/5 bg-black rounded shadow-[inset_0_4px_20px_rgba(0,0,0,0.8)] flex items-center justify-center p-2 relative overflow-hidden">
             
             <div className="w-full h-full relative" style={{ isolation: 'isolate' }}>
                <PreviewMonitor />
             </div>
         </div>
      </div>

    </div>
  );
}
