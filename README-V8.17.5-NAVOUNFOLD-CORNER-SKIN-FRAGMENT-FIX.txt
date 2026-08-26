NAVOFLO V8.17.5 — NAVOUNFOLD CORNER / SKIN FRAGMENT FIX
============================================================

BASE
----
V8.17.4 — Exact flat-prism proof.

PROBLÈME CORRIGÉ
----------------
ST01-0005_0.step révélait un cas topologique précis : un trou très près de
l'intersection de deux plis peut découper la peau plane en plusieurs faces OCCT
coplanaires. La petite portion de matière située entre le trou et les deux plis
ne partage alors aucune arête directement avec la grande face du panneau.

V8.17.4 considérait cette petite face comme un panneau indépendant non atteint par
le graphe de dépliage. Elle disparaissait du développé et donnait visuellement un
petit V-notch près du trou.

CORRECTION V8.17.5
------------------
1. Les fragments plans coplanaires sont maintenant recousus dans le même panneau
   lorsqu'ils sont reliés au même voisin B-Rep non planaire (pli ou paroi de coupe).
2. Ce critère reste topologique : deux brides différentes simplement coplanaires
   ne sont pas fusionnées globalement.
3. Les sommets de frontière de degré pair (2, 4, ...) sont reconnus comme des
   contours fermés valides. Un croisement topologique au coin ne force donc plus
   le fallback vers les arêtes du maillage triangulé.
4. Les parois du développé utilisent ainsi la frontière B-Rep exacte lorsque le
   contour est fermé, ce qui évite les faux slivers/notches issus du mesh.

VALIDATION
----------
ST01-0005_0.step :
- T = 1.89738 mm
- 4 plis
- 5 panneaux
- les 4 petits fragments de coins sont rattachés au panneau central
- frontière CUT exacte fermée
- aucun warning d'open contour

Régressions validées :
- ST01-0004_0.step : 2 plis
- 503-00-01 : 4 plis
- 502-01-10 : plaque plane / 0 pli / DXF
- 502-00-26 : plaque plane / 0 pli / DXF
- 502-05-04 : plaque plane / 0 pli / DXF
- 520-00-03 : plaque plane / 0 pli / DXF

Tous les DXF de régression passent ezdxf audit avec 0 erreur / 0 correction.

DÉPLOIEMENT
-----------
Le PATCH V8.17.5 est prévu pour une installation déjà en V8.17.4.
Le FULL DEPLOY contient l'application complète.
