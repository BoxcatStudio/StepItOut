# STEP It Out

A desktop step sequencer for animating light pass layers used in video compositing.

## Purpose

STEP It Out replaces manual opacity keyframing for AOV light passes with a deterministic sequencer. The tool generates opacity animation for light passes that will be rendered in Adobe Premiere Pro.

**Target users:** Video editors and motion designers working with rendered light passes.

**Primary workflow:** Cinema4D → render AOV light passes → STEP It Out sequencing → Premiere render.

## Features

- Deterministic loop system (4s, 8s, 16s, 32s)
- Step sequencer grid (FL Studio–inspired layout)
- Per-layer controls: division, attack, decay, intensity, curve preset
- Pattern generators: chase, sweep, pingpong, burst, strobe, random, wave
- Realtime preview with additive blending
- Export to Premiere Pro via FCP 7 XML

## Tech Stack

- **Desktop:** Tauri v2 (Rust)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Outputs are in `src-tauri/target/release/bundle/`.

## Usage

1. **Import** light pass files (images or video) via the Import button
2. Each pass becomes a row in the sequencer
3. **Click** or **drag** on the grid to paint steps
4. Adjust **division**, **attack**, **decay**, **intensity**, and **curve** per layer
5. Use **pattern generators** for quick pattern creation
6. **Preview** updates in realtime as you edit
7. **Save** as `.stepseq` for later editing
8. **Export Premiere** to generate an FCP 7 XML file for import into Adobe Premiere Pro

## File Formats

- **Sequence:** `.stepseq` (JSON)
- **Export:** FCP 7 XML (Premiere Pro native import)

## License

MIT
