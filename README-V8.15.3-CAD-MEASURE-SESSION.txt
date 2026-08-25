NavoFlo V8.15.3 — CAD MEASURE + SESSION
========================================

Navo3D
- Exact circular/cylindrical selections now draw a true Ø/R dimension in the viewport instead of only a center marker.
- 3D dimension labels can be dragged and remain tethered to their measurement anchor. Double-click resets label position.
- STEP exact axis directions are transformed to world coordinates for correct annotations on transformed parts.
- Open model tabs/files survive Navo3D -> Navo2D -> Navo3D navigation during the same browser session.

Navo2D
- Smart DIM detects two parallel LINE edges and builds their perpendicular separation dimension.
- CENTERMARK / CM command added, with ribbon button, for circles/arcs.
- PLINE now shows all already-picked segments while drawing plus the live rubber-band segment.
- Open DXF tabs, edits/history/view and file handles survive Navo2D -> Navo3D -> Navo2D navigation during the same browser session.

Session persistence
- CAD documents stay local in the browser and are stored in IndexedDB under a per-tab session identifier.
- No CAD geometry is uploaded to NavoFlo.
- File System Access handles are retained when supported; if a browser refuses to clone a handle, tabs/files still restore and Save As remains available.

No D1 migration.
No auth/licensing changes.
