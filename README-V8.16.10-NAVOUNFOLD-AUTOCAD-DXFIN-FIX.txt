NavoFlo V8.16.10 — NavoUnfold AutoCAD DXFIN strict compatibility fix
====================================================================

SYMPTOM
- AutoCAD still stopped on "Press ENTER to continue" when opening the DXF.
- V8.16.9 was readable by tolerant DXF parsers but its AC1015/R2000 document
  shell was incomplete for strict AutoCAD DXFIN.

ROOT CAUSE
- The V8.16.9 BLOCK_RECORD entries for *Model_Space and *Paper_Space did not
  point to real LAYOUT objects and the file omitted the corresponding full
  CLASSES/OBJECTS structure expected by a normal R2000 document.

FIX
- Replaced the compact handwritten R2000 shell with a complete AC1015 document
  template containing standard TABLES, BLOCK_RECORD/LAYOUT relationships,
  BLOCKS, CLASSES and OBJECTS sections.
- Dynamic CUT/BEND entities are injected into the real model-space block record.
- Dynamic entity handles start at 0x1000 to avoid collisions with document handles.
- DXF remains physically exported in inches by default.
- $INSUNITS = 1 (Inches), $MEASUREMENT = 0.
- V8.16.7 arc/slot direction correction and all unfold fixes are preserved.

FILES
- public/js/dxf-r2000-template.js   <-- NEW, MUST BE DEPLOYED
- public/js/sheetmetal-engine.js
- public/js/viewer.js
- public/js/step-worker.js
- public/navo3d/index.html
- public/en/navo3d/index.html

VALIDATION PERFORMED
- ES module import/syntax: OK
- Generated AC1015 DXF: OK
- ezdxf recovery/audit: 0 errors, 0 fixes
- Units read back as Inches (1)
- Model-space entity owners resolve to the actual *Model_Space BLOCK_RECORD
- LibreOffice Draw DXF import/conversion: OK

IMPORTANT
Because dxf-r2000-template.js is a new file, deploy the entire patch tree rather
than replacing only sheetmetal-engine.js.
