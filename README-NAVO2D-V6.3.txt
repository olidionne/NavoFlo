NAVOFLO / NAVO2D — V6.3
FILLET (CONGÉ) + CHAMFER (CHANFREIN) — CORRECTIONS DE WORKFLOW

CONTENU
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

CHANFREIN / CHAMFER — CORRECTION D
- L'option D (Distance) conserve le workflow AutoCAD Dist1 / Dist2.
- Les invites affichent maintenant les distances courantes.
- Entrée accepte la valeur courante et passe correctement à l'étape suivante au lieu de quitter CHAMFER.
- Après D, un clic direct sur la première LINE accepte les distances courantes et commence immédiatement la sélection des deux lignes.
  Cela permet aussi le workflow demandé: D -> clic ligne 1 -> clic ligne 2.
- Les valeurs D1/D2 saisies restent persistantes pour les chanfreins suivants.
- CHAMFER 0,0 ferme le coin sans créer une LINE de longueur zéro.

CONGÉ / FILLET — CORRECTION DES DOUBLONS
- Lorsqu'un ARC de congé relie déjà les extrémités intérieures des deux mêmes lignes, il est détecté avant le nouveau calcul.
- Refaire FILLET sur les mêmes deux lignes remplace l'ancien ARC au lieu d'en empiler un deuxième au même endroit.
- Cela fonctionne aussi si le rayon est changé: l'ancien congé est retiré, les lignes sont réajustées, puis le nouveau congé est créé.
- FILLET R0 retire également le congé existant avant de refermer les lignes à l'intersection.

CONSERVÉ DE V6.2
- Sélection du côté selon l'endroit du clic, comme AutoCAD.
- Prise en charge des lignes horizontales, verticales et diagonales.
- Angles aigus, droits et obtus non parallèles.
- Petit arc tangent seulement (pas de grand arc 270°).
- Intersection théorique utilisée pour trim/extend.

VALIDATION
- node --check public/js/navo2d.js : OK.
- 577 cas géométriques FILLET / CHAMFER : PASS.
- Test de détection/remplacement d'un FILLET existant : PASS.
- Vérification du chemin D -> clic ligne 1 -> clic ligne 2 dans commandPoint.

INSTALLATION
Décompresser à la racine du repo NavoFlo en conservant les chemins du ZIP.
