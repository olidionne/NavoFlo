import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aiscDesignationHint, matchAiscProfileWithNameData } from '../public/js/profile-standard-matcher.js';
import { detectFastenerComponent } from '../public/js/fastener-recognition.js';
import { arbitrateManufacturingKnowledge } from '../public/js/manufacturing-critical-arbitrator.js';

const raw=JSON.parse(fs.readFileSync(new URL('../public/data/aisc-shapes-v16.json',import.meta.url),'utf8'));
const db={...raw,index:Object.fromEntries(raw.fields.map((f,i)=>[String(f),i]))};
const w36={spanU:919,spanV:305,length:6000,aspect:6000/919,sideAreaRatio:.93,stockSectionArea:32300,averageSectionArea:32000,sectionAreaSampleCount:11,sectionComponentCount:1,sectionHoleCount:0,sectionStableFraction:.91,sectionAreaSpread:.018,longitudinalPlaneCount:8,longitudinalCylinderCount:4,traceCount:14};
assert.equal(aiscDesignationHint('105101P02_AISC - W 36x170'),'W36X170');
const namedW=matchAiscProfileWithNameData(w36,'105101P02_AISC - W 36x170',db);
assert.equal(namedW?.imperialLabel,'W36X170');
assert.equal(namedW?.sourceKind,'assembly-name+geometry');
assert.ok(namedW?.confidence>=.93);

// A gusset can be a thin polygonal plate with a central hole. It must not be
// promoted to a hex nut by geometry alone.
const gussetPositions=[];
for(const z of [0,10])for(const [x,y] of [[0,0],[100,0],[120,40],[85,90],[20,80],[-15,35]])gussetPositions.push(x,y,z);
const gusset={name:'GUSSET 01',positions:new Float32Array(gussetPositions)};
const gussetFaces=[
  {id:1,family:'cylinder',axisDirection:[0,0,1],localCenter:[50,40,5],radius:8,axisSpan:10,hole:{isThrough:true},area:500},
  {id:2,family:'plane',localNormal:[1,0,0],area:800},{id:3,family:'plane',localNormal:[.5,.866,0],area:800},{id:4,family:'plane',localNormal:[-.5,.866,0],area:800},
  {id:5,family:'plane',localNormal:[0,0,1],area:7000},{id:6,family:'plane',localNormal:[0,0,-1],area:7000}
];
assert.equal(detectFastenerComponent({name:'GUSSET 01',geometry:gusset,faceInfo:gussetFaces}),null);

// Canonical compact hex body + centered axial hole still recognizes a nut.
const nutPositions=[];
for(const z of [-6,6])for(let i=0;i<6;i++){const a=Math.PI/3*i;nutPositions.push(Math.cos(a)*17.32,Math.sin(a)*17.32,z);}
const nut={name:'',positions:new Float32Array(nutPositions)};
const nutFaces=[{id:1,family:'cylinder',axisDirection:[0,0,1],localCenter:[0,0,0],radius:6,axisSpan:12,hole:{isThrough:true},area:450}];
for(let i=0;i<6;i++){const a=Math.PI/3*i;nutFaces.push({id:10+i,family:'plane',localNormal:[Math.cos(a),Math.sin(a),0],area:250});}
nutFaces.push({id:20,family:'plane',localNormal:[0,0,1],area:700},{id:21,family:'plane',localNormal:[0,0,-1],area:700});
assert.equal(detectFastenerComponent({geometry:nut,faceInfo:nutFaces})?.type,'nut');

const flat={ok:true,flatPlate:true,bendCount:0,thickness:6};
const base={stock:{stockType:'plate-blank'},stockType:'plate-blank',capabilities:{directFlatDxf:true},processes:{cutting:true,machining:false},featureInstances:[],evidence:[],features:{},diagnostics:{},confidence:.9};
// Advisory ML alone can no longer turn a clean plate into "machining".
const ml={ok:true,engine:'AAGNet',features:[{name:'blind_hole',confidence:.98,faces:[2],faceIdDomain:'pythonocc-topology-order-advisory'}]};
const advisory=arbitrateManufacturingKnowledge(base,{sheetResult:flat,mlPrediction:ml});
assert.equal(advisory.processes.machining,false);
assert.equal(advisory.processes.possibleMachining,true);
// Exact one-skin pocket topology remains authoritative.
const exact={...base,featureInstances:[{type:'pocket-floor',process:'milling',faceIds:[7],confidence:.965,parameters:{topologyProven:true,oneSkinContact:true}}]};
const proven=arbitrateManufacturingKnowledge(exact,{sheetResult:flat});
assert.equal(proven.processes.machining,true);

const viewer=fs.readFileSync(new URL('../public/js/viewer.js',import.meta.url),'utf8');
assert.match(viewer,/groupDuplicates:false/); // group members rendered once, no recursive folder chain
assert.match(viewer,/assemblyHighlightedMeshes/); // O(selected) cleanup instead of O(assembly)
assert.match(viewer,/return faceCandidate\?\.selection \|\| null/); // blank Auto click is truly blank

console.log('V8.21.1 stability/safety regression: PASS');
