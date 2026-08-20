# Navo2D V6.9 — AutoCAD behavior audit

This pass audits the commands that Navo2D already exposes in its ribbon / More menu. The goal is consistent AutoCAD-style interaction: command options, click-able hotkeys, live preview when geometry should be visible before commit, and editability after creation.

## Drawing
- LINE / PLINE: live segment preview, Close / Undo options, snaps/dynamic input.
- CIRCLE: live radius preview, Diameter option.
- ARC: live 3-point preview.
- RECTANG: live rectangle preview.
- TEXT / DTEXT: creation + live preview + double-click / TEXTEDIT editing.

## Modify
- MOVE: live preview.
- COPY: live preview; now repeats copies until Exit/Enter, with in-command Undo.
- ROTATE: live preview; Copy + Reference + Points workflow.
- SCALE: live preview; now Copy + Reference + Points workflow.
- MIRROR: live preview; erase-source Yes/No.
- OFFSET: live preview; Through + Erase + Layer(Current/Source), repeat selection, in-command Undo.
- TRIM: live removal preview; removes clicked portion to intersections; no intersection removes the full line; brush mode.
- EXTEND: live extension preview.
- FILLET: live preview; Radius / Trim / Multiple / Polyline / Undo.
- CHAMFER: live preview; Distance / Angle / Trim / Method / Multiple / Polyline / Undo.
- STRETCH: live crossing-window preview.
- ARRAYRECT / ARRAYPOLAR: live array preview added while parameters are entered.
- BREAK / LENGTHEN: live preview.
- JOIN / EXPLODE / ERASE: immediate operations; live preview is not meaningful before commit.
- PEDIT: current Navo2D scope remains simplified (open/close or join), not full AutoCAD PEDIT sub-options.

## Dimensions
- DIM smart, DIMLINEAR, DIMALIGNED, DIMANGULAR, DIMRADIUS, DIMDIAMETER.
- Adaptive text/arrow size from drawing extents.
- Smaller filled arrowheads.
- Arrow modes Auto / Inside / Outside.
- Angular dimension grip moves the complete arc inward/outward.
- Radius/diameter text grip creates/rebuilds a real dogleg leader when moved away.
- A dimension selects as one grouped CAD object.
- Double-click / right-click dimension properties for arrow mode, precision, text scale and arrow scale.
- DIMSTYLE / D opens Navo2D dimension defaults.

## Ribbon / command line
- Ribbon panels use AutoCAD-like stacked small commands to reduce width.
- Main actions remain large; secondary actions stack 2–3 high.
- Command options remain clickable and expose their keyboard hotkey.

## Explicitly outside the current implemented command set
These remain intentionally reported as not implemented instead of silently doing something incomplete: HATCH, MTEXT, ARRAYPATH, BLOCK/INSERT/WBLOCK, XLINE/RAY, native ELLIPSE/SPLINE creation/editing, MLINE, REGION/BOUNDARY, MATCHPROP, full STYLE/LINETYPE/UNITS workflows, PURGE/AUDIT/OVERKILL.
