import { useState } from "react";
import { useSequencerStore, hasNonZeroPatterns } from "../store/useSequencerStore";

export type ExportFormat = "xml-chopped" | "xml-matte" | "mp4";

interface ExportModalProps {
  onExport: (format: ExportFormat, selectedSlots: number[]) => void;
  onClose: () => void;
}

const BANK_GROUPS = [
  { label: "Build", start: 0, count: 8 },
  { label: "Break", start: 8, count: 8 },
  { label: "Drop", start: 16, count: 8 },
  { label: "Custom", start: 24, count: 8 },
];

export function ExportModal({ onExport, onClose }: ExportModalProps) {
  const sequenceBank = useSequencerStore(s => s.sequenceBank);
  const activeBankSlot = useSequencerStore(s => s.activeBankSlot);
  const sequence = useSequencerStore(s => s.sequence);

  // Find all slots with data (including active if it has patterns)
  const populatedSlots = new Set<number>();
  sequenceBank.forEach((bank, i) => {
    if (bank !== null) populatedSlots.add(i);
  });
  if (hasNonZeroPatterns(sequence.lights)) {
    populatedSlots.add(activeBankSlot);
  }

  const [selected, setSelected] = useState<Set<number>>(() => new Set(populatedSlots));
  const [format, setFormat] = useState<ExportFormat>("xml-chopped");

  const toggleSlot = (slot: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(populatedSlots));
  const deselectAll = () => setSelected(new Set());

  const handleExport = () => {
    const slots = Array.from(selected).sort((a, b) => a - b);
    onExport(format, slots);
  };

  const formatOptions: { id: ExportFormat; label: string; desc: string }[] = [
    { id: "xml-chopped", label: "XML - Chopped", desc: "Separate clips per step, additive blend" },
    { id: "xml-matte", label: "XML - Matte", desc: "Track matte with white solids" },
    { id: "mp4", label: "MP4 Video", desc: "Render current sequence to video" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#1a1a1a] border border-[#e89f41]/30 rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-white/5">
          <h2 className="text-[#e89f41] text-sm font-bold uppercase tracking-widest">Export</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg transition-colors">&times;</button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: Sequence Selection */}
          <div className="w-[280px] border-r border-white/5 p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Sequences</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-[9px] text-[#e89f41]/60 hover:text-[#e89f41] uppercase tracking-wider transition-colors">All</button>
                <button onClick={deselectAll} className="text-[9px] text-white/30 hover:text-white/60 uppercase tracking-wider transition-colors">None</button>
              </div>
            </div>

            {BANK_GROUPS.map(group => (
              <div key={group.label} className="mb-3">
                <span className="text-[9px] font-bold text-[#e89f41]/60 uppercase tracking-widest">{group.label}</span>
                <div className="grid grid-cols-4 gap-[2px] mt-1">
                  {Array.from({ length: group.count }).map((_, i) => {
                    const slot = group.start + i;
                    const hasData = populatedSlots.has(slot);
                    const isSelected = selected.has(slot);

                    return (
                      <button
                        key={slot}
                        onClick={() => hasData && toggleSlot(slot)}
                        disabled={!hasData}
                        className={`h-7 relative flex items-center justify-center text-[9px] font-bold tracking-widest transition-all rounded-sm ${
                          !hasData
                            ? 'bg-black/40 text-white/10 cursor-not-allowed'
                            : isSelected
                            ? 'bg-black/40 text-[#e89f41] hover:bg-black/80'
                            : 'bg-black/40 text-white/30 hover:text-white/60 hover:bg-black/80'
                        }`}
                      >
                        {slot + 1}
                        {hasData && <div className={`absolute top-1 right-1 w-1 h-1 rounded-full transition-colors ${isSelected ? 'bg-green-500/80' : 'bg-white/20'}`} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Format Selection */}
          <div className="flex-1 p-3 flex flex-col">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">Format</span>

            <div className="flex flex-col gap-1 flex-1">
              {formatOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={`text-left px-2 py-2 rounded-sm transition-all bg-black/40 hover:bg-black/80`}
                >
                  <div className={`text-[11px] font-bold uppercase tracking-widest ${format === opt.id ? 'text-[#e89f41]' : 'text-white/30'}`}>
                    {opt.label}
                  </div>
                  <div className="text-[9px] text-white/20 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Export Button */}
            <button
              onClick={handleExport}
              disabled={format !== "mp4" && selected.size === 0}
              className="mt-4 w-full py-2.5 bg-[#e89f41] hover:bg-[#d08e38] disabled:bg-white/10 disabled:text-white/20 text-black font-bold text-[11px] uppercase tracking-widest rounded transition-colors"
            >
              Export {format === "mp4" ? "Video" : `${selected.size} Sequence${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
