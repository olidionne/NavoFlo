NavoFlo — Navo2D / Navo3D CAD UX V4
=======================================

Fichiers à remplacer:
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html
- public/js/viewer.js
- public/css/viewer.css

CORRECTIONS DEMANDÉES

1. Contrôles dupliqués
- Suppression des boutons Grille et Snap du haut dans Navo2D.
- Les aides au dessin sont maintenant regroupées dans la barre d'état:
  GRILLE / SNAP / ORTHO / POLAR / OSNAP / OTRACK / DYN.

2. Lisibilité
- Texte agrandi dans Propriétés, Layers, Analyse, menus contextuels,
  OSNAP et ligne de commande.
- Ligne de commande plus haute et saisie plus lisible.
- Ajustements pour écrans 1080p / 1440p / 4K.

3. Dynamic Input + TAB
- Après un premier point, Navo2D affiche Distance et Angle près du curseur.
- TAB passe de Distance à Angle puis revient à Distance.
- Exemple:
    L
    clic premier point
    taper 100
    TAB
    taper 45
    ENTER
  => ligne de longueur 100 à 45 degrés.
- Une valeur verrouillée reste visible pendant la saisie.

4. Layer courant
- Nouveau dropdown de layer directement dans la toolbar.
- Affiche tous les layers du DXF, incluant les layers inutilisés.
- Affiche la couleur du layer.
- Changer le dropdown change le layer courant.
- Les nouvelles entités sont créées sur ce layer.
- Le Layer Manager complet reste disponible.

5. ESC + plein écran CAD
- Navo2D et Navo3D n'utilisent plus requestFullscreen().
- Le bouton plein écran utilise un mode CAD plein écran applicatif.
- ESC ne quitte donc plus la vue CAD.
- ESC conserve son comportement CAD:
    annuler commande / désélectionner / fermer sélection temporaire.
- Le bouton plein écran permet de revenir à la vue normale.

VALIDATIONS
- Navo2D JavaScript: node --check OK
- Navo3D JavaScript: node --check OK
- FR / EN IDs: OK
- Aucun requestFullscreen/exitFullscreen utilisé: OK
- Dynamic Input TAB: présent
- Layer dropdown: présent
