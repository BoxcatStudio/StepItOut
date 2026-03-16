# STEP It Out

Tauri v2 desktop sequencer for animating light pass layers in video compositing. React/TypeScript frontend, Rust backend, Zustand state, Tailwind CSS.

## Architecture

```
src/
  components/     # React UI (TitleBar, TopBar, SequencerGrid, BottomPanel, LayerRow, etc.)
  store/          # Zustand store (useSequencerStore.ts) — single source of truth
  engine/         # Playback, envelope math, pattern generators, WebGL compositor, MP4 exporter
  types/          # TypeScript types (LightLayer, StepSequence, GeneratorConfig, etc.)

src-tauri/
  src/commands/   # Tauri commands: file_io.rs, sequence.rs, premiere.rs
  src/            # premiere_xml.rs (FCP XML generation), lib.rs, main.rs
  capabilities/   # Permissions (main.json)
```

## Key Patterns

- **Store**: Zustand with undo/redo (max 50 snapshots). Auto-saves to `~/Documents/StepItOut/project_state.json` (500ms debounce).
- **Pattern Bank**: 32 slots (Build 1-8, Break 9-16, Drop 17-24, Custom 25-32). `switchBankSlot` auto-saves current, loads target. Each slot stores patterns + division + attack/decay per layer.
- **Generators**: 8 types (random, wave, mirror, sweep, block, chaser, ramp, shapes). Applied via `applyLiveGenerator()`. `lastAppliedGenerator` tracked per sequence for recall.
- **File format**: `.stepseq` JSON — contains fps, loop_seconds, lights[], sequence_bank[], active_bank_slot, project_name.
- **Export**: XML-Chopped (additive clips), XML-Matte (track matte), MP4 (Web Worker + VideoEncoder + mp4-muxer).
- **Envelope**: Attack/decay with 6 curve presets (pulse, smooth, strobe, ramp, exponential, slow).
- **Preview**: WebGL2 additive blend compositor in PreviewMonitor.
- **Titlebar**: Custom (decorations: false). Drag via `-webkit-app-region: drag/no-drag` CSS. Window controls need `no-drag` on each button.
- **Updater**: Checks GitHub Releases endpoint on launch. Signed with Tauri signer keypair.

## Deploy

- `.\DEPLOY.bat` — One-click: bumps patch version across package.json/Cargo.toml/tauri.conf.json, builds NSIS installer, commits, tags, pushes to trigger GitHub Actions.
- GitHub Actions (`.github/workflows/release.yml`) — Triggers on `v*` tags, builds signed installer, creates Release with `latest.json` for auto-updates.
- Signing key at `~/.tauri/stepitout.key` (also accidentally in project `~/` dir). Secrets: `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` on GitHub.

## Version

- `__APP_VERSION__` injected at build time via `vite.config.ts` reading `package.json`.
- Three files must stay in sync: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`. DEPLOY.bat handles this.

## Conventions

- Orange accent: `#e89f41`
- Dark theme: `#0a0a0a` to `#111`
- Text sizes: 7-10px, uppercase tracking-widest for labels
- Components that use pointer capture (Knob, drag interactions) MUST be defined outside the parent component function to maintain stable React identity.
- Modals that need to escape `overflow-hidden` containers use `createPortal(... , document.body)`.
- Tauri v2 permissions in `src-tauri/capabilities/main.json` — add new ones there, not in tauri.conf.json.

## Don'ts

- Don't define components inside render functions (breaks pointer capture / remounts on every render).
- Don't use `window.confirm` in Tauri webview (unreliable). Use React state-based confirmation modals.
- Don't use `data-tauri-drag-region` attribute alone — use `-webkit-app-region: drag` CSS instead.
- Don't use `appWindow.startDragging()` JS API — it captures mouse and breaks click events.
