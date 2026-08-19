NavoFlo CAD Mouse + Selection V4

Remplacer:
  public/js/viewer.js

Navigation:
- Clic gauche: sélection
- Molette maintenue: rotation autour du point sous la souris
- Ctrl + molette maintenue: pan
- Shift + molette maintenue: zoom
- Molette: zoom vers le pointeur
- Bouton droit maintenu: pan
- Clic droit court: Select Other
- F: Fit

Sélection:
- Entité 1: bleu #006DFF persistant
- Entité 2: bleu #006DFF persistant
- Le calcul asynchrone ne peut plus écraser une nouvelle sélection
- Arête noire originale masquée pendant sa sélection pour éviter le z-fighting
- Faces sélectionnées: bleu solide, depth-tested; pas de logique de visibilité frame-par-frame

Validation:
- node --check: OK
- ancienne navigation OrbitControls désactivée
- anciens handlers MMB/RMB conflictuels supprimés
