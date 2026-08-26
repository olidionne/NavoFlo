# NavoFlo V8.15.4 — AutoCAD / eDrawings parity audit

Date: 2026-08-25

Goal: make a user coming from AutoCAD (Navo2D) or eDrawings/SOLIDWORKS (Navo3D) feel immediately at home, while keeping NavoFlo local-first and browser-based.

Official behavior references used for this audit:
- Autodesk AutoCAD 2026 Function Key Reference: F3 OSNAP, F7 GRID, F8 ORTHO, F9 SNAP, F10 POLAR, F11 OTRACK, F12 Dynamic Input; F8/F10 mutually exclusive.
- Autodesk AutoCAD DIM/DIMENSION: smart dimensioning from objects or points, with linear/aligned/angular/radius/diameter previews.
- Autodesk AutoCAD shortcut reference: Ctrl+S / Ctrl+Shift+S, Ctrl+Tab / Ctrl+Shift+Tab, Esc / Ctrl+[ command cancellation.
- SOLIDWORKS eDrawings 2025: middle mouse rotate, arrows 10°, Shift+arrows 90°, F Zoom to Fit, Z / Shift+Z zoom, standard views, perspective, selection filters, Measure callouts, display styles.

## 1. Navo2D — interaction parity

### Strong parity now
- Command line with typed aliases and clickable command options/hotkeys.
- Esc and Ctrl+[ / Ctrl+\\ cancel the current command.
- Enter / Space repeat or validate commands where appropriate.
- F2 expands/collapses the recent command transcript (new V8.15.4).
- F3 OSNAP, F7 GRID, F8 ORTHO, F9 grid snap, F10 POLAR, F11 OTRACK, F12 DYN.
- ORTHO and POLAR are mutually exclusive.
- AutoCAD-like drafting snaps: endpoint, midpoint, center, quadrant, intersection, apparent, perpendicular, tangent, nearest, node, geometric center, insertion, extension, parallel.
- Dynamic input near cursor for distance/angle on geometry-producing commands.
- Window/crossing selection behavior.
- Multi-document tabs; Ctrl+Tab / Ctrl+Shift+Tab cycles documents.
- Ctrl+S / Ctrl+Shift+S Save / Save As.
- Ctrl+C / Ctrl+V copies Navo2D entities between Navo2D tabs.
- User setup (grid/snap/ortho/polar/OSNAP/DYN/etc.) follows the NavoFlo account between devices.

### Drawing commands already close to AutoCAD
- LINE: live preview, Undo, close/repeat workflow.
- PLINE: complete chain remains visible during construction; dynamic next segment; Close/Undo.
- CIRCLE: radius/diameter workflow and live preview.
- ARC: live 3-point preview.
- RECTANG: live rectangle preview.
- TEXT/DTEXT: create and edit.

### Modify commands already close to AutoCAD
- MOVE, COPY, ROTATE, SCALE, MIRROR: live preview.
- ROTATE/SCALE: reference workflows.
- OFFSET: repeated offset workflow, Through/Erase/Layer options.
- TRIM/EXTEND: live candidate preview / brush-like workflow.
- FILLET/CHAMFER: live preview and principal AutoCAD-style options.
- STRETCH: crossing-window behavior.
- ARRAYRECT/ARRAYPOLAR: live preview.
- BREAK, LENGTHEN: live preview.
- JOIN/EXPLODE/ERASE: immediate operations.
- PEDIT: intentionally simplified.

## 2. Navo2D — dimension parity

### Strong parity now
- DIM smart command supports points and objects.
- Horizontal / vertical / aligned dimensions.
- Two intersecting lines -> angular dimension.
- Two parallel lines -> perpendicular separation dimension.
- Point -> opposite line -> perpendicular dimension referenced to the line (new V8.15.4).
- Line -> opposite snapped point -> same perpendicular behavior (new V8.15.4).
- Circle/arc -> radius or diameter.
- DIMANGULAR supports inside and reflex/outside sectors based on placement.
- Angular witness lines no longer overdraw source lines that already reach the dimension arc (new V8.15.4).
- CENTERMARK / CM.
- Dimension grouping, grips, arrow flip, text/arrow scaling, precision and DIMSTYLE defaults.

### Important remaining AutoCAD dimension gaps
- Baseline dimensions.
- Continued dimensions.
- Ordinate dimensions.
- Arc-length dimensions.
- Jogged radius.
- Full associative dimensions that automatically recompute after arbitrary source-geometry edits.
- Full associative center marks/centerlines.

These should be future parity work, not silently approximated.

## 3. Navo2D — intentional / remaining feature gaps

High-value missing AutoCAD families:
- HATCH/BHATCH.
- MTEXT.
- BLOCK / INSERT / WBLOCK.
- MATCHPROP.
- XLINE / RAY.
- Native ELLIPSE / SPLINE creation and editing (import currently approximates them as polylines when necessary).
- ARRAYPATH.
- MLINE.
- REGION / BOUNDARY.
- Full STYLE / LINETYPE / LTSCALE / UNITS management.
- PURGE / AUDIT / OVERKILL.
- Native Windows/AutoCAD private clipboard format. Browser security prevents a web page from fully consuming AutoCAD's proprietary clipboard payload; a local NavoFlo bridge/add-in is the correct long-term solution.

## 4. Navo3D — eDrawings interaction parity

### Strong parity now
- Local-first file opening; CAD source remains on the workstation.
- Multi-document tabs with session restoration between Navo2D and Navo3D.
- Middle mouse drag rotates.
- Ctrl+middle mouse pans.
- Shift+middle mouse zooms.
- Mouse wheel zooms relative to pointer.
- F = Zoom to Fit without changing the current orientation (corrected V8.15.4).
- Z = zoom out; Shift+Z = zoom in.
- Arrow keys rotate 10°; Shift+arrow rotates 90°.
- Space opens/closes View Orientation menu.
- Standard views: Front, Back, Left, Right, Top, Bottom, Isometric.
- Standard orthographic views now use a true orthographic camera; depth no longer shrinks with distance (new V8.15.4).
- Perspective is a separate toggle and a per-user preference.
- Fit uses the model extents in the current camera plane rather than resetting to isometric (new V8.15.4).
- Selection filters: Auto, Vertex, Edge, Face.
- Shift+F1 = Auto, Shift+F2 = Vertex, Shift+F3 = Edge, Shift+F4 = Face (new V8.15.4, matches AutoCAD 3D subobject-filter muscle memory).
- Esc or a blank click clears the current measurement/selection.
- Measure callouts can be dragged while remaining tethered to their geometry.
- Clicking blank space now clears both callout and tether (fixed V8.15.4).
- STEP logical face/edge grouping hides internal seam edges where topology split one logical cylinder/circle.
- Exact STEP measurement and smart face/edge/vertex selection.
- Section plane, grid, properties, sheet-metal analysis.

## 5. Navo3D — eDrawings parity still worth adding

High-value next items:
- Zoom Area / Zoom Window drag rectangle.
- Display Style flyout with explicit Wireframe / Shaded / Shaded with Edges. Today Navo3D already covers Shaded and Shaded-with-Edges through the Edges toggle, but not a true wireframe-only mode.
- Previous View / Reset View history.
- Named views (especially once native SOLIDWORKS support can read them).
- Markup/comments and persistent markup dimensions.
- Assembly component hide/show/isolate tree interactions.
- Exploded views / configurations for native assemblies.
- More eDrawings-like measurement output variants (closest vs normal, XYZ deltas, center distance options) surfaced explicitly in the UI, even where the exact STEP engine already has the underlying geometry.

## 6. Important V8.15.4 corrections from field testing

1. 3D measurement cleanup
   - Blank-click deselection clears the dimension callout, measure overlays, and the dotted draggable-label tether.
   - The tether DOM/SVG is force-hidden and reset, preventing a stale leader from surviving after the label disappears.

2. 2D angular witness lines
   - Source-line coverage is calculated before drawing angular extension lines.
   - If the selected source geometry already reaches the dimension arc, no redundant witness line is drawn over it.
   - If it reaches only partway, only the missing portion is drawn.

3. 2D point-to-line smart DIM
   - Real snapped points are treated as points even when they belong to another line.
   - Point->line and line->point project perpendicular to the reference line and then allow normal dimension-line placement.

4. Navo2D <-> Navo3D navigation
   - The old `beforeunload` dirty-document warning was removed from Navo2D.
   - Session persistence still runs on suite navigation/pagehide, so switching modules does not require the browser's "Leave site?" warning.

5. Navo3D projection / standard views
   - Standard views force orthographic projection.
   - Perspective remains available explicitly.
   - Old V8.15.3 saved camera snapshots without projection metadata are detected and safely refit rather than restored with an invalid orthographic zoom.

6. Zoom-to-fit behavior
   - eDrawings' F key fits the model without changing the view direction. Navo3D now does the same.
   - Standard-view commands change orientation first, then fit that orientation.

## 7. Product-level conclusion

The frequent, high-muscle-memory workflows are now much closer to their familiar desktop counterparts:
- Navo2D: AutoCAD-like command/drafting/dimension/modify flow.
- Navo3D: eDrawings-like navigation, views, measurement and selection flow.

The remaining gaps are mainly larger feature families rather than inconsistent basic interaction. They should be implemented deliberately in future CAD passes instead of adding partial behavior that would surprise experienced users.
