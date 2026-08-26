NavoFlo V8.17.7 — exact section cap + sheet/profile arbitration

- Replaces the oversized stencil clipping cap with an actual triangulated cross-section computed from the model triangles.
- A long HSS/bar is no longer accepted as a flat plate merely because opposite longitudinal walls are congruent.
- Constant-section geometry is classified as sheet metal when a strong inner/outer cylindrical bend pair has radius delta equal to detected wall thickness.
- Otherwise conservative structural-profile classification remains.
- Regression targets: 502-00-22 and 502-00-13 must unfold; 500-series supplied stock profiles remain profiles; prior flat/unfold cases remain unchanged.
