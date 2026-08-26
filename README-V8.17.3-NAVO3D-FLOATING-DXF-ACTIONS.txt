NAVOFLO V8.17.3 — NAVO3D FLOATING DXF ACTIONS
================================================

OBJECTIF
--------
Rendre les actions de tôlerie/DXF visibles directement dans la zone CAD et
éviter qu'elles soient cachées par le tiroir Propriétés.

1) ACTIONS FLOTTANTES TOUJOURS VISIBLES
---------------------------------------
- « Déplier / Replier » et « Exporter DXF » partagent maintenant une barre
  d'actions flottantes en haut à droite de la vue.
- La position est calculée avec la largeur RÉELLE du tiroir Propriétés.
- Quand Propriétés est ouvert et qu'il y a assez d'espace, les boutons se placent
  automatiquement juste à gauche du tiroir.
- Sur une fenêtre étroite, ils restent au-dessus du tiroir grâce à un z-index
  supérieur au lieu d'être masqués.
- Le comportement est identique en plein écran.

2) EXPORT DXF FLOTTANT
----------------------
- Dès que le pré-contrôle NavoUnfold confirme qu'un DXF sûr est possible,
  « Exporter DXF » apparaît directement dans la vue.
- Pièce pliée : « Déplier / Replier » + « Exporter DXF ».
- Plaque plane : seulement « Exporter DXF » (aucun faux bouton Déplier).
- L'export garde le comportement automatique : si nécessaire, le développé est
  calculé en arrière-plan avant l'écriture du DXF.

3) PLAQUES PLANES / PIÈCES PRISMATIQUES
---------------------------------------
- Pour une géométrie sans vrai pli, la détection d'épaisseur donne maintenant
  priorité aux deux grandes peaux planes parallèles.
- Les cylindres de trous, contre-alésages ou détails circulaires ne peuvent plus
  prendre priorité sur cette épaisseur de plaque et empêcher le mode DXF direct.
- Le contour B-Rep exact reste utilisé pour CUT, incluant lignes, arcs, cercles
  et trous.

CAS FOURNI — 25021600_520-00-03_0.step
--------------------------------------
Inspection structurale + lecture locale avec OpenCascade/CadQuery du STEP fourni :
- solide fermé valide;
- unité STEP source : INCH;
- 9 faces au total;
- 7 surfaces PLANE;
- 2 CYLINDRICAL_SURFACE de contour;
- deux grandes peaux planes opposées de même aire (~25076.14 mm²);
- séparation des peaux = 9.525 mm = 0.375 in (3/8 po).

Cette topologie est donc explicitement traitée comme une plaque plane/prismatique
DXF-capable : aucun bouton « Déplier » n'est requis, mais le bouton flottant
« Exporter DXF » doit apparaître après le pré-contrôle automatique.

RÉGRESSION CONSERVÉE
--------------------
- V8.17.2 : export DXF unifié avec/sans pliage, DXF pouces par défaut.
- V8.17.1 : sélection complète du déplié + fermeture des cycles.
- V8.17.0 : plis inclinés / skew bends.
- V8.16.10 : structure DXF AutoCAD R2000.

VALIDATION LOCALE
-----------------
- viewer.js : node --check OK.
- sheetmetal-engine.js : node --check OK.
- FR/EN : IDs HTML uniques, nouveaux contrôles présents.
- Le cas 520-00-03 fourni a été ouvert localement avec OpenCascade/CadQuery :
  solide valide, 7 faces planes + 2 cylindriques, épaisseur 9.525 mm (3/8 po).
  La règle V8.17.3 donne priorité aux deux grandes peaux planes.

DÉPLOIEMENT PATCH
-----------------
Le patch V8.17.3 est prévu pour une installation déjà en V8.17.2.
Remplacer les fichiers fournis en conservant leur arborescence.
