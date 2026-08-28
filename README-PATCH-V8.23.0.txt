NavoFlo V8.23.0 — Unified B-Rep Manufacturing Analysis PATCH

À appliquer sur le repo V8.22.0 fourni par l'utilisateur.

Fichiers applicatifs modifiés / ajoutés:
- public/js/manufacturing-analysis-policy.js (nouveau)
- public/js/sheetmetal-engine.js
- public/js/manufacturing-machining-evidence.js
- public/js/manufacturing-recognition-engine.js
- public/js/manufacturing-critical-arbitrator.js
- public/js/manufacturing-hypothesis-gate.js
- public/js/viewer.js
- public/js/step-worker.js
- public/navo3d/index.html
- public/en/navo3d/index.html

Validation / documentation:
- tests/v8230-real-part-contract.mjs
- tests/fixtures/v8230/*.json
- MFR-ANALYSIS-PIPELINE-V8.23.0.md
- README-V8.23.0-UNIFIED-BREP-ANALYSIS.txt

Principales corrections:
1. Une seule autorité B-Rep complète pour les pièces de complexité normale.
2. W/C/L/U restent détectables dans le preflight sans edgeInfo exact.
3. Les preuves fortes profile/rolled/bend survivent à un enrichissement en échec.
4. Les rayons de pliage sont exclus des volumes négatifs d'usinage.
5. Les pucks utilisent des preuves relationnelles d'axes pour fraisures/lamages/rainures.
6. Les pièces pliées peuvent conserver leur brut/perçage/usinage secondaire.
7. Cache modèle V14 pour invalider les anciennes classifications.
