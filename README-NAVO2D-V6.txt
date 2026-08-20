Navo2D — Production CAD Engine V6

Fichiers à remplacer:
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

OSNAP:
Endpoint, Midpoint, Center, Quadrant, Intersection, Nearest (actif par défaut),
Perpendicular, Tangent, Extension, Extended/Apparent Intersection, Parallel,
Node, Geometric Center, Insertion.

Commandes ajoutées:
TR/TRIM, EX/EXTEND, F/FILLET, CHA/CHAMFER, S/STRETCH,
AR/ARRAY, ARRAYRECT, ARRAYPOLAR, BR/BREAK, BREAKATPOINT,
LEN/LENGTHEN, PE/PEDIT.

Commandes déjà conservées:
LINE, PLINE, CIRCLE, ARC, RECTANG, MOVE, COPY, ROTATE, MIRROR,
SCALE, OFFSET, ERASE, JOIN, EXPLODE, DIST, ID.

Interface:
Nouvelle NavoRibbon groupée: FILE / DRAW / MODIFY / EDIT / LAYERS / INSPECT / VIEW.
Organisation inspirée d'un CAD de production, sans copier l'identité visuelle AutoCAD.

Limites V6:
- FILLET / CHAMFER exacts: LINE ↔ LINE.
- TRIM exact: LINE / CIRCLE / ARC.
- EXTEND: LINE + extrémités de POLYLINE ouverte.
- BREAK exact: LINE.
- ARRAY: Rectangular + Polar.
- HATCH, cotations complètes, blocks et ARRAYPATH restent à développer.

Conservé:
grips, layer 0 foreground, ACI/BYLAYER, layers inutilisés, Window/Crossing,
layer picker sur sélection, export DXF auto-validé, ORTHO/POLAR/OTRACK/DYN,
ESC CAD en plein écran applicatif.

Validation:
- node --check: OK
- FR/EN IDs: OK
- aucun ID dupliqué
- commandes et OSNAP V6 présents
