# STEP It Out — Sequencer Rules

The STEP It Out sequencer must operate on a **frame‑accurate timing system**.

## Timing Model

Example:

Loop Length = 8 seconds  
FPS = 30  

Total Frames = 240

Every sequencer step corresponds to a precise frame range.

FramesPerStep = TotalFrames / StepsPerDivision

## Playhead

playhead_x = current_frame * pixels_per_frame

The playhead must align perfectly with the grid.

## Grid Rules

step_width = 16px  
step_height = 16px  
step_gap = 2px  

Steps must never stretch.

If more steps are required the grid scrolls horizontally.

## Timeline Alignment

Timeline markers must align exactly with step columns.

timeline_marker_x = step_index * step_width

## Layer Timing

Each layer can have its own division.

Examples:

Key Light → 1/16  
Rim Light → 1/8  
Back Light → 1/4  

Changing division rebuilds that layer’s grid immediately.

## Interaction

click → toggle step  
drag → paint steps  
shift + drag → erase