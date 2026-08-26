NavoFlo V8.16.3 — NavoUnfold Bend Classification & Angle Recovery

Fixes a real STEP case that reached [zero-bend] even though T, R and K were resolved.

Changes:
- Classifies cylindrical sheet bends by topology instead of treating every cylinder touching the fixed panel as a bend.
- Rejects hole/slot/groove/split-face cylinders whose axis is not tangent to both flange planes.
- Rejects cylinders joining parallel/coplanar planes for the standard-bend MVP.
- Selects the best tangent flange pair when a STEP cylinder has more than two planar neighbours.
- Adds independent bend-angle recovery from panel travel direction.
- Cross-checks cylinder sweep vs panel travel and falls back to panel travel when STEP boundary metadata disagrees.
- Reports rejected non-bend cylinders in diagnostics.

No D1 migration. No auth/licensing changes.
