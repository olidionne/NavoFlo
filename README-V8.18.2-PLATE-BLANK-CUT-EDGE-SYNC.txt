NavoFlo V8.18.2 — Plate blank arbitration + cut edge refresh

1) Coupe / arêtes CAD
- Réapplique immédiatement le clipping aux matériaux d'arêtes exactes.
- Réexécute la visibilité logique des arêtes après chaque changement de Coupe.
- Effectue une seconde synchronisation au frame suivant pour éviter qu'un ancien programme GPU de LineMaterial reste visible jusqu'au prochain toggle.

2) Barre plate vs plaque brute
- Une barre carrée/rectangulaire/plate n'est plus déduite uniquement d'une bounding box rectangulaire.
- Preuve stricte : au moins 4 traces longitudinales de coins doivent conserver ~100 % de la longueur du brut candidat.
- Les trous internes ne cassent pas cette preuve.
- Les contours profilés, coins coupés, diagonales et formes extérieures qui raccourcissent les coins font échouer la preuve de barre.
- Dans ce cas, si deux grandes peaux planes parallèles prouvent un brut de plaque, le résultat devient "Plaque brute".

Régressions réelles validées :
- 25021600_502-00-08_0.step -> Pièce usinée · Plaque brute
- 25021600_502-00-27_0.step -> Pièce usinée · Plaque brute
- ST01-0006_0.step -> Pièce usinée · Plaque brute
- Flat bar rectangulaire avec trou traversant -> reste Barre plate
- Square bar simple -> reste Barre carrée
- Les 9 pièces d'usinage sur barre ronde de V8.18.1 restent Barre ronde / usinage.

Cache busting : viewer.js v8.18.2 + manufacturing-classifier.js v8.18.2.
