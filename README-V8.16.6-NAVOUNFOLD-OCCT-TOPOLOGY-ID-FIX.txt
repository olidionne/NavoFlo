NavoFlo V8.16.6 — NavoUnfold OCCT Topology ID Fix

ROOT CAUSE FIXED
- The pinned occt-js bridge stores face.edgeIndices as ZERO-BASED positions in geometry.edges.
- Edge objects themselves expose ONE-BASED B-Rep ids.
- V8.16.5 treated edgeIndices as ids, shifting every face/edge adjacency by one.
- On 25021600_502-00-11_0.step this specifically broke the real Face #14 -> Edge #38 -> cylindrical Face #10 relationship and produced `no-bends`.

V8.16.6
- Normalizes raw occt-js edgeIndices to B-Rep edge ids at the STEP worker boundary.
- Uses a tangent-face graph inspired by established sheet-metal unfolders: shared B-Rep adjacency first, then exact plane/cylinder tangency.
- Bend recognition no longer depends on the shared edge being reported as LINE or on its tessellated polyline being perfect.
- Keeps exact OpenCascade face normals, centers, radii, edge lengths and endpoints.

REAL STEP REGRESSION
File: 25021600_502-00-11_0.step
Fixed face: #14
Expected bend: cylindrical face #10
T = 6.350 mm
Ri = 15.875 mm
Angle = 90 deg
K = 0.45
BA = 29.424942 mm
Flat envelope = 226.274942 x 53.975000 mm

No D1/auth/licensing changes.
