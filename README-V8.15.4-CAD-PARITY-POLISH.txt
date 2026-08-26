NavoFlo V8.15.4 — CAD PARITY POLISH
====================================

Focus: field-test corrections + AutoCAD/eDrawings muscle-memory pass.

Navo3D
- Blank click now fully clears measurement label AND draggable dotted tether.
- Front/Back/Left/Right/Top/Bottom are true orthographic standard views.
- Perspective remains an explicit per-user toggle.
- F / Fit now fits the current orientation instead of resetting to ISO.
- Z / Shift+Z zoom out/in; arrows rotate 10°, Shift+arrows 90°.
- Shift+F1/F2/F3/F4 = Auto/Vertex/Edge/Face selection filters.
- Legacy V8.15.3 saved camera state is safely refit when projection metadata is missing.

Navo2D
- Angular dimension witness lines no longer overdraw the source geometry when unnecessary.
- Smart DIM supports point -> reference line and reference line -> opposite snapped point using perpendicular distance.
- F2 expands/collapses the recent command transcript.
- Removed the browser "Leave site?" warning when switching Navo2D/Navo3D; CAD workspace is persisted instead.

Audit
- Added AUTOCAD-EDRAWINGS-PARITY-AUDIT-V8.15.4.md with implemented parity and explicit remaining gaps.

Deployment
- No D1 migration.
- No authentication, licensing, Stripe, Resend, audit-log or security-policy changes.
