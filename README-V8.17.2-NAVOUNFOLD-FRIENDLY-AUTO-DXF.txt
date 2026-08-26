NAVOFLO V8.17.2 — NAVOUNFOLD FRIENDLY AUTO DXF
================================================

OBJECTIF
--------
Réduire au minimum les clics et l'information affichée dans Navo3D tout en
rendant l'export DXF uniforme pour les pièces pliées et les plaques planes.

1) CAPACITÉ PC DÉPLACÉE VERS COMPTE
-----------------------------------
- La section « CAPACITÉ PC / PC CAPABILITY » est retirée du tiroir Propriétés Navo3D.
- Un indicateur local est ajouté tout en bas de la page Compte.
- Il affiche WebAssembly, WebGL2, threads CPU et RAM exposée par le navigateur.
- Les repères minimum / recommandé STEP / gros assemblages restent visibles.
- Aucune donnée matérielle n'est envoyée à NavoFlo par cet indicateur.

2) DÉPLIER / REPLIER — UN SEUL BOUTON FLOTTANT
----------------------------------------------
- Les boutons PLIÉE / DÉPLIÉE sont retirés du panneau Propriétés.
- Quand NavoUnfold détecte au moins un vrai pli, un seul bouton flottant apparaît
  en haut à droite de la vue 3D.
- État pièce pliée : bouton « Déplier ».
- État développé : bouton « Replier ».
- S'il n'y a aucun pli, le bouton n'apparaît pas.
- Le calcul reste automatique : face fixe, T, R et K sont détectés localement.

3) EXPORT DXF UNIFIÉ — AVEC OU SANS PLIAGE
------------------------------------------
PIÈCE AVEC PLIAGE
- Cliquer « Exporter DXF » lance automatiquement l'analyse/dépliage si nécessaire.
- Il n'est pas nécessaire d'afficher le développé avant l'export.
- Nom proposé : <piece>_FLAT.dxf.

PLAQUE PLANE SANS PLI
- NavoUnfold détecte les deux grandes peaux planes parallèles et l'épaisseur.
- La plaque est considérée comme étant déjà dans son état développé.
- Le contour B-Rep exact (lignes/arcs/cercles, incluant les trous) est exporté
  directement.
- Nom proposé : <piece>.dxf.
- L'ancien message « aucun pli cylindrique standard... » n'est plus affiché pour
  une plaque plane reconnue.

DXF
- AutoCAD R2000 / AC1015 conservé.
- Unité de base : pouces.
- $INSUNITS = 1 (Inches).
- $MEASUREMENT = 0 (English) corrigé dans le template.
- Géométrie réellement convertie mm -> pouces.
- Layers CUT et BEND conservés.

RÉGRESSION NAVOUNFOLD CONSERVÉE
-------------------------------
- V8.17.1 : sélection/mesure des faces complètes du développé.
- V8.17.1 : fermeture des cycles lorsqu'un trou traverse un pli.
- V8.17.0 : correction des plis avec bords inclinés / skew bends.
- V8.16.10 : structure DXF R2000 acceptée par AutoCAD.

VALIDATION LOCALE
-----------------
- 503-00-01 : OK, 4 portions de plis, fermeture cyclique reconstruite,
  contour CUT fermé.
- ST01-0004 : OK, 2 plis, contour CUT fermé.
- Plaque plane synthétique 100 x 50 x 6.35 mm : OK, T auto = 6.35 mm,
  0 pli, contour fermé.
- Plaque plane synthétique avec trou traversant : OK, contour extérieur + CIRCLE.
- Audit ezdxf : AC1015, INSUNITS=1, MEASUREMENT=0, 0 erreur / 0 correction.

DÉPLOIEMENT PATCH
-----------------
Le patch V8.17.2 est prévu pour une installation déjà en V8.17.1.
Remplacer les fichiers fournis en conservant leur arborescence.
