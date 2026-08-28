// mcmaster-pn.js — McMaster-Carr part number detection for NavoFlo
// Detects PN from STEP filename and/or custom STEP properties.
// No dependencies. Safe to use in browser module context.
//
// McMaster PN format: 4-6 digits + 1 uppercase letter + 2-4 digits
// Examples: 90591A031  4936K451  93827A150  92196A542  3401A12

// Use lookahead/lookbehind instead of \b so that _ separator works correctly.
// \b in JS treats _ as a word character, breaking "4936K451_HEX".
const MCMASTER_PN_RE = /(?<![A-Za-z\d])(\d{4,6}[A-Z]\d{2,4})(?![A-Za-z\d])/;

/**
 * Extract the best McMaster PN candidate from a filename string.
 * Returns {pn, source, score:2} or null.
 */
function detectPnFromFilename(filename) {
  if (!filename) return null;
  const base = String(filename).replace(/\.[^.]+$/, '');
  const m = base.match(MCMASTER_PN_RE);
  if (m) return { pn: m[1], source: 'filename', score: 2 };
  return null;
}

/**
 * Scan STEP custom properties for a McMaster PN.
 * Score: 3=mcmaster field, 2=supplier/part# field, 1=any value match
 */
function detectPnFromProperties(properties) {
  if (!Array.isArray(properties) || !properties.length) return null;

  const score = (name) => {
    const n = String(name || '').toLowerCase();
    if (n.includes('mcmaster')) return 3;
    if (n.includes('supplier') && (n.includes('part') || n.includes('pn') || n.includes('no'))) return 2;
    if (n.includes('part') && (n.includes('no') || n.includes('num') || n.includes('pn') || n.includes('number'))) return 2;
    if (n === 'pn' || n === 'p/n' || n === 'part no' || n === 'part number') return 2;
    return 1;
  };

  let best = null;
  for (const prop of properties) {
    const val = String(prop.value || '').trim();
    const m = val.match(MCMASTER_PN_RE);
    if (!m) continue;
    const s = score(prop.name);
    if (!best || s > best.score) {
      best = { pn: m[1], source: 'property', field: prop.name, score: s };
    }
  }
  return best;
}

/**
 * Main entry point. Returns the best {pn, source, field?, score} or null.
 * Priority: McMaster property field (3) > filename (2) > any property (1)
 */
export function detectMcMasterPN(filename, properties) {
  const fromProps = detectPnFromProperties(properties);
  if (fromProps && fromProps.score >= 3) return fromProps;
  const fromFile = detectPnFromFilename(filename);
  if (fromFile) return fromFile;
  if (fromProps) return fromProps;
  return null;
}

/**
 * Return the canonical McMaster product page URL for a given PN.
 */
export function mcMasterProductUrl(pn) {
  return 'https://www.mcmaster.com/' + encodeURIComponent(pn) + '/';
}

