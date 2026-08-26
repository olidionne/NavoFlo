NAVOFLO V8.17.4 — NAVOUNFOLD EXACT FLAT-PRISM PROOF
=====================================================

OBJECTIF
--------
Empêcher qu'un rayon/arrondi appartenant au contour de coupe d'une plaque plane
soit interprété comme un pli de tôlerie.

PROBLÈME OBSERVÉ EN V8.17.3
--------------------------
502-01-10 : plaque plane détectée comme 1 pli.
502-00-26 : aucun DXF disponible parce qu'un faux pli échouait à la résolution.
502-05-04 : plaque plane détectée comme 2 plis.
520-00-03 : même famille de faux positif sur des cylindres de contour.

CAUSE
-----
La seule présence d'une face cylindrique tangente à deux faces planes ne prouve
pas un pli. Un coin arrondi dans le contour de coupe possède exactement cette
topologie sur les parois d'épaisseur de la plaque.

CORRECTION V8.17.4
-----------------
Avant toute recherche de pli, NavoUnfold essaie maintenant de PROUVER que le
solide est une plaque prismatique déjà plane.

La preuve requiert simultanément :
1. deux grandes peaux planes parallèles;
2. les deux plans sont les plans supports min/max du solide complet;
3. la distance entre ces plans est l'épaisseur;
4. les deux contours B-Rep projetés sont congruents après translation;
5. mêmes familles d'arêtes, longueurs, extrémités, centres/rayons lorsque présents;
6. les deux peaux sont dominantes et la pièce est mince dans cette direction.

Si cette preuve passe :
- tous les cylindres de contour sont classés CUT et jamais BEND;
- bendCount = 0;
- aucun bouton Déplier/Replier;
- bouton Exporter DXF disponible immédiatement;
- DXF = contour exact 1:1 de la peau prouvée.

Si la preuve échoue :
- l'analyse de pliage traditionnelle reprend normalement.

VALIDATION SUR LES STEP RÉELS
-----------------------------
25021600_502-01-10_0.step : FLAT, T=12.700 mm, 0 pli, DXF OK
25021600_502-00-26_0.step : FLAT, T=38.100 mm, 0 pli, DXF OK
25021600_502-05-04_0.step : FLAT, T=9.525 mm, 0 pli, DXF OK
25021600_520-00-03_0.step : FLAT, T=9.525 mm, 0 pli, DXF OK
25021600_503-00-01_0.step : reste FORMÉ, 4 plis détectés dans le test de régression

Les DXF générés ont été relus avec ezdxf : AC1015, INSUNITS=Inches,
0 erreur d'audit et 0 correction.

DÉPLOIEMENT
-----------
Le PATCH V8.17.4 est prévu pour une installation déjà en V8.17.3.
Le FULL DEPLOY contient l'application complète.
