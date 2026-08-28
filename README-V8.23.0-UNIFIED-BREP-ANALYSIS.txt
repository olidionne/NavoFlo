NavoFlo V8.23.0 — Unified B-Rep Manufacturing Analysis

Objectif
--------
Éliminer les régressions de classification causées par des moteurs qui analysaient
la même pièce avec des descripteurs différents ou qui court-circuitaient les autres
hypothèses trop tôt.

Racines corrigées
-----------------
1. Le preflight sheet-metal ne renvoie volontairement pas les edgeInfo complets.
   Le détecteur de profilés exigeait pourtant edgeInfo.family=LINE : W/C/L/U pouvaient
   donc être désactivés dans la passe rapide et tomber en faux pliage.
2. Une preuve forte obtenue en preflight pouvait être remplacée par un échec de la
   passe complète (rolled/bent/profile -> Solid STEP).
3. viewer.js supprimait manufacturingCapability dès qu'un pliage était détecté,
   faisant disparaître le brut et l'usinage secondaire.
4. Le roundPlateContext sautait l'analyse de features rondes; les pucks similaires
   dépendaient alors de la concavité stricte d'une arête courbe, trop fragile selon
   l'export STEP.
5. L'AAG d'usinage pouvait interpréter les concavités normales d'un rayon de pliage
   comme des poches.

Implémentation
--------------
- Nouveau manufacturing-analysis-policy.js.
- Pièces normales: un seul jeu manufacturing-face-info exact partagé par tous les moteurs.
- Gros STEP: preflight léger + escalade conditionnelle + préservation des preuves fortes.
- Structural profile: fallback de rectitude géométrique lorsque edgeInfo manque.
- Sheet machining AAG: suppression des transitions natives panel<->bend.
- Pocket sur pièce pliée: fond compatible avec une vraie normale de panneau.
- Pucks: cylindre+cône coaxiaux, cylindres étagés et rainures annulaires reconnus
  par relation d'axes/topologie, indépendamment d'un seul signe de dièdre.
- Tournage: preuve gp_Ax1 >80% conservée.
- manufacturingCapability n'est plus supprimé automatiquement sur les pièces pliées.
- Cache d'analyse V14.

Contrat de régression réel
--------------------------
- U2x1: profilé
- fer-angle: profilé
- W beam: profilé
- 503-00-01: 4 plis, pas fausse poche
- ST13-0011: roulage
- ST01-0002: brut rond + tournage
- ST04-0025/0026/0030: brut rond + usinage via preuves relationnelles d'axes

Voir MFR-ANALYSIS-PIPELINE-V8.23.0.md pour le trajet complet.
