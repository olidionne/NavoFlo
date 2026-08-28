NavoFlo V8.22.0 — Machining AAG / Strict Concavity PATCH

Apply on top of V8.21.2.

Changed / added:
- public/js/step-worker.js
- public/js/manufacturing-machining-evidence.js (new)
- public/js/manufacturing-recognition-engine.js
- public/js/manufacturing-critical-arbitrator.js
- public/js/manufacturing-hypothesis-gate.js
- public/js/viewer.js
- public/navo3d/index.html
- public/en/navo3d/index.html
- tests/v8220-machining-aag-concavity.mjs (new)
- MFR-ANALYSIS-PIPELINE-V8.22.0.md (new)

Purpose:
1. Add strict CONCAVE/CONVEX transition semantics to exact B-Rep AAG edges.
2. Build virtual negative-volume components from strictly concave transitions.
3. Prove blind drilling/counterbores/countersinks from concave cylinder -> plane/cone transitions.
4. Prove milled pockets from planar floors surrounded by concave wall transitions.
5. Restore groove evidence through concave recessed revolution features.
6. Prove turning when strictly more than 80% of revolution faces share one gp_Ax1 line.
7. Canonical arbitration: when constant sheet thickness is not proven and strict concave machining proof exists, Solid/Unknown is no longer a valid terminal result.
8. Preserve structural-profile authority so W/C/L/U root fillets do not become false machining.
9. Analysis cache bumped V12 -> V13.

Important implementation note:
"Negative volume" in V8.22.0 is a deterministic topological cavity component built from exact AAG concavity. It is not yet a full OCCT Boolean subtraction of a reconstructed raw stock solid. That future Boolean Delta layer can be added without changing the proof interfaces introduced here.
