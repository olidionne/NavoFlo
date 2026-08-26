NavoFlo V8.16.8 — NavoUnfold DXF Units Fix

Base
- Includes all V8.16.7 NavoUnfold topology and DXF arc-direction fixes.

Problem corrected
- AutoCAD opened NavoUnfold DXF files with Insertion scale = Unitless.
- $MEASUREMENT=1 alone marks a drawing as metric, but does not define the actual drawing insertion unit.

V8.16.8
- DXF export now has an explicit `units` export parameter.
- Navo3D calls the exporter with `units: 'mm'`.
- DXF HEADER now writes $INSUNITS=4 (Millimeters), $MEASUREMENT=1, $LUNITS=2 and $LUPREC=4.
- DXF version is now AC1015 (AutoCAD 2000), where $INSUNITS is a standard header variable.
- The exporter can also scale correctly for in/ft/cm/m if another unit is intentionally passed later.
- Cache-busting updated to 8.16.8.

Expected AutoCAD result
- UNITS > Insertion scale > Units to scale inserted content: Millimeters.
- Existing unfolded geometry and V8.16.7 corrected slot arcs remain unchanged.
