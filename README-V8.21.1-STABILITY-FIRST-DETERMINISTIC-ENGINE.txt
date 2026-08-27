NavoFlo V8.21.1 — STABILITY FIRST / DETERMINISTIC PROOF ENGINE
Date: 2026-08-27

Purpose
-------
V8.21.1 is a stabilization/architecture pass after field testing V8.21.0 on a large
Inventor STEP assembly. It deliberately reduces heuristic classification and moves
Navo3D toward a major-CAD style evidence hierarchy:

  STEP hierarchy / occurrence metadata = prior only
  + exact OCCT B-Rep primitives
  + topology / adjacency
  + invariant cross-section proof
  + local AISC v16 shape database
  + deterministic manufacturing evidence
  -> final classification
  -> ML only as advisory evidence when deterministic proof is incomplete

The CAD kernel remains authoritative. AI/ML is not allowed to overrule strong exact
geometry proof or invent machining by itself.

Field issues fixed
------------------
1) Repeated-part tree recursion / performance
   - Root cause: a synthetic PART xN folder passed its own member list back through
     duplicate grouping, recursively creating PART xN -> PART xN -> ...
   - Synthetic folders are now a presentation layer only.
   - Their member occurrences are rendered raw exactly ONCE, one level below.
   - Synthetic group occurrence resolution no longer scans the whole assembly.

2) Selection slowdown in large assemblies
   - V8.21.0 cleared tree highlighting by walking every occurrence/mesh per click.
   - V8.21.1 tracks only highlighted meshes and restores only those meshes.
   - Normal selection changes only the selected DOM row. The full tree rerenders
     only when an ancestor/group actually needs to expand.

3) Blank click not reliably deselecting
   - Root cause: THREE line/point ray thresholds are world-space; in Auto mode a
     remote edge could be returned even when the cursor was visually in empty space.
   - Auto mode now accepts vertices/edges only inside explicit screen-pixel snap
     apertures. Outside them, only a real front-face hit counts.
   - A true blank click reliably clears both CAD selection and assembly-tree selection.

4) W36x170 / AISC beam falsely treated as bent sheet metal
   - Inventor/Content Center occurrence names such as
       "105101P02_AISC - W 36x170"
     are now parsed as an AISC designation PRIOR.
   - The name alone is never enough. Navo3D still requires exact B-Rep evidence:
       * constant longitudinal section
       * >= 3 section samples
       * sufficient side-area / aspect / trace proof
       * measured envelope compatible with the named AISC row
       * section-area compatibility when available
   - A proven structural profile has STRICT precedence over local cylindrical
     root fillets that can otherwise look like press-brake bend pairs.
   - Structural authority disables Unfold / flat DXF for that component.

5) Gusset falsely treated as bolting / hardware
   - Hardware recognition is now intentionally conservative.
   - Negative fabrication names (gusset/gousset/plate/plaque/bracket/support/beam/
     channel/angle/stiffener/etc.) block name-based hardware classification.
   - Geometry-only nut proof now requires a centered axial through-hole, canonical
     regular-hex longitudinal face signature, compact proportions and non-plate body.
   - Geometry-only bolt/screw proof requires a centered long cylindrical shank,
     meaningful axial coverage and a compatible head signature.
   - Geometry-only hardware needs near-canonical confidence before MRE excludes the
     component from manufacturing/DXF.

6) False machining / false pockets
   - V8.21.1 changes the policy from "signal => machining" to "hard proof => machining".
   - On plate/sheet contexts, machining is promoted only by exact OCCT/topological
     proof such as:
       * exact compound-hole descriptor (counterbore/countersink)
       * exact blind/cross-hole descriptor
       * topology-proven one-sided pocket/groove/chamfer
       * equivalent near-certain deterministic local feature
   - AAGNet/ML guesses and generic cylinder/cone/torus families are ADVISORY only.
   - Ambiguous hypotheses may set possibleMachining internally, but they do not label
     the part "machining" and do not appear as recognized manufacturing features.

Cache / deploy
--------------
- Analysis cache version: 11. Previously cached V8.21.0 classifications are rebuilt.
- FR and EN Navo3D pages use viewer.js/viewer.css cache key v8.21.1.

Regression validation performed
-------------------------------
- node --check: modified JS files PASS
- V8.20 manufacturing regression contract PASS
- V8.20.1 profile regression PASS
- V8.21.0 deterministic intelligence regression PASS
- V8.21.1 stability/safety regression PASS
- Synthetic AISC W36X170 geometric match: HIGH (~94.5%)
- Inventor-style "... AISC - W 36x170" name + geometry authority test PASS
- Thin polygonal gusset + central hole is NOT hardware PASS
- Canonical compact hex nut remains hardware PASS
- Advisory ML blind-hole cannot promote a clean plate to machining PASS
- Topology-proven one-sided pocket DOES promote machining PASS
- One-level repetition-folder static contract PASS
- Pixel-aperture blank-click selection contract PASS

Important field-validation note
-------------------------------
The screenshot supplied for this pass proves the recursive x80 tree symptom and shows
the exact Inventor AISC naming convention. The complete Inventor assembly STEP itself
was not attached in this turn, so this release does NOT claim a real-browser/B-Rep
validation against that exact assembly occurrence. The structural-name path therefore
still requires geometric agreement by design; it is not a filename override.
