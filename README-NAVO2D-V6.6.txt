Navo2D V6.6 — AutoCAD-style clickable command options

Changes:
- All bracketed command-line options are rendered as gray clickable chips.
- The keyboard hotkey letter is highlighted/underlined in blue.
- Clicking an option executes the same one-letter command path as typing it.
- Applies globally to all current commands using bracket options, including:
  LINE / PLINE: Close/Fermer, Undo/Annuler
  CIRCLE: Diameter
  MIRROR: Yes/No / Oui/Non
  OFFSET: Through / ÀTravers
  ARRAY: Rectangular / Polar
  FILLET: Undo, Polyline, Radius, Trim, Multiple, Trim/NoTrim
  CHAMFER: Undo, Polyline, Distance, Angle, Trim, mEthod, Multiple, Trim/NoTrim, Distance/Angle
- French LINE/PLINE keyboard aliases F=Fermer and A=Annuler added so the shown first-letter shortcuts actually work.
- Existing V6.5 FILLET/CHAMFER/TRIM geometry behavior retained.
