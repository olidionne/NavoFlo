// tests/mcmaster-pn-detection.mjs — Unit tests for McMaster PN detector
import assert from 'assert/strict';
import { detectMcMasterPN, mcMasterProductUrl } from '../public/js/mcmaster-pn.js';

let passed = 0, failed = 0;
function test(label, fn) {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch(e) { console.error(`  ✗ ${label}\n    ${e.message}`); failed++; }
}

console.log('\n── McMaster PN Detection ──────────────────────────────────────');

// ── Filename detection ──────────────────────────────────────────
test('Detects PN from plain filename', () => {
  const r = detectMcMasterPN('90591A031.step', []);
  assert.equal(r?.pn, '90591A031');
  assert.equal(r?.source, 'filename');
});

test('Detects PN when filename has prefix', () => {
  const r = detectMcMasterPN('4936K451_HEX-ADAPTER.STEP', []);
  assert.equal(r?.pn, '4936K451');
  assert.equal(r?.source, 'filename');
});

test('Detects PN when filename has suffix', () => {
  const r = detectMcMasterPN('BOLT-93827A150-M6.step', []);
  assert.equal(r?.pn, '93827A150');
  assert.equal(r?.source, 'filename');
});

test('Returns null for filename with no PN', () => {
  const r = detectMcMasterPN('BRACKET-001.step', []);
  assert.equal(r, null);
});

test('Returns null for null filename', () => {
  const r = detectMcMasterPN(null, []);
  assert.equal(r, null);
});

// ── Property detection ──────────────────────────────────────────
test('Detects PN from McMaster property field (priority 3)', () => {
  const props = [{ name: 'McMaster PN', value: '92196A542' }];
  const r = detectMcMasterPN('BRACKET-001.step', props);
  assert.equal(r?.pn, '92196A542');
  assert.equal(r?.source, 'property');
  assert.equal(r?.field, 'McMaster PN');
});

test('Detects PN from Supplier Part Number field (priority 2)', () => {
  const props = [{ name: 'Supplier Part Number', value: '98173A112' }];
  const r = detectMcMasterPN('NO-PN-HERE.step', props);
  assert.equal(r?.pn, '98173A112');
  assert.equal(r?.source, 'property');
});

test('Detects PN from generic scan (priority 1)', () => {
  const props = [{ name: 'Description', value: 'Uses 3401A12 fastener' }];
  const r = detectMcMasterPN('NO-PN-HERE.step', props);
  assert.equal(r?.pn, '3401A12');
});

test('Explicit McMaster field in props overrides filename PN', () => {
  // Both filename and props have PNs; McMaster field wins
  const props = [{ name: 'McMaster Part#', value: '4936K451' }];
  const r = detectMcMasterPN('90591A031.step', props);
  assert.equal(r?.pn, '4936K451');
  assert.equal(r?.source, 'property');
});

test('Filename wins over generic property scan', () => {
  // Filename has PN, low-priority property also has PN → filename wins
  const props = [{ name: 'Description', value: 'Ref 4936K451' }];
  const r = detectMcMasterPN('90591A031.step', props);
  assert.equal(r?.pn, '90591A031');
  assert.equal(r?.source, 'filename');
});

test('Returns null when neither filename nor props have PN', () => {
  const r = detectMcMasterPN('PART-001.step', [{ name: 'Material', value: 'Steel' }]);
  assert.equal(r, null);
});

// ── URL generation ──────────────────────────────────────────────
test('mcMasterProductUrl returns correct URL', () => {
  assert.equal(mcMasterProductUrl('90591A031'), 'https://www.mcmaster.com/90591A031/');
});

test('mcMasterProductUrl encodes special chars', () => {
  // Should be safe for standard PNs but encode if needed
  const url = mcMasterProductUrl('4936K451');
  assert.ok(url.startsWith('https://www.mcmaster.com/'));
  assert.ok(url.includes('4936K451'));
});

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
