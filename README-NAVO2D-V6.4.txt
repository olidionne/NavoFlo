NavoFlo / Navo2D V6.4 — CHAMFER + TRIM corrections
===================================================

Cette archive est prête à être copiée à la racine du repo NavoFlo.

Fichiers principaux
-------------------
public/js/navo2d.js
public/css/navo2d.css
public/navo2d/index.html
public/en/navo2d/index.html

Corrections V6.4
----------------
1. CHAMFER / CHANFREIN
   - Le workflow AutoCAD numérique reste disponible :
       CHA -> D -> D1 -> D2 -> ligne 1 -> ligne 2
   - Ajout du workflow direct demandé :
       CHA -> D -> clic ligne 1 -> clic ligne 2
     Dans ce mode, les positions réellement cliquées définissent D1 et D2
     depuis l'intersection théorique des deux lignes.
   - Fonctionne pour lignes horizontales, verticales, diagonales, angles aigus
     et obtus.
   - Un ancien congé ou un ancien chanfrein reliant les mêmes deux lignes est
     remplacé au lieu de rester superposé.
   - D1/D2 sont mémorisés pour les chanfreins suivants.

2. TRIM / AJUSTER
   - Le segment cliqué est supprimé à 100 % jusqu'aux intersections les plus
     proches.
   - Une intersection : suppression du bout cliqué jusqu'à cette intersection.
   - Deux intersections ou plus : suppression complète de la portion cliquée
     entre les deux limites voisines.
   - Aucune intersection intérieure : la ligne complète disparaît.
   - Même logique de suppression complète sans intersection pour un ARC; un
     CIRCLE sans intersection est aussi supprimé.
   - Le mode TRIM au clic et le mode brosse utilisent le même moteur.

3. FILLET / CONGÉ
   - Régression vérifiée : le petit arc tangent est conservé.
   - Refaire un congé sur le même coin remplace le connecteur existant.
   - Passer de congé à chanfrein ou de chanfrein à congé remplace également
     l'ancien traitement de coin.

Validation
----------
- node --check : OK
- Tests source V6.4 : OK
- 420 combinaisons angle/orientation CHAMFER (5° à 175°, rotations multiples)
- TRIM : 0, 1 et 2 intersections testées
- D + clic ligne 1 + clic ligne 2 : distances calculées depuis les clics
- remplacement ancien connecteur : testé
- régression FILLET / arc mineur / remplacement : testée
