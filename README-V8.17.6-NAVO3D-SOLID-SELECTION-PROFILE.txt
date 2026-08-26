NavoFlo V8.17.6 — Navo3D solid section + flat logical faces + profile recognition
=================================================================================

Changes from V8.17.5

1) Flat-pattern logical face selection
   - Exact CUT primitives now carry the source side-face IDs.
   - The flattened wall picker groups those IDs using the same OCCT logical-face
     groups used by the folded STEP viewer.
   - A cylindrical hole split into several B-Rep fragments therefore selects as
     one complete cylindrical wall after unfolding.

2) Conservative profile / extrusion recognition
   - Added a local, offline geometric classifier before NavoUnfold bend analysis.
   - It recognizes long profile/extrusion geometry from exact linear B-Rep edge
     direction clusters, length/cross-section aspect ratio, repeated longitudinal
     traces, and side-surface alignment.
   - Exact flat plates are classified first and are never stolen by this detector.
   - High-confidence profile/extrusion results suppress sheet-metal unfold/DXF
     actions and are shown as "Profilé / extrusion" in Properties > Type.
   - A manual manufacturing intent cannot be proved from geometry when two parts
     are mathematically identical; this detector is intentionally conservative.

Regression STEP metrics used during development:
   500-00-11  aspect 24.00  -> profile
   500-00-21  aspect 32.25  -> profile
   500-00-22 #1 aspect 32.25 -> profile
   500-00-22 #2 aspect 13.08 -> profile (miter/oriented member supported)
   502-01-09  aspect 2.82   -> profile
   ST01-0004  aspect 1.84   -> remains sheet-metal candidate
   ST01-0005  aspect 1.00   -> remains sheet-metal candidate
   503-00-01  aspect 1.75   -> remains sheet-metal candidate

3) Solid-looking section cuts
   - STEP remains the exact OCCT B-Rep solid used for exact measurement.
   - Three.js still renders boundary triangles (as every raster CAD viewer does),
     but section mode now adds a stencil-based cap on the clipping plane.
   - The section therefore appears filled/solid instead of looking like a hollow
     shell, without voxelization or loss of B-Rep topology.

Changed files
   public/js/viewer.js
   public/js/sheetmetal-engine.js
   public/navo3d/index.html
   public/en/navo3d/index.html
