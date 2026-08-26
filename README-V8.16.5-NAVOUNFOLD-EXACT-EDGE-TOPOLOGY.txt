NavoFlo V8.16.5 — NavoUnfold Exact Edge Topology

Fixes a real-browser failure where a valid STEP bend could be lost even though T/R/K were resolved.

Changes:
- Bend connectivity now prefers exact OCCT B-Rep LINE metadata instead of tessellated edge polylines.
- STEP worker retains a safe copy of edge topology/endpoints before transferable buffers are handed to the browser.
- Exact edge start/end points are returned by sheetmetal-face-info even when MeasureExactEdgeLength omits them.
- Cylindrical tangent generators can be reconstructed from cylinder axis + planar face equation when edge polylines are absent.
- Added radial/topological bend-pair fallback for valid axial cylinder boundaries.
- NavoUnfold engine revision 1.5.

Regression: 25021600_502-00-11_0.step, fixed Face #14
T=6.35 mm, Ri=15.875 mm, angle=90 deg, K=0.45, BA=29.424942 mm, flat=226.274942 x 53.975 mm.

No D1/auth/licensing changes.
