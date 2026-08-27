NavoFlo V8.20.2 — SHEET FAST PREFLIGHT + FLAT DIMENSIONS
Date: 2026-08-27

OBJECTIFS
1) Corriger la régression apparente de ST01-0005_0.step après V8.20.0.
2) Éviter que l'analyse de fabrication détaillée retarde la reconnaissance d'une tôle pliée très perforée.
3) Afficher le dimensionnel de fabrication des tôles dans PROPRIÉTÉS.
4) Conserver cumulativement la correction V8.20.1 des profilés ouverts (ex. U2X1X3/16).

CAUSE CONFIRMÉE
- ST01-0005_0.step fourni le 27 août est byte-for-byte identique au fichier de régression fourni le 26 août.
- sheetmetal-engine.js est identique entre V8.19.2 et V8.20.0 : le moteur géométrique de dépliage n'a pas régressé.
- V8.20.0 a augmenté MODEL_ANALYSIS_CACHE_VERSION de 5 à 6 et force donc une nouvelle analyse complète.
- Le pipeline effectuait l'enrichissement fabrication (trous / AAG / arêtes exactes) avant d'afficher le résultat tôle. Sur ST01-0005, cela signifie 831 faces, 701 cylindres et des milliers d'arêtes à analyser alors que ces données ne sont pas nécessaires pour prouver les plis.

CORRECTION V8.20.2
- Nouvelle passe worker `sheetmetal-fast` :
  * géométrie analytique exacte des faces;
  * aire / centroïde / normales de plans;
  * topologie STEP déjà chargée;
  * PAS de DescribeExactHole / CompoundHole / Chamfer;
  * PAS de mesure exacte de toutes les arêtes.
- Si cette passe prouve une tôle avec plis, NavoUnfold accepte immédiatement le résultat et n'exécute pas MRE, puisque MRE était ensuite jeté pour une tôle pliée de toute façon.
- Si la pièce n'est pas une tôle pliée (plaque plane, profilé, brut ou pièce usinée), une deuxième passe `manufacturing-full` conserve tout le moteur V8.20.
- Les données worker sont cachées par géométrie pour éviter de répéter la base exacte.
- Cache d'analyse Navo3D -> version 7 afin d'invalider les classifications V8.20.0 déjà sauvegardées.

VALIDATION ST01-0005_0.step
Fichier réel fourni par l'utilisateur :
- 1 solide
- 831 faces
- 701 faces cylindriques
- 30 faces planes
- 100 B-Splines

Le moteur NavoUnfold exécuté avec la passe légère retourne :
- ok = true
- 4 plis
- 5 panneaux
- épaisseur = 1.89738 mm
- développé = 135.489443 x 135.489443 mm

PROPRIÉTÉS TÔLE
Une nouvelle ligne apparaît uniquement lorsqu'une tôle/plaque est reconnue :
- Tôle pliée : `Dimensions dépliées (T × H × L)`
- Plaque plane : `Dimensions (T × H × L)`

Les valeurs suivent l'unité d'affichage Navo3D et se mettent à jour lors d'un changement mm/po.
Pour garantir un dimensionnel stable même si le repère 2D de la face fixe échange ses axes, H = petit côté développé et L = grand côté développé.

FICHIERS PRINCIPAUX
- public/js/viewer.js
- public/js/step-worker.js
- public/js/sheetmetal-engine.js
- public/js/profile-standard-matcher.js (cumul V8.20.1)
- public/navo3d/index.html
- public/en/navo3d/index.html

VALIDATIONS
- node --check viewer.js : PASS
- node --check step-worker.js : PASS
- tests/profile-v8201-regression.mjs : PASS
- tests/mfr-v820-regression.mjs : PASS
- ST01-0005 réel / NavoUnfold fast face-data regression : PASS (4 plis)
