NAVOFLO / NAVO2D — V6.2
FILLET (CONGÉ) + CHAMFER (CHANFREIN) — CORRECTION GÉOMÉTRIQUE

CONTENU
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

CONGÉ / FILLET
- Les deux lignes sont traitées comme des lignes infinies pour trouver le coin théorique.
- Le côté conservé est déterminé par l'endroit où l'utilisateur clique chaque ligne, comme dans AutoCAD.
- Fonctionne avec lignes horizontales, verticales, diagonales et angles aigus/obtus non parallèles.
- Les points de tangence sont calculés sur les deux branches sélectionnées.
- Le centre du congé est placé sur la bissectrice intérieure correspondante.
- Correction critique: l'ARC DXF choisit toujours le PETIT arc entre les deux points de tangence.
  L'ancienne logique pouvait créer le grand arc (~270°), donnant l'impression que le rayon partait du mauvais côté.
- Rayon 0: les lignes sont ajustées/prolongées jusqu'à leur intersection, sans arc.
- Shift au deuxième clic conserve le comportement R0 existant.

CHANFREIN / CHAMFER
- La première distance s'applique à la première ligne sélectionnée.
- La deuxième distance s'applique à la deuxième ligne sélectionnée.
- Les distances sont mesurées depuis l'intersection théorique des deux lignes.
- Les lignes sont ajustées/prolongées jusqu'aux deux points de chanfrein.
- Une ligne de chanfrein est créée seulement si les deux points sont distincts.
- Distances 0,0: coin fermé à l'intersection, AUCUNE entité LINE de longueur zéro.
- Fonctionne avec lignes horizontales, verticales, diagonales et angles aigus/obtus non parallèles.

VALIDATION
- Syntaxe JavaScript: node --check = OK.
- 577 cas géométriques automatisés validés:
  * angles de 5° à 175°;
  * rotations du système de lignes sur plusieurs orientations;
  * quatre combinaisons de côtés sélectionnés;
  * tangence du congé;
  * rayon exact;
  * arc mineur seulement;
  * distances D1/D2 du chanfrein;
  * chanfrein 0,0;
  * cas équivalent à la capture fournie (ligne horizontale + diagonale).

LIMITES NORMALES
- Deux lignes parallèles ou colinéaires n'ont pas de coin unique: FILLET/CHAMFER sont refusés.
- Cette correction vise les entités LINE exactes, comme l'implémentation V6 actuelle.

INSTALLATION
Décompresser à la racine du repo NavoFlo en conservant les chemins ci-dessus.
Le seul fichier dont la logique FILLET/CHAMFER a changé est public/js/navo2d.js;
les autres fichiers sont inclus pour garder le bundle cohérent avec la version V6.1 de départ.
