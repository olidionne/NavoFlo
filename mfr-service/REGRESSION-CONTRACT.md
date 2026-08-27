# V8.20 Manufacturing regression contract

The service/critical-arbitrator combination must preserve these semantics:

- **Pure plate through hole / through slot / through passage**: DXF-capable, *not* secondary machining by itself.
- **Blind hole / blind bore**: secondary machining.
- **Counterbore / countersink**: secondary machining.
- **Annular groove / O-ring groove / blind pocket**: secondary machining.
- **Turned shaft diameters / shoulders / grooves**: turning, no flat-DXF override.
- **Sheet metal bends**: NavoUnfold stays authoritative; MFR cannot steal the part.
- **AISC structural profile**: structural recognition stays authoritative; generic bar stock cannot steal the part.
- ML is a second opinion. A high-confidence ML `through_slot` may group local B-Rep fragments, but it may not erase a topologically proven blind/counterbore/groove feature.
