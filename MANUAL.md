# STEP It Out — Manual

## What Is It?

A step sequencer for animating light pass layers. Import your rendered light pass images, create rhythmic patterns, export to Premiere Pro XML or MP4.

## Getting Started

1. **Import layers** — Click IMPORT in the top bar. Select individual images or a folder of light pass PNGs.
2. **Draw patterns** — Click cells in the grid to toggle steps on/off. Click-drag to paint multiple.
3. **Adjust envelope** — Use the Attack/Decay knobs per-layer (or shift-click for global).
4. **Preview** — Hit PLAY (or Spacebar) to see the composite in the Program Monitor.

## Sequences

The bottom-left has 32 sequence slots in 4 groups:
- **BUILD** (1-8), **BREAK** (9-16), **DROP** (17-24), **CUSTOM** (25-32)

Click a slot to switch. Your current patterns auto-save when switching.

## Generators

8 pattern generators fill all layers at once:
- **RANDOM** — Sparse noise (density + variation)
- **WAVE** — Sinusoidal sweep (width + speed)
- **MIRROR** — Geometric shapes (triangle/X/diamond/funnel)
- **SWEEP** — Linear progression (direction + slope)
- **BLOCK** — Regular spacing with shuffle
- **CHASER** — Marching lights (steps + stride)
- **RAMP** — Fade in/out
- **SHAPES** — Geometric shapes (circle/triangle/square/star/smiley)

Click the generator name to apply. Tweak knobs to adjust. The orange dot shows which generator was last used on the current sequence.

## Export

Click **EXPORT** to open the export modal:
- **XML — Chopped** — Separate clips per step, additive blend. Import into Premiere Pro.
- **XML — Matte** — Track matte approach. Cleaner blending in Premiere.
- **MP4** — Rendered video file with additive compositing.

Select which sequence slots to include, then choose format.

## Save / Load

- **SAVE** — Saves as `.stepseq` file (all layers, all 32 sequence slots, project name).
- **LOAD** — Opens a `.stepseq` file.
- Auto-save runs in the background. Your work is preserved if the app closes unexpectedly.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play / Pause |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |

## Clearing

- **CLEAR** button — Clears all patterns (keeps layers). Asks for confirmation.
- **X** button — Removes all layers and patterns. Asks for confirmation.

## Updates

The app checks for updates on launch. If a new version is available, you'll see a notification with a download button. Click to update in-place.

## Deploy (Developer)

Double-click `DEPLOY.bat` to build and release a new version. It auto-bumps the version, builds the installer, commits, and pushes to GitHub where the signed release is created automatically.
