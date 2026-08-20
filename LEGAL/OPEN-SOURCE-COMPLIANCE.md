# Open-source compliance plan

## MIT components

Navo2D/Navo3D may remain proprietary while using MIT components. Preserve their
copyright/license text in `THIRD_PARTY_NOTICES` and the published license page.
Current identified MIT components include dxf-parser, its loglevel dependency,
and three.js.

## occt-js / Open CASCADE (LGPL 2.1)

The current Navo3D STEP worker loads a pinned `occt-js` module/WASM. The project
states that its bridge is LGPL-2.1; OCCT is LGPL-2.1 with the Open CASCADE
exception. A proprietary NavoFlo application is possible, but the LGPL rights
for the library must remain intact.

Recommended production arrangement:

1. Self-host the exact pinned `occt-js.mjs` and `occt-js.wasm` rather than loading
   only from a public CDN.
2. Make the deployed library version visibly identifiable in Navo3D About/legal.
3. Publish the complete corresponding source for that exact bridge/OCCT version,
   including modifications and build instructions if NavoFlo modifies it.
4. Preserve a practical way for recipients to replace/rebuild the LGPL library.
   Keep the LGPL module separate from proprietary NavoFlo code; do not fuse it
   into an opaque single binary that prevents replacement.
5. Publish LGPL-2.1 and the Open CASCADE exception text.
6. State prominently that Navo3D uses Open CASCADE Technology and that users have
   rights under LGPL-2.1 regarding that component.
7. Keep source/download availability for the period required by the chosen LGPL
   compliance method; have counsel confirm the final WebAssembly distribution
   approach before paid launch.

If NavoFlo later prefers not to manage LGPL obligations, evaluate a commercial
OCCT licensing arrangement rather than simply deleting the notices.
