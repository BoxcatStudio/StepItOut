import { useEffect } from "react";
import { useSequencerStore } from "../store/useSequencerStore";

export function useKeyboardShortcuts() {
  const { isPlaying, setIsPlaying } = useSequencerStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement;
      
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault();
          if (e.shiftKey) {
            useSequencerStore.getState().redo();
          } else {
            useSequencerStore.getState().undo();
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (!isInput) {
           e.preventDefault();
           useSequencerStore.getState().redo();
        }
        return;
      }

      if (isInput) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, setIsPlaying]);
}
