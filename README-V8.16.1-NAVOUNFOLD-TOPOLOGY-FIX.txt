NavoFlo V8.16.1 — NavoUnfold real STEP topology fix
====================================================

FIX
---
NavoUnfold no longer assumes that the user-selected planar face must touch a bend
cylinder directly as a single B-Rep face. Real-world STEP exporters frequently split
one physical flange into several connected coplanar faces.

The engine now:
- builds logical planar panel groups from connected coplanar STEP faces;
- connects cylindrical bends to those logical panels rather than raw face IDs;
- merges split tangent-boundary edges per panel;
- derives edge ownership from both face topology and edge owner metadata;
- tolerates small STEP/tessellation direction noise on bend generator edges;
- unfolds recursively panel-to-bend-to-panel using the logical panel graph;
- returns richer diagnostics when a bend still cannot be resolved safely.

VALIDATION
----------
A synthetic STEP-like topology was tested where the fixed flange is split into two
coplanar B-Rep faces and only the second face touches the cylindrical bend. V8.16
returns no-bends for that topology; V8.16.1 groups both faces into one panel and
unfolds the 90-degree bend successfully.

No D1 migration.
No auth/licensing changes.
