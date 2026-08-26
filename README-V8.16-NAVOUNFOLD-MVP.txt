NavoFlo V8.16 — NavoUnfold MVP (local STEP sheet-metal unfolding)
=================================================================

WHAT IS NEW
-----------
1. Navo3D measurement units remain a per-user preference (V8.15.8 behavior retained).
2. New NavoUnfold geometric engine for STEP sheet metal:
   - user selects one planar fixed face;
   - exact STEP surface families are queried through the existing local OCCT worker;
   - planar flanges and cylindrical bend skins are recognized from B-Rep topology;
   - constant thickness can be inferred from concentric inner/outer cylinders;
   - each bend uses its actual STEP angle and inside radius;
   - Bend Allowance = angle(rad) * (R_inside + K*T);
   - multiple bends are unfolded recursively through a face/bend graph;
   - panel holes and cut-outs are retained from the original face tessellation;
   - bend surfaces are geometrically unwrapped to the neutral-axis length;
   - Navo3D renders a real coplanar flat-pattern mesh with thickness;
   - Folded / Flat view toggle;
   - DXF export: CUT + BEND layers.

IMPLEMENTATION PRINCIPLES
-------------------------
- Local-first: the STEP file remains on the workstation.
- Clean-room NavoFlo implementation. No FreeCAD SheetMetal source code is copied.
- Existing occt-js / Open CASCADE B-Rep and exact-query path is reused.
- Unfolding is not a visual rotation trick: planar flange geometry is remapped to a
  common plane and cylindrical bend geometry is unwrapped using neutral-axis Bend
  Allowance.

SUPPORTED MVP TOPOLOGY
----------------------
- constant-thickness sheet metal;
- planar flanges;
- standard cylindrical bends below 180 degrees;
- one connected sheet skin from the selected fixed face;
- multiple sequential/branched standard bends;
- holes/slots/cut-outs represented in the selected skin tessellation.

INTENTIONALLY NOT SILENTLY APPROXIMATED YET
-------------------------------------------
- hems / 180 degree crushed bends;
- jogs requiring special treatment;
- lofted / conical / spline bends;
- stamped/form-tool geometry;
- closed sheet topology without a seam;
- automatic bend UP/DOWN manufacturing convention;
- exact B-Rep solid reconstruction of the flat pattern (the flat geometry is a
  dimensionally computed mesh with real thickness; DXF is generated from its flat
  boundary and bend-center lines).

HOW TO TEST
-----------
1. Open a STEP sheet-metal part in Navo3D.
2. Open Tôlerie / Sheet Metal.
3. Click one large planar skin face.
4. Click "Face fixe depuis sélection" / "Fixed face from selection".
5. Enter T if it was not detected automatically. Set manual K if required.
6. Click "Déplier la tôle" / "Unfold sheet".
7. Switch PLIÉE/FOLDED and DÉPLIÉE/FLAT.
8. Export the flat DXF and compare critical dimensions with the known CAD flat pattern.

VALIDATION PERFORMED DURING BUILD
---------------------------------
- synthetic one-bend 90 degree part: expected neutral-axis developed span matched;
- synthetic two-bend chained part: recursive developed span matched;
- generated R12 DXF parsed with ezdxf and audited with 0 errors / 0 fixes;
- JavaScript syntax validation on project JS files.

NO D1 MIGRATION.
NO AUTH / LICENSING CHANGES.
