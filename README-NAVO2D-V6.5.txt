NavoFlo / Navo2D V6.5 — AutoCAD FILLET + CHAMFER options
========================================================

Archive prête à copier à la racine du repo NavoFlo.

Fichiers inclus
---------------
public/js/navo2d.js
public/css/navo2d.css
public/navo2d/index.html

CHAMFER / CHANFREIN
-------------------
Options de ligne de commande ajoutées comme AutoCAD :
  U = Undo
  P = Polyline
  D = Distance
  A = Angle
  T = Trim
  E = mEthod / Méthode
  M = Multiple

Comportements :
- Distance : D1 + D2 numériques.
- Le workflow Navo2D existant D + clic ligne 1 + clic ligne 2 est conservé.
- Angle : distance sur la première ligne + angle mesuré depuis la première ligne.
- Méthode : bascule persistante Distance / Angle.
- Trim : Trim / NoTrim est mémorisé entre les commandes.
- Multiple : la commande reste active pour traiter plusieurs coins; sans Multiple,
  elle se termine après une paire, comme AutoCAD.
- Undo : annule la dernière opération faite dans la commande Multiple.
- Polyline : applique le chanfrein à tous les sommets d'une polyligne 2D composée
  de segments droits. Distance et Angle sont tous les deux pris en charge.

FILLET / CONGÉ
---------------
Options de ligne de commande ajoutées comme AutoCAD :
  U = Undo
  P = Polyline
  R = Radius / Rayon
  T = Trim
  M = Multiple

Comportements :
- Radius : rayon courant persistant.
- Trim : Trim / NoTrim persistant.
- Multiple : plusieurs paires dans la même commande.
- Undo : annule le dernier congé de la commande Multiple.
- Polyline : applique le rayon à tous les sommets d'une polyligne 2D composée de
  segments droits et génère les arcs comme bulges DXF dans la polyligne.
- Les congés existants sur le même coin continuent d'être remplacés plutôt que
  superposés.

TRIM V6.4 conservé
------------------
- La portion cliquée est supprimée complètement jusqu'aux intersections voisines.
- Sans intersection, l'entité complète est supprimée.

Validation V6.5
---------------
- node --check : OK
- Tests automatisés de transitions de commande : U/P/R/T/M et U/P/D/A/T/E/M
- CHAMFER Angle : angles et rotations multiples validés
- Polyline FILLET : carré fermé, 4 arcs/bulges validés
- Polyline CHAMFER : Distance et Angle validés
- Trim / NoTrim sur lignes exactes validés
- Multiple : maintien/fin de commande validé
