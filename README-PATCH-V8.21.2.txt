NavoFlo V8.21.2 — Classification Arbitration PATCH

Apply on top of V8.21.1.

Changed:
- public/js/viewer.js
- public/js/sheetmetal-engine.js
- public/js/profile-standard-matcher.js
- public/js/manufacturing-hypothesis-gate.js (new)
- public/navo3d/index.html
- public/en/navo3d/index.html
- tests/v8212-classification-arbitration.mjs

Purpose:
1. Rolled AISC angles (L / 2L) must not be classified as bent sheet merely because the inside root radius is cylindrical.
2. A strong axisymmetric round-stock / turning hypothesis must be evaluated before a local sheet-metal hypothesis is allowed to win.
3. Re-enable reliable raw-stock + machining classification for stepped shafts such as ST01-0002 while preserving V8.21.1 hard-proof rules for plate pockets.
4. Model analysis cache bumped to V12 to force one clean re-analysis after deployment.
