NavoFlo V8.20.0 — CRITICAL MANUFACTURING RECOGNITION + OPTIONAL AAGNET BRIDGE
=============================================================================
Baseline: V8.19.2
Date: 2026-08-27

PURPOSE
-------
V8.20 changes the manufacturing recognizer from an accumulating list of local
B-Rep guesses into a deliberately layered decision system:

  exact STEP B-Rep
      -> stock/capability analysis
      -> AAG instance/topology analysis
      -> deterministic feature hypotheses
      -> Critical Manufacturing Arbitrator
      -> optional AAGNet second opinion when local semantics are ambiguous
      -> final Manufacturing Knowledge object

The critical design rule is unchanged and now enforced in code:
"stock family", "DXF capability", and "secondary machining" are independent.
A plate can be DXF-capable AND contain secondary machining.

LOCAL / PRODUCTION-SAFE CHANGES
-------------------------------
1. New `manufacturing-critical-arbitrator.js`.
   - through-hole / through-slot / through-passage do NOT prove machining on a
     constant-thickness plate.
   - blind hole, counterbore, countersink, groove, blind pocket, turning, etc.
     DO prove secondary machining.
   - stale low-level evidence is rebuilt from the final feature set.

2. Instance-level through-cut proof in MRE.
   - A full-thickness B-Rep component touching both plate skins is treated as
     one through-cut instance.
   - 2 cylindrical ends + planar walls => one through-slot instead of
     "2 drilled holes + 2 pockets".
   - when multiple full-thickness components exist, the largest side-wall
     perimeter is treated as the external profile so an obround OUTER contour
     is not confused with an internal slot.

3. Hard analytic machining floor.
   On a proven flat plate, exact analytic evidence cannot be erased by higher
   level grouping:
   - torus => annular groove / secondary machining
   - exact/partial blind cylinder => blind bore / secondary machining
   - compound hole => counterbore/countersink / secondary machining
   - cone => countersink/chamfer evidence
   This specifically protects the ST04-style round plate/ring cases.

4. V8.19.2 commercial raw-stock knowledge remains active.
   Broad rectangles outside plausible flat-bar ranges stay plate hypotheses.

5. Per-document analysis cache version bumped to 6. Old cached classifications
   are recomputed once, then persistence continues normally.

OPTIONAL AAGNET SECOND OPINION
------------------------------
V8.20 ships a separate `mfr-service/` reference sidecar based on AAGNet,
pinned to upstream commit:
  e0e36b7a12a7f01a29d7be36efc22730d293a1bd

The main NavoFlo Worker exposes:
  GET  /api/mfr/status
  POST /api/mfr/analyze

The bridge is DISABLED unless `NAVOFLO_MFR_URL` is configured. Therefore this
patch does not upload STEP files or introduce an external runtime dependency by
default.

When enabled:
- browser requests ML only if deterministic diagnostics mark the part for review;
- jobs are serialized client-side so opening a batch cannot burst inference;
- Worker requires an active Navo3D license and rate limits requests;
- max STEP body = 20 MiB;
- main NavoFlo keeps working if the ML service is offline;
- AAGNet predictions are a second opinion; the Critical Arbitrator is final.

FACE-ID SAFETY
--------------
AAGNet runs through PythonOCC, while the browser uses retained OCCT-js B-Rep IDs.
V8.20 deliberately marks AAGNet face numbers as ADVISORY and does not assume
that the two iteration orders are identical. ML may add/confirm feature-class
semantics, but exact face-level suppression/highlighting remains reserved for a
future geometric face mapper.

V8.21 BOUNDARY
--------------
V8.20 does NOT claim to perform true `Stock - Part` Boolean delta-volume.
The pinned browser occt-js API does not currently expose the required Boolean
Cut contract for this workflow. V8.21 is reserved for a controlled OCCT binding
using BRepAlgoAPI_Cut / exact delta-volume decomposition after regression tests.

REGRESSION CONTRACT INCLUDED
----------------------------
`tests/mfr-v820-regression.mjs` checks:
- obround through-slot => cutting only, no false machining;
- torus + blind bore on plate => secondary machining;
- same-domain skin split => no fake pocket;
- ML through-slot can remove only weak generic local hypotheses;
- a hard local counterbore cannot be erased by ML;
- ML blind-hole can upgrade an ambiguous plate to plate + machining.

VALIDATION PERFORMED
--------------------
- Node syntax checks on modified browser/Worker modules.
- Python bytecode compile on the AAGNet FastAPI wrapper.
- deterministic regression contract: PASS.
- ZIP integrity must be checked before delivery.

DEPLOYMENT
----------
Existing V8.19.2 production:
  use V8.20.0 PATCH.

Fresh deployment:
  use V8.20.0 FULL DEPLOY.

Do NOT configure `NAVOFLO_MFR_URL` until the separate NavoFeatureEngine
container has passed the real STEP regression corpus. Local V8.20 improvements
are independent of that optional service.
