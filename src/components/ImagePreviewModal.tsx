import { useEffect, useState } from "react";

interface ImagePreviewModalProps {
  filePath: string;
  name: string;
  onClose: () => void;
}

export function ImagePreviewModal({ filePath, name, onClose }: ImagePreviewModalProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const { convertFileSrc } = await import("@tauri-apps/api/core");
        setSrc(convertFileSrc(filePath));
      } catch {
        setSrc(filePath);
      }
    })();
  }, [filePath]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-[80vw] max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-[#1a1a1a] border border-[#e89f41]/30 text-white/60 hover:text-white flex items-center justify-center text-sm z-10 transition-colors"
        >
          &times;
        </button>
        <div className="bg-[#111] border border-white/10 rounded-lg overflow-hidden shadow-2xl">
          <div className="px-3 py-1.5 bg-[#0a0a0a] border-b border-white/5">
            <span className="text-[10px] font-bold text-[#e89f41]/70 uppercase tracking-widest">{name}</span>
          </div>
          {src && (
            <img
              src={src}
              alt={name}
              className="max-w-[80vw] max-h-[70vh] object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}
