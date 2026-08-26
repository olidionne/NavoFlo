NavoFlo V8.15.5 — DYNAMIC DRAFTING
===================================
Base: V8.15.4 CAD Parity Polish
Migration D1: aucune
Auth/licensing: aucun changement

Navo2D
------
1) MTEXT / texte multiligne façon AutoCAD
- Le bouton Texte du ribbon lance maintenant MTEXT.
- Commandes MT / MTEXT disponibles; T / TEXT / DTEXT restent disponibles pour le texte simple.
- Premier coin -> rectangle dynamique -> coin opposé -> éditeur multiligne.
- Options de commande: Height/Hauteur, Justify/Justifier, LineSpacing/Interligne, Rotation, Style, Width/Largeur, Columns/Colonnes.
- Style STANDARD supporté. Colonnes laissées à NONE pour cette version.
- Éditeur in-place avec hauteur, justification, interligne, largeur et rotation.
- Ctrl+Enter valide; Escape annule.
- Les MTEXT importés sont conservés comme texte multiligne Navo2D.
- Export R12: le MTEXT est aplati en lignes TEXT compatibles AutoCAD/CAM afin de conserver la compatibilité AC1009.

2) CENTERMARK / CM
- Le center mark n'est plus une petite croix centrale.
- Les deux axes traversent maintenant le cercle et dépassent légèrement son diamètre.
- Gap au centre + rendu dash-dot proche du CENTERMARK AutoCAD.
- CM / CENTERMARK inchangés côté commande.

3) OTRACK / Object Snap Tracking
- Acquisition après survol d'un OSNAP stable (END, MID, CEN, QUA, INT, etc.).
- Lignes de tracking vertes temporaires horizontales et verticales.
- Tracking sur les angles POLAR actifs.
- Tracking perpendiculaire aux lignes acquises.
- Intersection virtuelle entre trackers acquis.
- F11 et le bouton OTRACK activent/désactivent le système.
- Les points acquis sont remis à zéro au début/à la fin d'une commande.

Fichiers modifiés
-----------------
- public/js/navo2d.js
- public/css/navo2d.css
- public/navo2d/index.html
- public/en/navo2d/index.html
