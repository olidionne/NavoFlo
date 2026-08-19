NavoFlo — Navo2D AutoCAD Controls / Layers V2
=================================================

Fichiers à remplacer:
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html

NOUVEAU — SÉLECTION TYPE AUTOCAD
- Clic gauche sur entité: ajoute à la sélection.
- Fenêtre gauche -> droite (WINDOW): sélectionne seulement les objets entièrement contenus.
- Fenêtre droite -> gauche (CROSSING): sélectionne les objets contenus OU croisés.
- WINDOW: rectangle bleu, bordure continue.
- CROSSING: rectangle vert, bordure pointillée.
- Shift + clic/fenêtre: retire de la sélection.
- Esc: vide la sélection.
- Ctrl+A: sélectionne toutes les entités visibles.

NAVIGATION
- Molette maintenue (MMB): pan.
- Roulette: zoom vers le pointeur.
- Clic droit: menu contextuel Navo2D.
- F: Zoom Extents / Fit.
- Bouton plein écran natif ajouté.

LAYERS DXF
- Couleurs de layers affichées dans le dessin.
- Palette AutoCAD Color Index (ACI) complète.
- Couleurs explicites d'entités respectées.
- BYLAYER respecté.
- Gestionnaire de layers avec pastille/éditeur de couleur.
- Layers gelés et OFF indiqués.
- Les layers INUTILISÉS sont conservés et affichés avec compte = 0.
- La liste des layers vient de la table LAYER du DXF, pas seulement des entités.
- CUT / PLIS_UP / PLIS_DOWN restent disponibles.
- Export DXF conserve aussi les layers inutilisés.

INTERFACE
- Navo2D utilise maintenant toute la page du navigateur.
- Appbar compacte en haut.
- Zone de dessin pleine hauteur.
- Bouton plein écran pour masquer complètement le chrome de la page.

VALIDATION
- node --check: OK
- Vérification des IDs JS/HTML FR+EN: OK
- Vérification Window/Crossing: OK
- Vérification layers inutilisés: OK
- Vérification plein écran / pleine page: OK
