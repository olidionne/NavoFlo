import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeAndUnfold } from '../public/js/sheetmetal-engine.js';
import { buildManufacturingKnowledge } from '../public/js/manufacturing-recognition-engine.js';
import { geometryHypothesisRank } from '../public/js/manufacturing-analysis-policy.js';

const fixture=name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/v8231/${name}.json`,import.meta.url),'utf8'));
const unfold=d=>analyzeAndUnfold({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,logicalGroups:d.logicalGroups,kResolver:()=>0.42});

// A fabricated U and a four-corner tray are not structural U shapes merely
// because their envelopes are compatible with a catalogue channel. The physical
// two-skin shell closure Rext-Rint=T on the same gp_Ax1 is authority.
for(const [name,bends] of [['bent-u',2],['bent-tray',4]]){
  const d=fixture(name),r=unfold(d);
  assert.equal(r.ok,true,`${name}: must unfold`);
  assert.equal(r.bendCount,bends,`${name}: bend count`);
  assert.equal(r.diagnostics?.pairedBendEvidence?.ok,true,`${name}: Rext-Rint=T shell proof`);
  assert.ok(Number(r.diagnostics?.pairedBendEvidence?.thickness)>0,`${name}: shell thickness`);
  // Deliberately pass the losing diagnostic profile hypothesis to ensure the MRE
  // itself cannot relabel a proven fabricated sheet shell as structural stock.
  const losingProfile=r.diagnostics?.structuralProfile||{kind:'u-profile',confidence:0.99};
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,sheetResult:r,structuralProfile:losingProfile});
  assert.equal(m.stock?.stockType,'sheet-metal',`${name}: MRE sheet authority`);
  assert.equal(m.classification,'sheet-metal',`${name}: final sheet classification`);
  assert.ok(geometryHypothesisRank(r)>100,`${name}: paired bend rank beats generic structural profile`);
}

// Stress the exact-concavity path: even if every two-face edge in these simple
// laser-cut plates were reported concave, the physical top/bottom support skins
// cannot become negative-volume floors and a full-thickness opening owns its
// perimeter. No pocket/cross-hole/groove machining may survive arbitration.
for(const name of ['laser-obround','laser-obround-0011','laser-obround-0012','laser-frame']){
  const d=fixture(name);
  d.edges=d.edges.map(e=>({...e,transition:(e.ownerFaceIds||[]).length===2?'concave':'unknown',strictConcave:(e.ownerFaceIds||[]).length===2,strictConvex:false}));
  const r=unfold(d);assert.equal(r.ok,true);assert.equal(r.flatPlate,true);
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,sheetResult:r});
  assert.equal(m.processes?.machining,false,`${name}: pure through-cut is not machining`);
  assert.equal(m.classification,'cuttable-plate',`${name}: laser plate`);
  assert.ok(m.featureInstances.some(f=>['through-slot','through-profile'].includes(f.type)),`${name}: through-cut instance`);
  assert.equal(m.featureInstances.some(f=>['cross-hole','pocket-floor','one-sided-recess','annular-groove','counterbore'].includes(f.type)&&!f.parameters?.advisoryOnly),false,`${name}: no surviving false machining fragment`);
  assert.ok(Number(m.diagnostics?.machiningEvidence?.negativeVolumes?.externalPlateSkinFaceCount)>=2,`${name}: both support skins protected`);
}


// Exact OCCT chamfer descriptors remain secondary machining on a formed sheet,
// while panel/bend faces themselves are excluded from chamfer promotion.
{
  const d=fixture('bent-u'),r=unfold(d);
  const forming=new Set([...(r.panelFaceIds||[]),...(r.bendLines||[]).flatMap(b=>b.sourceFaceIds||[])]);
  const target=d.faces.find(f=>String(f.family).toLowerCase()==='plane'&&!forming.has(Number(f.id)));
  assert.ok(target,'bent-u: non-forming planar face for chamfer regression');
  const faces=d.faces.map(f=>Number(f.id)===Number(target.id)?{...f,chamfer:{profile:'distance-angle',variant:'edge',distanceA:1,distanceB:1,supportAngle:0.785398}}:f);
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:faces,edgeInfo:d.edges,sheetResult:r,structuralProfile:r.diagnostics?.structuralProfile||null});
  assert.equal(m.stock?.stockType,'sheet-metal');
  assert.equal(m.processes?.machining,true,'exact chamfer survives on formed sheet');
  assert.ok(m.featureInstances.some(f=>f.type==='edge-chamfer'&&f.parameters?.exactChamfer===true&&!f.parameters?.advisoryOnly));
}

console.log('V8.23.1 sheet-shell / through-cut safety regression: PASS');
