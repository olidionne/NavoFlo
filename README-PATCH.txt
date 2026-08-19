NavoFlo Suite — Navo2D + Navo3D
================================

Déposer le contenu du dossier public/ dans le dossier public/ du repo NavoFlo.

NOUVEAUX MODULES
- /navo3d/ : nouveau nom du CAD Viewer 3D
- /navo2d/ : nouveau moteur 2D DXF
- /en/navo3d/ et /en/navo2d/ : versions anglaises

COMPATIBILITÉ
- /viewer/ redirige vers /navo3d/
- /en/viewer/ redirige vers /en/navo3d/

NAVO3D
- Toutes les fonctions existantes du viewer sont conservées.
- Navigation souris CAD V4 conservée.
- Module Sheet Metal / Air Bending CD-401 inclus.
- Nouveau branding Navo3D et sélecteur Navo2D/Navo3D.

NAVO2D V1
- Ouverture DXF locale (dxf-parser 1.1.2 via jsDelivr ESM)
- Rendu Canvas 2D haute performance
- LINE, POLYLINE/LWPOLYLINE, CIRCLE, ARC, POINT, TEXT/MTEXT
- ELLIPSE et SPLINE rendus/édités comme géométrie approximée
- Pan molette maintenue, zoom molette vers pointeur
- Sélection simple et Ctrl+clic multi-sélection
- Bleu persistant #006DFF
- Snap endpoint/midpoint/center
- Mesure distance + ΔX + ΔY
- Déplacement 2 points
- Suppression
- Undo / Redo
- Layers visibles/cachés
- Assignation rapide des sélections à CUT / PLIS_UP / PLIS_DOWN
- Grille adaptative
- Propriétés
- Analyse de base: contours ouverts, doublons potentiels, entités non prises en charge, géométrie approximée
- Export DXF normalisé

RACCOURCIS NAVO2D
- F : Fit
- M : Mesure
- Delete : Supprimer
- Ctrl+Z : Undo
- Ctrl+Y / Ctrl+Shift+Z : Redo
- Esc : Annuler outil / retour sélection

VALIDATION
- public/js/viewer.js : node --check OK
- public/js/navo2d.js : node --check OK
