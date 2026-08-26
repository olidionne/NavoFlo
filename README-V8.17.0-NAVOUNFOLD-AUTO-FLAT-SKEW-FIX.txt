NavoFlo V8.17.0 — NavoUnfold Auto + Flat Selection + Skew Bend Fix
Baseline: V8.16.10

WHAT CHANGED
============

1) ONE-CLICK / AUTOMATIC UNFOLD
- STEP sheet-metal preflight starts quietly after the file opens.
- Toolbar "Déplier / Unfold" is now the direct folded/flat toggle.
- Clicking DÉPLIÉE / FLAT automatically calculates the flat pattern if needed.
- No fixed-face click is required by default.
- NavoUnfold automatically chooses a large planar flange connected to real bend topology.
- Thickness is auto-detected from paired coaxial cylindrical bend skins when available.
- Inside radius is resolved from paired cylinders / cylinder orientation as before.
- K-factor remains CD-401 and is resolved per bend from R/T and the current material family.
- Manual T, R, K and fixed-face overrides are still available.

2) SIMPLIFIED PROPERTY PANEL
- The normal sheet-metal panel now shows only:
  folded/flat state, status, T used, K-factor, bend count, flat size and DXF export.
- Material, T/R override, manual K, fixed face, bend calculations and CD-401 table are inside
  "Paramètres avancés / correction manuelle".

3) SELECTION + MEASUREMENT IN FLAT VIEW
- Flat planar regions and bend strips are selectable as faces.
- CUT edges/curves and bend lines are selectable as edges.
- Developed contour vertices are selectable.
- Measure remains enabled in the flat view.
- Single flat edge length and flat-region area are available.
- Two selected flat entities support distance and angle measurement using the existing measure UI.

4) ANGLED / SKEW BEND OPEN-CONTOUR FIX
The old mapping used each tangent boundary's own midpoint as its axial origin. On a bend whose
side trim is angled, parent and child tangent boundaries can have different axial midpoints. That
shifted the child flange along the bend axis and could create wedges, gaps and open contours.

V8.17.0 now:
- uses one absolute axial datum across the parent tangent, bend strip and child tangent;
- offsets the child map by (childAxisMid - parentAxisMid);
- maps cylindrical tessellation by a normalized 0 -> 1 exact radial sweep, preventing sign/orientation
  mismatches from throwing bend triangles to the wrong side;
- checks exact CUT primitive closure before DXF export;
- if exact primitives are open, DXF automatically falls back to the welded triangulated boundary
  rather than exporting an open CUT chain.

5) DXF BEHAVIOR PRESERVED
- Complete AutoCAD R2000 / AC1015 structure from V8.16.10 is preserved.
- Default export remains INCHES.
- $INSUNITS = 1.
- Geometry is converted mm -> inches (1:1 physical size).
- CUT / BEND layers preserved.

FILES
=====
public/navo3d/index.html
public/en/navo3d/index.html
public/js/viewer.js
public/js/sheetmetal-engine.js
public/js/dxf-r2000-template.js
public/js/step-worker.js

VALIDATION PERFORMED
====================
- node --check: viewer.js OK
- node --check: sheetmetal-engine.js OK
- node --check: dxf-r2000-template.js OK
- DXF R2000 test parsed by ezdxf: AC1015, INSUNITS=1, audit 0 errors / 0 fixes
- Open primitive-chain test correctly falls back to closed boundary LINE entities
- Synthetic skew-bend topology test:
  * T auto-detected = 2 mm
  * automatic fixed face selected successfully
  * 1 bend unfolded successfully
  * a 20 mm difference between parent/child bend-boundary axial midpoints is preserved as a
    20 mm child-flange axial shift in the flat mapping instead of being lost.

IMPORTANT TEST
==============
Please retest the exact angled-bend STEP shown in the screenshots. The math change specifically
targets that topology. If one exact real-world STEP still creates an open contour, keep that STEP
file: it will let us inspect the exact OCCT edge ownership / trim curves for the remaining case.
