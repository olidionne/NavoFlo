NavoFlo / Navo2D V6.8 — ADAPTIVE DIMENSIONS + AUTOCAD ROTATE
==============================================================

Base: V6.7 TEXT + live previews + V6.6 clickable command options.

ADAPTIVE DIMENSIONS
-------------------
New dimension commands and toolbar group:
- DIM       Smart dimension
- DLI       DIMLINEAR
- DAL       DIMALIGNED
- DAN       DIMANGULAR
- DRA       DIMRADIUS
- DDI       DIMDIAMETER

Smart DIM behavior:
- Horizontal / vertical LINE -> linear dimension
- Oblique LINE -> aligned dimension
- CIRCLE -> diameter dimension
- ARC -> radius dimension
- Two picked points -> automatically chooses linear near X/Y axes, aligned otherwise

Dimension styling:
- Dimension text height automatically scales from the source drawing extents.
- Arrow size, extension gaps and offsets scale from the same adaptive style.
- Generated dimension geometry is placed on a dedicated DIMENSIONS layer.
- DIMENSIONS defaults to ACI color 2 and is excluded from the scale calculation so repeated dimensions do not grow the text size.
- Dimensions export as standard R12-compatible LINE / ARC / TEXT primitives, preserving CAM/DXF compatibility.
- Live preview is shown before final placement.

AUTOCAD-STYLE ROTATE
--------------------
ROTATE now follows the AutoCAD workflow:
- Select objects
- Specify base point
- Specify rotation angle or [Copy/Reference]

Copy:
- Keeps the original objects.
- Creates and selects a rotated copy.

Reference:
- Numeric reference angle, or two picked points.
- Then specify the new angle or [Points].
- Points allows a two-point target angle.
- Live geometry preview is preserved during normal and reference rotation.
- Current rotation angle is retained as the default value.
- Prompt options remain clickable through the V6.6 rich command prompt engine.

VALIDATION
----------
- node --check public/js/navo2d.js: OK
- Adaptive dimension geometry test: OK
- Linear / aligned / radius / diameter / angular dimension primitives: OK
- 90-degree angular dimension text: OK
- ROTATE point geometry: OK
- ROTATE Reference delta calculation: OK
- FR + EN dimension toolbar: OK

FILES
-----
public/js/navo2d.js
public/css/navo2d.css
public/navo2d/index.html
public/en/navo2d/index.html
