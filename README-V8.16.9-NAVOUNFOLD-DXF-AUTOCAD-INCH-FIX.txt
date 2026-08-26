NavoFlo V8.16.9 — NavoUnfold DXF AutoCAD + Inch default fix

Problem corrected
- V8.16.8 declared AC1015 but still wrote R12-style TABLE/ENTITY records. AutoCAD could stop on open with "Press ENTER to continue".
- Export default was millimetres.

Fix
- DXF writer is now a standards-compliant AutoCAD 2000 (AC1015) ASCII DXF with required subclass/owner records, layer/linetype/block-record tables and model/paper-space blocks.
- $INSUNITS is preserved and explicit.
- Default export is now inches: units='in', $INSUNITS=1, $MEASUREMENT=0.
- Geometry is physically converted from native mm to inches (÷25.4), so the DXF is true 1:1 inches, not only tagged as inches.
- CUT and BEND layers are preserved.
- V8.16.7 arc-direction/topology fixes are preserved.
- Cache-busting updated to 8.16.9.

Files to deploy
- public/js/sheetmetal-engine.js
- public/js/viewer.js
- public/js/step-worker.js
- public/navo3d/index.html
- public/en/navo3d/index.html
