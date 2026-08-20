NavoFlo — Navo2D Layer + DXF Export V5
==========================================

Fichier à remplacer:
- public/js/navo2d.js

1) DROPDOWN LAYERS
- Le dropdown n'affiche plus « inutilisé / unused ».
- Le gestionnaire complet de layers continue d'indiquer les layers inutilisés.
- Aucun layer n'est supprimé.

2) COMPORTEMENT TYPE AUTOCAD
- Aucune sélection:
    le dropdown change le LAYER COURANT.
- Une ou plusieurs entités sélectionnées:
    le dropdown affiche leur layer.
    choisir un autre layer CHARGE LES ENTITÉS SÉLECTIONNÉES sur ce layer.
    le layer courant du dessin n'est pas modifié.
- Sélection provenant de plusieurs layers:
    le dropdown indique *PLUSIEURS LAYERS* / *VARIES*.
    choisir un layer rassemble toute la sélection sur ce layer.
- Le changement de layer d'une sélection est Undo/Redo.

3) EXPORT DXF
- Ancien exporteur minimal remplacé.
- Export AC1009 / DXF R12 pour forte compatibilité AutoCAD/LT/CAM.
- Export de toutes les entités canoniques Navo2D:
    LINE
    CIRCLE
    ARC
    POINT
    TEXT
    POLYLINE (avec bulges)
- Les ELLIPSE et SPLINE déjà approximées dans Navo2D restent exportées
  comme POLYLINE, donc elles ne disparaissent pas.
- Tous les layers sont exportés, même avec 0 entité.
- Couleurs ACI conservées.
- TrueColor est converti vers la couleur ACI la plus proche pour R12.
- $INSUNITS, extents et layer courant ajoutés au header.
- Avant téléchargement, Navo2D reparse SON PROPRE DXF:
    nombre d'entités attendu == nombre écrit == nombre relu
    layers relus >= layers du modèle
  Si la validation échoue, aucun DXF incomplet n'est téléchargé.

VALIDATION EFFECTUÉE
- JavaScript node --check: OK
- Export DXF de test relu avec ezdxf 1.4.4: OK
- LINE / CIRCLE / ARC / POINT / TEXT / POLYLINE: OK
- Layer inutilisé conservé: OK
- $INSUNITS conservé: OK
