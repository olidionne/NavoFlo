NavoFlo V8.21.0 — DETERMINISTIC PROOF ENGINE + ASSEMBLY UX
Date: 2026-08-27
Cumulative over V8.20.4.

GOAL
Push manufacturing recognition as far as practical with exact geometry before asking any ML/AI for a second opinion, while improving Inventor STEP assembly workflows.

ASSEMBLY TREE
- Right-click directly on a visible 3D component opens the same assembly context menu as the tree.
- The clicked 3D component is highlighted blue and its tree row is revealed/scrolled into view.
- Context actions: Open Part/Open Sub-assembly, open parts in tabs, batch DXF, hide/show/isolate/show others/show all.
- New Collapse/Expand action in right-click menu.
- Repeated leaf occurrences with the same normalized Inventor part number at the same level are grouped under a synthetic folder: PART ×N.
- Repeated group folders support selection, hide/show, isolate, batch DXF, spread to tabs and Collapse/Expand.
- Fastener-like Inventor/STEP names receive a hardware marker in the tree.

DETERMINISTIC PROFILE AUTHORITY
- Structural profile recognition now combines:
  * exact B-Rep longitudinal topology,
  * real multi-section mesh fingerprints,
  * section component/hole topology,
  * section-area stability,
  * local AISC Shapes Database v16 matching.
- A high/probable AISC fingerprint can veto a false sheet-metal bend interpretation.
- This specifically protects W/M/S/HP/C/MC/HSS/PIPE/etc. against root-fillet cylinders being mistaken for press-brake bends.
- Short structural members down to L/depth ~1.55 may be considered, but below the normal 2.45 threshold they require a much stronger invariant-section proof.
- Synthetic regression fingerprint for W36X170 resolves to W36X170 at HIGH confidence (~94.5%).

FALSE MACHINING / POCKET HARDENING
- Surface family alone is no longer enough to claim machining.
- Torus alone != groove; cone alone != countersink; partial cylinder alone != blind hole.
- Blind pocket floors must be topologically connected through side walls to exactly ONE physical plate skin.
- Components reaching both skins are through-cut candidates and cannot prove a pocket.
- Exact OCCT hole / compound-hole descriptors are prioritized for drilling, blind-hole, counterbore and countersink proofs.
- A single proven through slot/profile is preserved as an internal cut; an external perimeter is inferred from area ranking only when two or more full-thickness closed wall components exist.
- ML/AAGNet remains an optional second opinion only for ambiguous cases; deterministic proofs can suppress the ML review entirely.

FASTENER / HARDWARE RECOGNITION
New local deterministic recognizer, no AI/external service:
- bolt / boulon
- screw / vis
- nut / ecrou
- washer / rondelle
- stud / threaded rod
Signals combine assembly metadata with B-Rep signatures such as cylindrical shank, head envelope, coaxial through hole, annular washer, polygonal nut body and aspect ratios.
Recognized hardware:
- is not classified as machining,
- is not treated as sheet metal,
- is not batch-exported as a production DXF,
- is labeled as Fastener/Boulonnerie in Properties.

PERFORMANCE / KEEPING NAVO3D RESPONSIVE
- Full expensive manufacturing metadata is still skipped for an already-proven ordinary bent sheet.
- It is forced only when the result is ambiguous, structural-profile evidence exists, or hardware metadata requires arbitration.
- Assembly root is not globally classified as one manufacturing part.
- Batch DXF yields between parts and skips deterministic non-DXF classes.

CACHE
- MODEL_ANALYSIS_CACHE_VERSION = 10, forcing one clean classification refresh after deployment.

VALIDATION COMPLETED
- node --check on all changed JS.
- Existing V8.20 manufacturing regression contract: PASS.
- Existing V8.20.1 structural-profile regression: PASS.
- V8.21 deterministic intelligence regression: PASS.
  * A325 / F436 / A563 metadata fastener tests.
  * Fastener excludes machining and DXF.
  * W36X170 AISC fingerprint = HIGH match (~94.5%).
- FR/EN HTML duplicate-ID and context-action checks.

IMPORTANT FIELD TEST
The exact Inventor assembly containing the reported W36X170 was not attached to the V8.21 build turn. The deterministic W36X170 fingerprint is regression-tested, but the actual Inventor occurrence should still be field-tested after deploy for hierarchy naming/transforms and its exact exported B-Rep topology.
