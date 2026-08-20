NavoFlo / Navo2D V6.7 — TEXT + LIVE CAD PREVIEWS
===================================================

Base: V6.6 clickable command prompts + V6.5/V6.4 FILLET/CHAMFER/TRIM fixes.

TEXT MANAGEMENT
---------------
- New toolbar command: TEXT (T / DT / DTEXT).
- AutoCAD-like sequence: insertion point -> height -> rotation -> text.
- Space characters are accepted while typing text.
- Live text preview before validation.
- Imported DXF TEXT entities can be selected across their visible text box, not only at the insertion point.
- Double-click a TEXT entity to edit it.
- New TEXTEDIT command aliases: ED / DDEDIT / TEXTEDIT.
- Text editor modifies:
  * content
  * height
  * rotation
  * insertion X / Y
- Text changes are previewed live and support Undo.
- Selected-text properties show content, height and rotation.
- DXF R12 export remains TEXT-compatible.

LIVE / DYNAMIC COMMAND AUDIT
----------------------------
Already live and retained:
- LINE / PLINE
- CIRCLE
- ARC
- RECTANG
- MOVE
- COPY
- ROTATE
- MIRROR
- OFFSET
- STRETCH

Added / improved in V6.7:
- SCALE: full selected geometry follows the cursor around the base point; numeric factor typed in the command line also updates the preview.
- ROTATE: typed numeric angle is reflected in the live preview; TEXT rotation is previewed correctly.
- FILLET: after line 1, hovering line 2 previews the resulting tangent fillet.
- CHAMFER: after line 1, hovering line 2 previews Distance or Angle methods.
- TRIM: hovered line segment to be removed is shown in red; no-intersection case previews deletion of the complete line.
- EXTEND: hovered entity previews its extension to the nearest valid boundary.
- LENGTHEN: hovered line/arc previews the entered delta before click.
- BREAK: after the first break point, the remaining line portions are previewed dynamically.
- TEXT: live text geometry preview.
- TEXTEDIT: live draft preview while changing content / height / rotation / position.

Commands that are intentionally not cursor-live because they execute immediately or are parameter-only:
- ERASE, EXPLODE, JOIN, PEDIT
- ARRAYRECT after numeric parameter entry
- ARRAYPOLAR after numeric parameter entry
- PROPERTIES, LAYER, OSNAP, SAVE, OPEN, etc.

COMMAND AUDIT FIXES
-------------------
- PROPERTIES / PR / CH now resolve to the implemented Properties command.
- REGEN / RE now resolve to the implemented regeneration command.
- TEXT is no longer flagged as unimplemented.
- MTEXT remains intentionally separate/not implemented as a multiline DXF editor in this release.

FILES
-----
public/js/navo2d.js
public/css/navo2d.css
public/navo2d/index.html
public/en/navo2d/index.html

VALIDATION
----------
- node --check: OK
- Actual TEXT command flow test: OK (insertion, height, rotation, content with spaces)
- TEXT hit-area geometry: OK
- SCALE on TEXT preserves proportional height: OK
- LENGTHEN preview: OK
- BREAK preview: OK
- FILLET/CHAMFER preview geometry tested from 15° through 165°: OK
- FR and EN toolbar contain TEXT + TEXTEDIT.
