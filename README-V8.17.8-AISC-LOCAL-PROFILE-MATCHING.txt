NavoFlo V8.17.8 — AISC local profile matching

- Integrates the user-supplied AISC Shapes Database v16.0 as a local lazy-loaded data asset.
- 2,299 structural shapes are available offline in Navo3D; no external profile-identification API is called.
- The geometric classifier remains authoritative: AISC matching only runs after a body is classified as a constant-section structural profile/extrusion.
- Profile fingerprint now includes exact outer cross-section spans, average section area estimated from STEP solid volume / profile length, and longitudinal B-Rep topology counts.
- Matching prioritizes exact outer dimensions, then cross-section area / linear mass consistency, with conservative topology tie-breakers.
- Properties now show AISC imperial designation, metric designation, linear mass and match confidence.
- Tentative matches are displayed as candidates but do not replace the generic geometry type label.
- The AISC JSON is loaded only when a structural profile is detected (~1.0 MB uncompressed).

Regression examples from the supplied STEP set:
- 500-00-11 -> HSS2X1X3/16 / HSS50.8X25.4X4.8 (high)
- 500-00-21 -> L2X2X1/4 / L51X51X6.4 (high)
- 500-00-22 #1 -> L2X2X1/4 / L51X51X6.4 (high)
- 500-00-22 #2 -> L2X2X1/4 / L51X51X6.4 (high)
- 502-01-09 -> W6X20 / W150X29.8 (probable; geometry has substantial cuts, so the area check is intentionally conservative)

Dataset source integrated for this build:
- aisc-shapes-database-v160-2.xlsx (provided by the user in the development conversation)
