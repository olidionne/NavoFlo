NavoFlo V8.17.9 — AISC intact-section fingerprint + richer profile properties

- Fixes structural profiles remaining at the generic "Profilé / extrusion · L/C" label even when an AISC shape is identifiable.
- The profile detector now samples multiple real cross-sections perpendicular to the detected extrusion axis and keeps the largest valid material section.
- This intact-section fingerprint is resilient to drilled holes, slots, copes and angled end cuts that previously reduced volume/length and made AISC matching ambiguous.
- Section topology (connected material islands / nested voids) is used as an additional family discriminator for W/L/HSS/PIPE/2L candidates.
- AISC Properties now show: imperial designation, metric designation, family, dimensions, thicknesses, section area, kg/m + lb/ft, model length, theoretical stock mass and confidence.
- The AISC section is also created dynamically by viewer.js if an older cached HTML shell does not contain it.
- Unit-sensitive section dimensions and model length follow the Navo3D display unit.

Regression references:
- 25021600_502-01-09_0.step -> W6X20 / W150X29.8, high confidence.
- 25021600_500-00-21_0.step -> L2X2X1/4 / L51X51X6.4, high confidence.
- 25021600_500-00-22_0(#1).STEP -> L2X2X1/4 / L51X51X6.4, high confidence.
- 25021600_500-00-22_0(#2).STEP -> L2X2X1/4 / L51X51X6.4, high confidence.
- 25021600_500-00-11_0.step -> HSS2X1X3/16 / HSS50.8X25.4X4.8, probable.
