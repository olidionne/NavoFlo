NavoFlo V8.15.2 — CAD WORKFLOW + DIMENSIONS
============================================

Base: V8.15.1 CAD Visual + Logical Faces.
No D1 migration. No auth/licensing/security change.

NAVO3D
------
1. Angular dimensions
   - Face/face planar angular measurements now draw a real 3D angular dimension:
     witness lines, arc, arrowheads and floating value.

2. Logical STEP cylinders / holes
   - Split cylindrical STEP faces are treated as one logical cylindrical face.
   - Internal seam edges between those faces are hidden automatically.
   - Split circular STEP edges with the same exact center/radius/axis are grouped as
     one logical circular edge for selection/highlighting/length inspection.

3. Face-to-face distance
   - Parallel planar face-to-face measurements draw the dimension perpendicular to
     the faces instead of drawing the click-to-click diagonal/hypotenuse.

4. Save / Save As
   - Chrome/Edge File System Access support.
   - If the model was opened with NavoFlo's file picker, Save writes to that same
     source file handle.
   - Save As opens the browser's native save picker.
   - Navo3D is currently an inspector, not a B-Rep editor, so Save currently writes
     the original source model bytes. View/measurement state is not embedded into STEP.

NAVO2D
------
1. Clipboard between Navo2D document tabs
   - Ctrl+C copies selected CAD entities.
   - Ctrl+V pastes them into the active Navo2D tab.
   - Layer definitions needed by the pasted entities are recreated when necessary.
   - COPYCLIP / PASTECLIP command aliases are available.
   - NavoFlo also attempts to accept raw textual DXF data from the system clipboard.

   AutoCAD note:
   Native AutoCAD entity clipboard formats are private Windows clipboard formats that
   normal browser JavaScript cannot read/write. Therefore seamless native AutoCAD
   Ctrl+C -> NavoFlo Ctrl+V (and vice versa) is NOT guaranteed by this web-only patch.
   True native entity-level interoperability would require a small local NavoFlo bridge
   or AutoCAD add-in. Navo2D-to-Navo2D clipboard is implemented now.

2. Smart angular dimensions
   - DIM can now select a first LINE then a second intersecting LINE to create an
     angular dimension.
   - The placement point chooses the angular sector, including exterior/reflex angles.
   - Existing DIMANGULAR uses the same sector-aware renderer.

3. Save / Save As
   - Ctrl+S = Save, Ctrl+Shift+S = Save As.
   - SAVE/QSAVE and SAVEAS commands supported.
   - When opened with the native Chrome/Edge file picker, Save writes back to the
     original DXF file/folder after browser permission.
   - Drag/drop or legacy <input> opening has no persistent source file handle, so its
     first Save uses Save As/download fallback.

4. Dynamic command feedback
   - Transform commands keep a stable source selection through their interactive steps.
   - Rotation now has both live transformed-entity preview and a visible angular guide.
   - Existing live previews for Move, Copy, Stretch, Scale, Mirror, Offset, Trim,
     Extend, Fillet, Chamfer, Break and arrays remain active.

VALIDATION PERFORMED
--------------------
- node --check passed for all JavaScript files in public/js, src and functions.
- FR/EN Navo2D/Navo3D HTML checked for duplicate IDs: none.
- Angular-sector math checked at 90/270 and 120/240 degrees.
- 3D plane-intersection math sanity checked.
- Diff versus V8.15.1 limited to the intended 8 CAD/UI files plus this README.

FILES CHANGED
-------------
public/js/navo2d.js
public/js/viewer.js
public/js/step-worker.js
public/navo2d/index.html
public/en/navo2d/index.html
public/navo3d/index.html
public/en/navo3d/index.html
public/css/navo2d.css
