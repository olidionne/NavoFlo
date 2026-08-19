/* NavoFlo STEP worker
   STEP/STP parsing is performed locally in the visitor's browser.
   The OpenCascade WebAssembly engine is downloaded as application code.
   The user's CAD file is never uploaded.
*/

const OCCT_VERSION = '0.0.23';
const OCCT_BASE = `https://cdn.jsdelivr.net/npm/occt-import-js@${OCCT_VERSION}/dist/`;

try {
  importScripts(`${OCCT_BASE}occt-import-js.js`);
} catch (error) {
  self.postMessage({
    type: 'engine-error',
    error: `Unable to load STEP engine ${OCCT_VERSION}: ${error?.message || String(error)}`
  });
}

let occtPromise = null;

function getOcct() {
  if (typeof occtimportjs !== 'function') {
    throw new Error('OpenCascade STEP engine did not initialize.');
  }

  if (!occtPromise) {
    occtPromise = occtimportjs({
      locateFile(path) {
        if (path.endsWith('.wasm')) {
          return `${OCCT_BASE}occt-import-js.wasm`;
        }
        return `${OCCT_BASE}${path}`;
      }
    });
  }

  return occtPromise;
}

self.onmessage = async (event) => {
  const { id, buffer } = event.data || {};
  if (!id || !buffer) return;

  try {
    const occt = await getOcct();

    // Official API: Uint8Array content + optional triangulation params.
    const result = occt.ReadStepFile(new Uint8Array(buffer), {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.001,
      angularDeflection: 0.5
    });

    if (!result) {
      throw new Error('STEP engine returned no result.');
    }

    if (result.success !== true) {
      throw new Error('OpenCascade could not read this STEP/STP file.');
    }

    if (!Array.isArray(result.meshes) || result.meshes.length === 0) {
      throw new Error('STEP file was read, but no displayable mesh was produced.');
    }

    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error?.message || String(error)
    });
  }
};
