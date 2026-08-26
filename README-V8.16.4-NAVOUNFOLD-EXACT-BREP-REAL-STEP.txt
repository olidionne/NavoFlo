NavoFlo V8.16.4 — NavoUnfold Exact B-Rep / Real STEP Fix
==========================================================

Target regression file validated:
  25021600_502-00-11_0.step

Root cause addressed
--------------------
V8.16.3 classified bends from triangulated face centroid/normal data. On real STEP
imports, display tessellation can have independently split/reversed winding and is not
a reliable source for a manufacturing B-Rep operation.

V8.16.4 now asks the exact OCCT model for:
- exact face area and centroid,
- exact planar face normal evaluated at the exact centroid,
- exact edge length and endpoints.

NavoUnfold consumes the exact centroid/normal when available and keeps tessellation
only for rendering/projecting the final flat mesh. The old axis-in-plane check is now
a classifier penalty instead of a hard deletion when the radial/topological evidence
already identifies a valid non-parallel sheet bend.

Real STEP validation
--------------------
For Face #14 of the supplied STEP:
- thickness: 6.350 mm
- inside radius: 15.875 mm
- bend angle: 90.000 deg
- K factor: 0.450
- bend allowance: 29.424942 mm
- detected bends: 1
- flat envelope: 226.274942 x 53.975000 mm

DXF R12 generated from this real-part regression passed ezdxf audit with:
- 0 errors
- 0 fixes

No D1 migration. No authentication/licensing changes.
