import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rotationalMachiningSignature, requiresIndependentManufacturingReview, hasRoundStockMachiningAuthority } from '../public/js/manufacturing-hypothesis-gate.js';
import { buildManufacturingKnowledge } from '../public/js/manufacturing-recognition-engine.js';
import { aiscDesignationHint, matchAiscProfileWithNameData } from '../public/js/profile-standard-matcher.js';

// Real ST01-0002 analytic signature: many coaxial cylinders/cones/tori.  This
// is the exact failure family reported in production; it must force the full
// manufacturing hypothesis before a local sheet-bend result can win.
const axis=[0,1,0],center=[0,58.5,0];
const faces=[];let id=1;
for(const r of [8,7,12.7,7,8,6.35,6.35,6.35,8,7,12.7,7,8])faces.push({id:id++,family:'cylinder',axisDirection:axis,localCenter:center,radius:r,area:100});
for(let i=0;i<10;i++)faces.push({id:id++,family:'cone',axisDirection:axis,localCenter:center,area:20});
for(let i=0;i<4;i++)faces.push({id:id++,family:'torus',axisDirection:axis,localCenter:center,radius:7.8,area:15});
const sig=rotationalMachiningSignature(faces);assert.equal(sig.recognized,true);assert.ok(sig.dominantCount>=20);
const gate=requiresIndependentManufacturingReview({faceInfo:faces,sheetResult:{ok:true,bendCount:2}});assert.equal(gate.required,true);assert.equal(gate.reason,'coaxial-rotational-complexity');

assert.equal(aiscDesignationHint('ABC_AISC - L 4x4x1/2'),'L4X4X1/2');
assert.equal(aiscDesignationHint('ABC_AISC - W 36x170'),'W36X170');
const db=JSON.parse(fs.readFileSync(new URL('../public/data/aisc-shapes-v16.json',import.meta.url),'utf8')),idx=Object.fromEntries(db.fields.map((f,i)=>[f,i]));db.index=idx;
const lrow=db.rows.find(r=>r[idx.type]==='L'&&String(r[idx.imperial_edi]||'').includes('X'));
assert.ok(lrow);const lname=String(lrow[idx.imperial_edi]),lp={spanU:Number(lrow[idx.d]),spanV:Number(lrow[idx.b]),stockSectionArea:Number(lrow[idx.A]),averageSectionArea:Number(lrow[idx.A]),sectionAreaSampleCount:12,sectionHoleCount:0,sectionComponentCount:1,sectionStableFraction:1,sideAreaRatio:0.82,aspect:8,traceCount:7};
const lm=matchAiscProfileWithNameData(lp,`AISC - ${lname}`,db);assert.ok(lm);assert.equal(lm.type,'L');assert.ok(lm.confidence>=0.90);

// Independent stock authority must retain the original V8.20 round-stock logic.
// This compact proxy uses the measured envelope and analytic face families from
// the real ST01-0002 STEP: Ø25.4 x 127 mm, 13 cylinders, 10 cones, 4 tori.
const positions=[];
for(const y of [-63.5,63.5])for(let i=0;i<24;i++){const a=i/24*Math.PI*2;positions.push(Math.cos(a)*12.7,y,Math.sin(a)*12.7);}
const proxyGeometry={positions,indices:[],edges:[]};
const proxyFaces=[];id=1;
for(const r of [8,7,12.7,7,8,6.35,6.35,6.35,8,7,12.7,7,8])proxyFaces.push({id:id++,family:'cylinder',axisDirection:axis,localCenter:[0,0,0],radius:r,area:r===12.7?175:120,axisMin:-63.5,axisMax:63.5,axisSpan:127});
for(let i=0;i<10;i++)proxyFaces.push({id:id++,family:'cone',axisDirection:axis,localCenter:[0,0,0],area:25});
for(let i=0;i<4;i++)proxyFaces.push({id:id++,family:'torus',axisDirection:axis,localCenter:[0,0,0],radius:7.8,area:20});
for(let i=0;i<7;i++)proxyFaces.push({id:id++,family:'plane',localNormal:axis,localCentroid:[0,-50+i*16,0],area:80});
const k=buildManufacturingKnowledge({geometry:proxyGeometry,faceInfo:proxyFaces,edgeInfo:[],sheetResult:null,componentName:'ST01-0002_0.step'});
assert.equal(k.stock?.stockType,'round-bar');assert.equal(k.processes.turning,true);assert.equal(hasRoundStockMachiningAuthority(k),true);
console.log('V8.21.2 classification arbitration: PASS');
