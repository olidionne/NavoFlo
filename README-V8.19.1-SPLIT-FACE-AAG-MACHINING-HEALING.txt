NavoFlo V8.19.1 — SPLIT-FACE / AAG MACHINING HEALING
======================================================

Purpose
-------
Fix machining features that can disappear when a STEP exporter splits one
physical analytic surface into several B-Rep faces (periodic seam/split faces).
ST04-0026 is the regression case.

Root cause
----------
The physical center recess of ST04-0026 is represented by multiple B-Rep faces:
several cylinders, cones and tori are split into separate face fragments. A
feature recognizer that treats each face independently can lose the relationship
between these fragments or attach unrelated coaxial surfaces to the same feature.

V8.19.1 changes
---------------
1. Plate feature recognition is now AAG-component based.
   - The two external plate skins are removed from the adjacency graph.
   - Remaining connected B-Rep side/cavity faces are analyzed as physical
     feature components.
   - Periodic seam faces stay together automatically.
   - Unrelated coaxial surfaces are no longer grouped merely because they share
     an axis.

2. Both plate skins are analyzed.
   - A pure 2D profile cut preserves the same material footprint on both skins.
   - A significant top/bottom material-area mismatch is strong evidence of a
     one-sided recess / pocket / counterbore / machining operation.
   - Through holes on an otherwise cut plate do not trigger this by themselves.

3. Analytic fallback.
   - Torus on a cuttable slab => groove/fillet machining evidence.
   - Cone on a cuttable slab => countersink/chamfer machining evidence.
   - This remains active even when cylinder metadata is fragmented.

4. Round plate stock boundary is separated from central coaxial features.
   - The outer OD cylinder is treated as stock boundary.
   - Center bores/counterbores/grooves are their own AAG component.

5. Analysis cache bumped to version 4 and all Navo3D JS cache-busters to 8.19.1.
   The first load after deployment intentionally re-analyzes open STEP tabs.

Expected ST04-0026 behavior
---------------------------
Type: Plaque à découper · usinage
Process: Découpe de plaque + usinage
DXF: available
Recognized features should include the central counterbore/recess/groove and
secondary machining evidence. The B-Rep split/seam line is no longer allowed to
change the manufacturing conclusion.

Regression intent
-----------------
- ST01-0002: machined round shaft, no flat DXF.
- ST14-0002 / ST14-0004: machined round stock, no flat DXF.
- ST04-0025 / ST04-0026: round plate + secondary machining, DXF remains available.
- ST09-0003: plate + secondary machining, DXF remains available.
- Sheet metal / structural profile detection remains upstream and unchanged.
