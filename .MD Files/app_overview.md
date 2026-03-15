# STEP It Out — Application Overview

STEP It Out is a desktop sequencing tool used to generate lighting and AOV pass timing for video editing workflows.

The purpose of the tool is to allow a user to sequence lighting passes in a rhythmic, frame‑accurate way and then export those sequences into Adobe Premiere as opacity keyframes.

The software behaves similarly to a musical step sequencer (Ableton / FL Studio style), but instead of triggering sounds it triggers video layers.

## Core Workflow

1. Import a folder containing rendered lighting passes (AOVs).
2. Each pass becomes a layer in the sequencer.
3. The user programs timing patterns per layer.
4. STEP It Out converts these patterns into frame‑accurate opacity automation.
5. A Premiere sequence is generated automatically.

One STEP It Out sequence = one Premiere sequence.

Sequencing always happens in STEP It Out first. Premiere is only used for playback and final editing.

## Core Components

1. Sequencer Engine
2. User Interface
3. Premiere Export Bridge

All three must reference the same frame‑based timing system.