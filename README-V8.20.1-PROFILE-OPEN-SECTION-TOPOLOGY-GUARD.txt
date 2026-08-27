NavoFlo V8.20.1 — PROFILE OPEN-SECTION TOPOLOGY GUARD
======================================================
Baseline: V8.20.0
Date: 2026-08-27

PURPOSE
-------
Correct a structural-profile false positive observed on:
  25021600_500-00-11_0.step

The body is an OPEN U channel, nominally:
  U2X1X3/16

V8.20.0 could incorrectly identify it as:
  HSS2X1X3/16

ROOT CAUSE
----------
The AISC matcher correctly saw an exact 2 x 1 in outside envelope, but the old
family check used only a soft penalty when the measured transverse section had
no internal void. That allowed an HSS candidate to survive despite topology
that physically contradicts a hollow section.

V8.20.1 CHANGES
---------------
1. Hollow-section topology is now a hard invariant when the transverse section
   fingerprint is reliable:
   - HSS / PIPE require at least one persistent internal section void.
   - a clean one-loop solid/open section cannot be labeled HSS / PIPE.

2. The real transverse-section fingerprint now records material-centroid
   eccentricity in both section axes.

3. A conservative local open-channel matcher was added for non-AISC U/C stock:
   - one connected material island;
   - zero internal section holes;
   - symmetric about one section axis;
   - eccentric toward the web on the other axis;
   - sufficient longitudinal planar/cylindrical profile evidence;
   - section area consistent with a nearby standard fractional wall thickness.

4. The properties UI now accepts geometric profile standards in addition to
   AISC-only labels. Local U matches display as "Profilé · U..." instead of
   incorrectly claiming "Profilé AISC".

REAL STEP VALIDATION
--------------------
25021600_500-00-11_0.step was independently sectioned and replayed through the
Navo profile detector:
  envelope          : 50.8 x 25.4 mm = 2 x 1 in
  section topology  : 1 component, 0 holes
  measured area     : ~469.66 mm²
  channel centroid  : centered on one axis, offset toward the web on the other
  result V8.20.1    : U2X1X3/16 — HIGH confidence

REGRESSION GUARDS
-----------------
- HSS2X1X3/16 with a true section void still matches HSS2X1X3/16.
- A centered solid/open section is not promoted to U merely from dimensions.
- HSS / PIPE cannot win against a reliable no-hole section fingerprint.

IMPORTANT — SHEET-METAL REGRESSION REPORTED AT THE SAME TIME
-------------------------------------------------------------
No sheet-metal recognition rule is changed by this V8.20.1 patch.
The separate STEP that reportedly changed from bent-sheet recognition to solid
was not present in the conversation upload when this patch was built, so that
case is intentionally NOT guessed or patched blindly.

Code comparison V8.19.2 -> V8.20.0 showed:
- sheetmetal-engine.js: byte-identical;
- step-worker.js: no functional sheet-metal change (revision/comment only);
- analysis cache version: 5 -> 6, which forces a fresh preflight.

Therefore the reported regression should be reproduced with the exact STEP and
fixed as a separate deterministic geometry case.

DEPLOYMENT
----------
Existing V8.20.0 production:
  use V8.20.1 PATCH.

Fresh deployment:
  use V8.20.1 FULL DEPLOY.
