/* NavoFlo STEP worker
   STEP/STP is parsed locally in the visitor's browser.
   occt-import-js is downloaded as application code; the CAD file is never uploaded.
*/
const OCCT_VERSION = '0.0.24';
const OCCT_BASE = `https://cdn.jsdelivr.net/npm/occt-import-js@${OCCT_VERSION}/dist/`;

importScripts(`${OCCT_BASE}occt-import-js.js`);

let occtPromise = null;

function getOcct() {
  if (!occtPromise) {
    occtPromise = occtimportjs({
      locateFile(path) {
        if (path.endsWith('.wasm')) return `${OCCT_BASE}occt-import-js.wasm`;
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
    const result = occt.ReadStepFile(new Uint8Array(buffer), null);

    if (!result || !result.success) {
      throw new Error('OpenCascade could not import this STEP file.');
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
