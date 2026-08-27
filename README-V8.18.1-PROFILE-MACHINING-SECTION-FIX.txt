NavoFlo V8.18.1 — Profile arbitration + machining fallback + exact section-plane fix

1) Structural profiles restored
- AISC / constant-section structural detection is authoritative again.
- Generic round/square/flat/rectangular/hex stock classification can no longer steal W/L/C/HSS/etc. profiles.
- AISC matching always runs when the sheet-metal engine returns structural-profile.

2) Machining / raw stock detection hardened
- Generic stock recognition no longer depends on a valid signed tessellation volume.
- Exact analytic envelope evidence (cylinders, planes, line directions) is primary.
- Mesh volume is optional and only used when self-consistent to estimate material removed.
- Round-stock detection now survives heavily turned parts where only a small fraction of the original OD remains.
- Turning, drilling/boring, chamfers and fillets remain geometry evidence.

Regression STEP files verified locally:
- 25021600_500-00-01_0(1).step -> round bar, machining
- ST01-0002_0(1).step -> round bar, machining
- ST01-0007_0(1).step -> round bar, machining
- ST04-0025_A(1).step -> round bar, machining
- ST04-0026_0(1).step -> round bar, machining
- ST04-0027_0(1).step -> round bar, machining
- ST04-0030_0(1).step -> round bar, machining
- ST14-0002_0(1).step -> round bar, machining
- ST14-0004_0(1).step -> round bar, machining

3) Section cap cannot follow an angled end face
- Every triangle/segment intersection point is snapped to the active mathematical clipping plane.
- The final section vertices are projected onto that plane again after loop welding.
- Cap normals are forced to the clipping-plane normal instead of being recomputed from triangulation.
- This prevents an angled/chamfered end vertex inside the welding tolerance from visually pulling the section cap onto the end face.
