NavoFlo V8.15.1 — CAD VISUAL POLISH + LOGICAL CYLINDER FACES

Changes from V8.15:
- Navo2D/Navo3D UI labels and document tabs are slightly larger and use a sharper system UI font.
- Navo3D selected-face overlay now respects the visible depth surface without negative polygon offset, preventing hidden inner faces from visually bleeding through outer walls when zoomed out.
- STEP cylindrical faces split by CAD topology are grouped on selection when adjacent faces belong to the same exact cylinder (same radius and axis). This makes split half-hole walls behave as one logical cylindrical face.
- Grouped cylindrical faces are highlighted together; exact area is summed and exact distance considers every grouped member face.
- No D1 migration. No licensing/auth changes.
