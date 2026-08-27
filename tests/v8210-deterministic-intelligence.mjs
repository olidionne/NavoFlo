import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fastenerNameHint } from '../public/js/fastener-recognition.js';
import { buildManufacturingKnowledge } from '../public/js/manufacturing-recognition-engine.js';
import { matchAiscProfileData } from '../public/js/profile-standard-matcher.js';

assert.equal(fastenerNameHint('A325 BOLT 3/4')?.type,'bolt');
assert.equal(fastenerNameHint('Rondelle F436')?.type,'washer');
assert.equal(fastenerNameHint('Écrou A563')?.type,'nut');

const simpleGeom={name:'A325 BOLT',positions:new Float32Array([0,0,0,10,0,0,0,10,0,0,0,50]),indices:new Uint32Array(),edges:[]};
const hardware=buildManufacturingKnowledge({geometry:simpleGeom,faceInfo:[],edgeInfo:[],componentName:'A325 BOLT'});
assert.equal(hardware.stockType,'fastener');
assert.equal(hardware.fastenerType,'bolt');
assert.equal(hardware.machined,false);
assert.equal(hardware.capabilities.export2dDxf,false);

const raw=JSON.parse(fs.readFileSync(new URL('../public/data/aisc-shapes-v16.json',import.meta.url),'utf8'));
const db={...raw,index:Object.fromEntries(raw.fields.map((f,i)=>[String(f),i]))};
const profile={
  spanU:919,spanV:305,length:6000,aspect:6000/919,sideAreaRatio:.93,
  stockSectionArea:32300,averageSectionArea:32000,sectionAreaSampleCount:11,
  sectionComponentCount:1,sectionHoleCount:0,sectionStableFraction:.91,sectionAreaSpread:.018,
  longitudinalPlaneCount:8,longitudinalCylinderCount:4,traceCount:14
};
const match=matchAiscProfileData(profile,db);
assert.ok(match,'W36x170 should match AISC database');
assert.equal(match.imperialLabel,'W36X170');
assert.ok(['high','probable'].includes(match.level));
assert.ok(match.confidence>.75);

console.log('V8.21.0 deterministic intelligence regression: PASS', {profile:match.imperialLabel,level:match.level,confidence:match.confidence});
