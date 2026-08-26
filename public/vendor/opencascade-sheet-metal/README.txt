NavoFlo / Open Cascade Sheet Metal Operations — proprietary runtime slot

This directory intentionally contains NO Open Cascade commercial binaries.
Do not commit or redistribute Sheet Metal Operations SDK files until the Open Cascade license explicitly allows it.

Plan A target:
- compile/link the Sheet Metal Operations SDK for Emscripten/WebAssembly;
- keep STEP input entirely local in the browser;
- expose a thin NavoFlo bridge rather than coupling viewer.js to vendor API names.

Expected NavoFlo bridge contract (to implement after the evaluation SDK is received):

export async function createNavoFloSheetMetalEngine(options) {
  return {
    async analyzeStep({ bytes }) { ... },
    async unfoldStep({ bytes, fixedFace, kFactor, bendAllowanceTable }) { ... },
    async dispose() { ... }
  };
}

The unfold result should be normalized by the bridge to vendor-neutral data:
- flat B-Rep/tessellation for display;
- outside contour and internal cutouts;
- bend centerlines;
- bend direction (up/down);
- bend angle/radius;
- thickness;
- validation/warnings.

Recommended public runtime filenames once licensing is settled:
  navoflo-smo-bridge.js
  navoflo-smo.wasm
Any proprietary filenames supplied by Open Cascade can remain private behind the bridge.
