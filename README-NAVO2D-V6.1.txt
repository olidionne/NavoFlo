Navo2D — CAD Interaction V6.1
================================

Fichiers à remplacer:
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

TRIM / EXTEND — QUICK FREEHAND
- Clic simple: comportement objet par objet conservé.
- Clic maintenu + drag: trace une Fence libre.
- Les objets traversés sont traités pendant le déplacement de la souris.
- TRIM: trait rouge pointillé.
- EXTEND: trait vert pointillé.
- Shift inverse temporairement TRIM <-> EXTEND.
- Un stroke de crayon = une seule entrée Undo.

STRETCH LIVE
- La géométrie sélectionnée montre maintenant une prévisualisation LIVE.
- Les endpoints/vertices inclus dans la Crossing Window suivent le curseur.
- Les objets complètement inclus se déplacent.
- La dernière Crossing Window peut être réutilisée quand STRETCH démarre avec une présélection.
- ORTHO / POLAR / OSNAP / DYN continuent de s'appliquer au point cible.

CURSEUR CAD
- Le curseur navigateur est remplacé dans le canvas.
- Crosshair dessiné par Navo2D.
- Pickbox carré pendant sélection et commandes de modification.
- Le pickbox suit le hover/hit-test.

OFFSET / DÉCALER
- Preview live du résultat avant validation.
- LINE, CIRCLE, ARC et POLYLINE.
- Option Through / À travers.
- Après un offset, la commande reste active pour sélectionner un autre objet.
- Polylignes droites: offset à joints miter.
- Polylignes avec bulges/arcs: approximation en polyligne droite signalée.

MENU PLUS
- Le menu "Plus / More" n'est plus contenu dans la barre scrollable.
- Popover fixé au-dessus du dessin.
- Aucun scroll horizontal créé par l'ouverture du menu.

BASE
- Patch construit à partir du public/js/navo2d.js actuellement dans main
  (blob GitHub de base 54d6c438c81aa8bc4e42071693c8305598ec87b3).

VALIDATION
- node --check: OK
- bindings HTML FR/EN: OK
- aucun ID dupliqué: OK
- ancien <details> Plus retiré: OK
- TRIM brush / STRETCH live / OFFSET preview / CAD cursor présents: OK
