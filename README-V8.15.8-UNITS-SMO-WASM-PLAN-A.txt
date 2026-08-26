NavoFlo V8.15.8 — Persistent Navo3D units + Open Cascade SMO Plan A prep

1. Navo3D display units are now a real per-user preference.
   - Choosing po/in, mm, cm, m, or model units is persisted through /api/preferences (module navo3d).
   - New STEP files use the saved display unit instead of forcing mm.
   - Existing open tabs may continue to restore their own session view/unit state.
   - Mesh formats remain model-unit because STL/OBJ/GLTF do not provide a reliable physical unit.

2. Open Cascade Sheet Metal Operations (commercial SDK) — Plan A
   - The commercial runtime is NOT redistributed in this package.
   - NavoFlo should integrate it locally in WebAssembly/Emscripten so STEP data never leaves the workstation.
   - Vendor binaries/headers and redistribution rights must be obtained from Open Cascade before the real unfolding engine can be compiled.
   - Integration boundary is documented in public/vendor/opencascade-sheet-metal/README.txt.

No D1 migration. No authentication/licensing changes.
