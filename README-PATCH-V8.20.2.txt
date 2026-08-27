NavoFlo V8.20.2 PATCH — cumulatif depuis V8.20.0

Remplacer les fichiers suivants :
- public/js/viewer.js
- public/js/step-worker.js
- public/js/sheetmetal-engine.js
- public/js/profile-standard-matcher.js
- public/navo3d/index.html
- public/en/navo3d/index.html

Le patch inclut aussi la correction V8.20.1 du profilé ouvert U2X1X3/16.

Important : V8.20.2 passe le cache d'analyse Navo3D à v7. Une classification V8.20.0 sauvegardée sera donc recalculée automatiquement une fois, avec le nouveau préflight rapide pour les tôles pliées.
