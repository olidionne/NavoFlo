Navo2D — AutoCAD-style Grips V5.2
====================================

Fichier à remplacer:
- public/js/navo2d.js

GRIPS
- Les entités sélectionnées affichent maintenant des grips bleus.
- Le grip actif devient rouge.
- Hover d'un grip: indication du type de grip.
- Les grips ne sont pas affichés sur un layer verrouillé.
- Limite de sécurité: grips masqués au-delà de 100 objets sélectionnés.

LINE
- Grip extrémité 1: déplace/étire l'extrémité 1.
- Grip extrémité 2: déplace/étire l'extrémité 2.
- Grip midpoint: déplace la ligne complète.

POLYLINE
- Grip sur chaque vertex: déplace le vertex.
- Grip au milieu de chaque segment: déplace les deux vertices du segment.
- Les bulges sont conservés.

CIRCLE
- Grip centre: déplace le cercle.
- 4 grips quadrant: modifient le rayon.

ARC
- Grip centre: déplace l'arc.
- Grip start/end: modifient les angles de départ/fin.
- Grip midpoint: modifie le rayon.

POINT / TEXT
- Grip insertion: déplace l'entité.

COMPORTEMENT
- Clic sur un grip: il devient hot (rouge).
- Déplacer la souris puis cliquer: confirme la nouvelle position.
- Clic-glissé direct sur le grip: modification immédiate au relâchement.
- ESC: annule le grip sans désélectionner l'objet.
- Undo/Redo compatible.
- OSNAP, ORTHO et POLAR sont appliqués pendant le déplacement du grip.
- DYN affiche Distance + Angle pendant l'édition du grip.
- TAB alterne Distance ↔ Angle.
- Une valeur peut être tapée dans la command line pendant qu'un grip est actif.

Régressions conservées:
- Layer 0 au premier plan.
- Export DXF V5 auto-validé.
- Dropdown layer et changement de layer de la sélection.
