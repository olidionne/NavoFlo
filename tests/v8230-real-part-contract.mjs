import fs from 'node:fs';
import assert from 'node:assert/strict';
import { analyzeAndUnfold } from '../public/js/sheetmetal-engine.js';
import { buildManufacturingKnowledge } from '../public/js/manufacturing-recognition-engine.js';
import { shouldUseFullClassificationDescriptors, choosePreservedGeometryHypothesis } from '../public/js/manufacturing-analysis-policy.js';
import { matchAiscProfileData } from '../public/js/profile-standard-matcher.js';

const fixture=name=>JSON.parse(fs.readFileSync(new URL(`./fixtures/v8230/${name}.json`,import.meta.url),'utf8'));
const aiscDb=JSON.parse(fs.readFileSync(new URL('../public/data/aisc-shapes-v16.json',import.meta.url),'utf8'));
aiscDb.index=Object.fromEntries(aiscDb.fields.map((f,i)=>[String(f),i]));
const unfold=(d,{fast=false}={})=>analyzeAndUnfold({
  geometry:d.geometry,faceInfo:d.faces,edgeInfo:fast?[]:d.edges,logicalGroups:d.logicalGroups,kResolver:()=>0.42
});

// Structural stock must remain recognizable even in the lightweight preflight,
// where exact edge descriptors are intentionally omitted.
for(const [name,expected] of [['u2x1','U2X1X3/16'],['angle','L2X2X1/4'],['w-beam','W6X20']]){
  const d=fixture(name),r=unfold(d,{fast:true});
  assert.equal(r.code,'structural-profile',`${name}: fast pass must veto sheet-metal bends`);
  assert.ok(r.profile?.traceCount>=4,`${name}: invariant-section longitudinal traces`);
  const match=matchAiscProfileData(r.profile,aiscDb);
  assert.equal(String(match?.imperialLabel||'').toUpperCase(),expected,`${name}: exact structural designation`);
  assert.ok(['high','probable'].includes(match?.level),`${name}: structural match confidence`);
}

// Real bent part: holes/split faces may not destroy the four-bend proof, and its
// native sheet concavity may not be promoted to milling pockets.
{
  const d=fixture('bent-503'),r=unfold(d);
  assert.equal(r.ok,true);assert.equal(r.bendCount,4);assert.ok(r.thickness>0);
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,sheetResult:r});
  assert.equal(m.stock?.stockType,'sheet-metal');
  assert.equal(m.processes?.milling,false,'press-brake concavity is not a pocket');
  assert.equal(m.featureInstances.some(f=>f.type==='pocket-floor'&&!f.parameters?.advisoryOnly),false);
}

// Real slit rolled plate proof survives the full exact pass.
{
  const d=fixture('rolled-st13'),r=unfold(d);
  assert.equal(r.code,'rolled-plate');assert.equal(r.rolledPlate,true);assert.ok(r.rolledPlateData?.confidence>0.9);
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,sheetResult:r});
  assert.equal(m.stock?.stockType,'rolled-plate');
}

// Real turned shaft: round raw stock + >80% common gp_Ax1 is authoritative.
{
  const d=fixture('turned-st01'),r=unfold(d),m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:d.faces,edgeInfo:d.edges,sheetResult:r});
  assert.equal(m.stock?.stockType,'round-bar');assert.equal(m.processes?.turning,true);assert.equal(m.machined,true);
  assert.ok(Number(m.diagnostics?.machiningEvidence?.turning?.collinearFraction)>0.80);
}

// Pucks must remain machined even if strict curved-edge concavity and explicit
// hole annotations are unavailable. Cylinder+cone axis morphology and central
// annular-groove topology are independent hard B-Rep proofs.
for(const name of ['puck-25','puck-26','puck-30']){
  const d=fixture(name),r=unfold(d);
  const weakEdges=d.edges.map(e=>({...e,transition:'unknown',strictConcave:false,strictConvex:false}));
  const weakFaces=d.faces.map(f=>({...f,hole:null,compoundHole:null,chamfer:null}));
  const m=buildManufacturingKnowledge({geometry:d.geometry,faceInfo:weakFaces,edgeInfo:weakEdges,sheetResult:r});
  assert.equal(m.stock?.stockType,'round-bar',`${name}: raw stock`);
  assert.equal(m.processes?.machining,true,`${name}: secondary machining`);
  assert.ok(m.featureInstances.some(f=>f.parameters?.axisPatternProven===true&&!f.parameters?.advisoryOnly),`${name}: axis morphology proof`);
}

// Normal-sized parts must use one full descriptor set; later generic failures may
// not erase a strong early roll/profile/bend proof.
{
  const d=fixture('w-beam');assert.equal(shouldUseFullClassificationDescriptors(d.geometry),true);
  const strong={ok:false,code:'rolled-plate'},weak={ok:false,code:'fixed-panel-missing'};
  assert.equal(choosePreservedGeometryHypothesis(strong,weak),strong);
}

console.log('V8.23.0 real STEP regression contract: PASS');
