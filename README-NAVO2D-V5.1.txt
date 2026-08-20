Navo2D — Layer 0 Foreground Fix V5.1

Fichier à remplacer:
- public/js/navo2d.js

Correction:
- Les layers autres que 0 sont rendus en premier.
- Le layer 0 est rendu ensuite et reste donc visuellement au premier plan
  lorsqu'une géométrie est exactement superposée à un autre layer.
- Hover est rendu au-dessus de la géométrie normale.
- La sélection bleue est toujours rendue en dernier et reste au-dessus de tout.
- Le hit-test utilise le même principe:
  si deux entités sont pratiquement superposées, le layer 0 gagne le tie-break.

Résultat attendu:
BOUNDING_B et 0 sur la même ligne
→ couleur visible = layer 0
→ clic = entité du layer 0
→ sélection = bleu
