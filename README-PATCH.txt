NavoFlo — Sheet Metal / Air Bending CD-401
===========================================

Fichiers à remplacer:
- public/js/viewer.js
- public/css/viewer.css
- public/viewer/index.html
- public/en/viewer/index.html

Ajouts:
- Bouton Tôle / Sheet dans la barre d'outils.
- Panneau Tôlerie dans Propriétés.
- Table Air Bending CD-401 intégrée:
  * Aluminium doux: 0.33 / 0.40 / 0.50
  * Aluminium moyen: 0.38 / 0.43 / 0.50
  * Acier / matériaux durs: 0.40 / 0.45 / 0.50
  * Plages R/T: <=1, >1 à <=3, >3.
- Calcul automatique du facteur K à partir de R/T.
- Surcharge manuelle du facteur K possible.
- Calcul du rayon neutre.
- Calcul Bend Allowance.
- Calcul Bend Deduction.
- Récupération de T depuis une mesure entre deux faces STEP.
- Récupération de R depuis une arête circulaire ou une face cylindrique STEP.
- Conversion automatique mm / po / autres unités du viewer.
- Préférences de famille matériau conservées localement.

Important:
Cette version intègre les paramètres nécessaires au futur moteur STEP -> DXF.
Elle ne déplie pas encore automatiquement la pièce complète.

Validation:
- JavaScript: node --check OK
- Base utilisée: version courante du repo olidionne/NavoFlo/main
