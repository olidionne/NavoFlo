NavoFlo — Navo2D Command Engine V3
==================================

Fichiers à remplacer:
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

OBJECTIF
- Donner à Navo2D un flux de commande de type AutoCAD: commande au clavier + Entrée/Espace, prompts, répétition, coordonnées, OSNAP, POLAR, ORTHO, DYN et sélection AutoCAD déjà présente.

COMMANDES IMPLANTÉES
Dessin:
- L / LINE
- PL / PLINE
- C / CIRCLE (option D = Diameter)
- A / ARC (3 points)
- REC / RECTANG / RECTANGLE

Modification:
- M / MOVE
- CO / CP / COPY
- RO / ROTATE
- MI / MIRROR
- SC / SCALE
- O / OFFSET (LINE, CIRCLE, ARC)
- E / ERASE
- X / EXPLODE (polylines)
- J / JOIN (lignes/polylignes droites continues)

Inspection/navigation/fichier:
- DI / DIST
- ID
- Z / ZOOM / ZE = Zoom Extents
- LA / LAYER
- OS / OSNAP
- NEW / QNEW
- QSAVE / SAVE
- OPEN
- CLOSE
- PR / PROPERTIES
- RE / REGEN
- U / UNDO
- REDO

ENTRÉE DE COORDONNÉES
- X,Y = coordonnées absolues
- @X,Y = coordonnées relatives
- #X,Y = coordonnées absolues forcées
- @Distance<Angle = polar relatif
- Distance<Angle = polar depuis le point de référence lorsque la commande attend un point
- Distance seule pendant LINE = distance dans la direction actuelle du curseur/POLAR/ORTHO

AIDES AU DESSIN
- F3 = OSNAP
- F7 = GRID
- F8 = ORTHO
- F9 = Grid Snap
- F10 = POLAR
- F11 = OTRACK (tracking horizontal/vertical de base)
- F12 = Dynamic Input
- F8 et F10 sont mutuellement exclusifs
- POLAR réglable: 90, 60, 45, 30, 22.5, 15, 10, 5 degrés
- TAB pendant un prompt de point = cycle les snaps disponibles
- Shift + clic droit = menu de snap temporaire

OSNAP DISPONIBLES
- END / Endpoint
- MID / Midpoint
- CEN / Center
- GCEN / Geometric Center
- QUA / Quadrant
- INT / Intersection
- PER / Perpendicular
- TAN / Tangent
- NEA / Nearest
- NOD / Node
- INS / Insertion

SÉLECTION / LAYERS
- Window gauche -> droite
- Crossing droite -> gauche
- Shift retire de la sélection
- Couleurs ACI / BYLAYER
- Layers inutilisés conservés
- Double-clic sur un layer = layer courant
- Les nouvelles entités sont créées sur le layer courant

RACCOURCIS
- Ctrl+S = export/save DXF
- Ctrl+O = ouvrir DXF
- Ctrl+1 = propriétés
- Ctrl+0 = plein écran
- Ctrl+G = grille
- Ctrl+Z / Ctrl+Y = undo/redo
- Ctrl+A = sélectionner tout
- Delete = ERASE
- Entrée/Espace = valider ou répéter la dernière commande
- Esc / Ctrl+[ = annuler la commande

IMPORTANT — PORTÉE V3
Cette V3 implante le moteur de commandes et les commandes de dessin/modification essentielles. Elle ne prétend pas encore reproduire les centaines de commandes d'AutoCAD.
Les commandes complexes comme TRIM, EXTEND, FILLET, CHAMFER, STRETCH, PEDIT, HATCH, DIM, BLOCK/INSERT, SPLINE/ELLIPSE de création, etc. sont reconnues comme futures mais ne sont pas encore exécutées.
Le moteur a été construit pour les ajouter sans refaire la navigation, la ligne de commande ou les snaps.

VALIDATION
- node --check: OK
- IDs JS/HTML FR: OK
- IDs JS/HTML EN: OK
- Navo2D pleine page conservé
- couleurs/layers inutilisés conservés
