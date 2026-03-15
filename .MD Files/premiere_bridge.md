# STEP It Out — Premiere Bridge

STEP It Out exports sequencing data into Adobe Premiere.

## Export Behaviour

For each sequencer layer:

1. Create a track in Premiere
2. Place the corresponding lighting pass
3. Generate opacity keyframes

Step active → opacity 100  
Step inactive → opacity 0

Keyframes must be placed exactly on frame boundaries.

## Sequence Settings

Resolution = match source  
FPS = match STEP It Out FPS  

Sequence length = loop length

## Track Naming

Premiere tracks must match STEP It Out layer names.