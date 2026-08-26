NavoFlo V8.17.1 — NavoUnfold Full Flat Face Selection + Cycle Closure Fix

Base
- Built directly on V8.17.0.
- Keeps V8.16.10 AutoCAD R2000 DXF export and inches-by-default behavior.
- Keeps V8.17.0 automatic unfold, automatic K-factor, compact properties UI and skew/angled-bend fix.

Fix 1 — complete face selection in flat view
- Top flat regions remain selectable.
- Bottom/underside regions are now selectable.
- Hole walls and exterior plate-thickness walls are now selectable.
- These faces participate in the existing flat measurement workflow, including face area and point-to-point measurements.
- Thickness walls are built from the exact physical CUT boundary whenever the exact boundary closes.

Fix 2 — false slit when a hole crosses a bend
Observed on uploaded 25021600_503-00-01_0.step.
The large through-hole crosses a bend and splits one physical cylindrical bend into separate B-Rep patches.
V8.17.0 treated the resulting surface-graph cycle as a production seam and omitted the final bend patch.
That omitted patch appeared as an artificial slit in the flat pattern.

V8.17.1 now:
- reconstructs a cycle/closure bend when both unfold paths predict the same flat transform;
- measures the closure error against the already mapped child panel;
- keeps the bend patch when the closure is geometrically consistent;
- retains the conservative seam fallback only when the cycle really is inconsistent.

Actual STEP validation in the patch build environment
- 25021600_503-00-01_0.step
  - thickness detected: 19.05 mm
  - 4 bend patches retained
  - 1 harmless cycle closure reconstructed
  - closure error: ~3.4e-13 mm
  - no cyclic seam warning
  - exact CUT primitives closed
- ST01-0004_0.step
  - thickness detected: 2.667 mm
  - 2 bends / 3 panels
  - no warnings
  - exact CUT primitives closed

Rendering hardening
- The visible flat outline and thickness-wall geometry now use the exact B-Rep CUT primitives whenever they form a closed contour.
- Raw tessellation boundary edges remain only as a fallback.
- This prevents internal flange/bend tangent seams from being drawn as fake exterior edges.

DXF validation
- 503 test DXF: AutoCAD R2000, INSUNITS=1 (inches), ezdxf audit 0 errors / 0 fixes.
- ST01 test DXF: AutoCAD R2000, INSUNITS=1 (inches), ezdxf audit 0 errors / 0 fixes.

Deployment
Deploy all files in this patch so cache-busting remains synchronized:
- public/js/viewer.js
- public/js/sheetmetal-engine.js
- public/js/step-worker.js
- public/js/dxf-r2000-template.js
- public/navo3d/index.html
- public/en/navo3d/index.html
