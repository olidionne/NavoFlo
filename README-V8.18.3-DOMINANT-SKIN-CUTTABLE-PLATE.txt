NavoFlo V8.18.3 — Dominant-skin cuttable plate proof

Changes
- Adds a second, conservative flat-plate proof for STEP solids whose two main skins
  are global parallel support planes but whose edge rounds, bevels, clipped corners,
  or through-features make the exact translated-cap signature fail.
- Keeps exact rectangular flat bar as 'Profilé probable' while making shaped plate
  blanks directly DXF-exportable.
- Structural W/L/C/HSS and formed-sheet detection remain protected: a cuttable plate
  must be fully contained between its two dominant skins and thin relative to BOTH
  in-plane dimensions.
- UI labels a loose proven slab as 'Plaque à découper' / 'Cut plate'.
- Manufacturing panel reports 'Découpe de plaque' when plate proof is authoritative.

Regression targets supplied by the user
- ST01-0011_0.step: exact rectangular flat bar -> probable profile + DXF.
- ST01-0006_0.step: shaped plate blank -> cut plate + DXF.
- 25021600_521-00-01_0.step: shaped/holed plate -> cut plate + DXF.
- 25021600_503-00-02_0.step: shaped/holed plate -> cut plate + DXF.
- 25021600_502-01-13_0.step: intended shaped plate; covered by the same global-skin proof.

Cache busting: viewer.js v8.18.3, manufacturing-classifier.js v8.18.3.
