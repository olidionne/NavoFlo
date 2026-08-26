NavoFlo V8.15.6 — DXF AutoCAD Compatibility
=============================================

Correction ciblée de Save / Save As Navo2D.

1. SOURCE PRESERVATION
- Si le DXF ouvert n'a pas été modifié, Save / Save As conserve désormais le texte DXF source au lieu de reconstruire le fichier.
- Cela préserve les sections, tables, blocs et entités AutoCAD que Navo2D ne modifie pas encore.

2. CANONICAL DXF R12 HARDENING
- Pour les dessins réellement modifiés, l'export canonique R12 ajoute maintenant une vue *ACTIVE centrée sur les extents du dessin.
- $VIEWCTR, $VIEWSIZE, $LIMMIN/$LIMMAX et $TILEMODE sont écrits.
- Section BLOCKS canonique ajoutée.
- Validation stricte des coordonnées/rayons/angles/bulges avant écriture pour empêcher la création d'un DXF contenant NaN/undefined.

3. CACHE
- Navo2D FR/EN charge navo2d.js avec v=8.15.6.

Aucune migration D1. Aucun changement auth/licensing.
