import { useState } from "react";
import { convertFileSrc, isTauri } from "@tauri-apps/api/core";

function getImageSrc(filePath: string): string {
  if (isTauri()) {
    try {
      return convertFileSrc(filePath);
    } catch {
      return "";
    }
  }
  return filePath.startsWith("http") ? filePath : "";
}

interface LayerThumbnailProps {
  filePath: string;
  size?: number;
}

export function LayerThumbnail({ filePath, size = 40 }: LayerThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const src = getImageSrc(filePath);
  if (!src) {
    return (
      <div
        className="shrink-0 bg-[#333] border border-white/30 flex items-center justify-center"
        style={{ height: size, width: '100%' }}
      >
        <span className="text-white/50 text-xs">—</span>
      </div>
    );
  }

  return (
    <div
      className="shrink-0 overflow-hidden border border-white/30 bg-black flex items-center justify-center"
      style={{ height: size, width: '100%' }}
    >
      <img
        src={src}
        alt=""
        className="h-full w-full object-contain"
        style={{ display: loaded ? "block" : "none" }}
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <div className="w-full h-full flex items-center justify-center bg-[#333]">
          <span className="text-white/50 text-xs">…</span>
        </div>
      )}
    </div>
  );
}
