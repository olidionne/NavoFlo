NavoFlo V8.16.7 — NavoUnfold DXF Arc Direction Fix

BASELINE
- Includes the V8.16.6 OCCT topology-ID normalization fix.
- The STEP bend on 25021600_502-00-11_0.step remains detected and unfolded.

ROOT CAUSE FIXED
- DXF ARC entities are always drawn counter-clockwise from start angle to end angle.
- V8.16.6 chose arc direction mainly from exact arc length.
- For a 180-degree semicircle, both possible directions have the same length (PI * R), so the choice is ambiguous.
- This is why one end of an obround/slot could be exported on the wrong side even though the flat preview geometry was correct.

V8.16.7
- Uses OCCT tessellated interior points to identify which side of the chord the real B-Rep arc occupies.
- Uses exact OCCT edge start/end points for exported circular arcs and straight cut lines.
- Exact edge length remains a fallback/tie-breaker for non-180-degree arcs.
- Updates NavoUnfold result marker to MVP 1.7 and cache-busts viewer/worker/module URLs to 8.16.7.

EXPECTED REGRESSION
File: 25021600_502-00-11_0.step
- Bend detection/unfold: unchanged from V8.16.6.
- Slot: both semicircular ends must bulge outward and connect to the two straight slot sides.
- Outer rounded corners: unchanged.
- Bend line: unchanged.

No D1/auth/licensing changes.
