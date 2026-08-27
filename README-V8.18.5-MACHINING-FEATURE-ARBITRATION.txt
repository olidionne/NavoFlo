NavoFlo V8.18.5 — Machining Feature + Shaft/Plate Arbitration
==============================================================

Objectifs
- Empêcher un shaft/tournage d'être classé comme « plaque plane » avec DXF.
- Conserver le DXF pour une vraie plaque qui contient aussi de l'usinage secondaire.
- Détecter davantage d'indices d'usinage: changements de diamètre, chanfreins,
  rainures/gorges toriques et alésages/lamages/trous borgnes partiels.
- Invalider les caches d'analyse V8.18.4 afin que les nouvelles règles soient
  recalculées après déploiement.

Comportement attendu sur les cas de régression fournis
- ST01-0002_0.step : Pièce usinée · Barre ronde Ø1 po; DXF supprimé.
- ST14-0002_0.step : Pièce usinée · Barre ronde Ø1/2 po; DXF supprimé.
- ST14-0004_0.step : Pièce usinée · Barre ronde Ø1 po; DXF supprimé.
- ST04-0025_A.step : Plaque à découper · usinage; DXF conservé; indices de
  rainure/gorge + perçage/alésage/lamage lorsque présents.
- ST09-0003_0.step : Plaque à découper · usinage; brut rectangulaire conservé;
  DXF conservé.

Implémentation
- public/js/step-worker.js expose maintenant axisMin/axisMax/axisSpan des faces
  analytiques cylindriques, ainsi que les liens face/arêtes utiles au classifieur.
- manufacturing-classifier.js distingue les cylindres traversants simples des
  cylindres axiaux partiels et ajoute les preuves « recess » / « groove ».
- viewer.js arbitre un round-stock usiné à forte confiance avant le zero-bend
  plate result quand L/D >= 0,45. Les disques courts restent admissibles au DXF.
- Une plaque DXF-able peut maintenant afficher « Découpe de plaque + usinage »
  au lieu de masquer l'usinage secondaire.
- MODEL_ANALYSIS_CACHE_VERSION passe à 2.
