import assert from 'node:assert/strict';
import { buildAttributedAdjacencyGraph } from '../public/js/manufacturing-recognition-engine.js';
import { analyzeMachiningEvidence, detectTurningByGpAx1, buildNegativeVolumeComponents } from '../public/js/manufacturing-machining-evidence.js';
import { arbitrateManufacturingKnowledge } from '../public/js/manufacturing-critical-arbitrator.js';

const edge=(id,a,b)=>({id,family:'line',ownerFaceIds:[a,b],length:10,transition:'concave',strictConcave:true});

// 1) Strict concave floor/wall AAG -> virtual negative volume + milled pocket.
{
  const faces=[
    {id:1,family:'plane',area:400,localCentroid:[0,0,2],localNormal:[0,0,1],neighborFaceIds:[2,3,4,5]},
    {id:2,family:'plane',area:100,localCentroid:[10,0,7],localNormal:[-1,0,0],neighborFaceIds:[1]},
    {id:3,family:'plane',area:100,localCentroid:[-10,0,7],localNormal:[1,0,0],neighborFaceIds:[1]},
    {id:4,family:'plane',area:100,localCentroid:[0,10,7],localNormal:[0,-1,0],neighborFaceIds:[1]},
    {id:5,family:'plane',area:100,localCentroid:[0,-10,7],localNormal:[0,1,0],neighborFaceIds:[1]}
  ];
  const edges=[edge(1,1,2),edge(2,1,3),edge(3,1,4),edge(4,1,5)];
  const aag=buildAttributedAdjacencyGraph(faces,edges),neg=buildNegativeVolumeComponents(aag,faces);
  assert.equal(neg.components.length,1);assert.equal(neg.strictConcaveEdgeCount,4);
  const ev=analyzeMachiningEvidence({aag,faceInfo:faces,geometry:{positions:new Float32Array([0,0,0,20,20,10])}});
  const pocket=ev.features.find(f=>f.type==='pocket-floor');
  assert.ok(pocket);assert.equal(pocket.parameters.concavityProven,true);assert.equal(pocket.parameters.negativeVolume,true);
}

// 2) Cylinder -> planar bottom strict concavity proves a blind drilling volume.
{
  const faces=[
    {id:10,family:'cylinder',area:200,localCenter:[0,0,5],localCentroid:[0,0,5],axisDirection:[0,0,1],radius:5,axisSpan:5,hole:{isThrough:false,depth:5},neighborFaceIds:[11]},
    {id:11,family:'plane',area:80,localCentroid:[0,0,2.5],localNormal:[0,0,1],neighborFaceIds:[10]}
  ];
  const aag=buildAttributedAdjacencyGraph(faces,[edge(10,10,11)]),ev=analyzeMachiningEvidence({aag,faceInfo:faces,geometry:{positions:new Float32Array([-5,-5,0,5,5,10])}});
  const blind=ev.features.find(f=>f.type==='blind-hole');assert.ok(blind);assert.equal(blind.parameters.concavityProven,true);
}

// 3) Coaxial stepped cylinders in one concave negative volume -> counterbore.
{
  const faces=[
    {id:20,family:'cylinder',area:150,localCenter:[0,0,6],localCentroid:[0,0,6],axisDirection:[0,0,1],radius:8,axisSpan:3,neighborFaceIds:[21]},
    {id:21,family:'plane',area:100,localCentroid:[0,0,5],localNormal:[0,0,1],neighborFaceIds:[20,22]},
    {id:22,family:'cylinder',area:120,localCenter:[0,0,3],localCentroid:[0,0,3],axisDirection:[0,0,1],radius:4,axisSpan:5,neighborFaceIds:[21]}
  ];
  const aag=buildAttributedAdjacencyGraph(faces,[edge(20,20,21),edge(21,21,22)]),ev=analyzeMachiningEvidence({aag,faceInfo:faces,geometry:{positions:new Float32Array([-8,-8,0,8,8,10])}});
  const cb=ev.features.find(f=>f.type==='counterbore');assert.ok(cb);assert.deepEqual(cb.parameters.radiiMm,[4,8]);
}

// 4) gp_Ax1 turning proof is STRICTLY >80%, not merely parallel axes.
{
  const faces=[];let id=1;
  for(let i=0;i<9;i++)faces.push({id:id++,family:i<7?'cylinder':'cone',axisDirection:[0,0,1],localCenter:[0,0,0],radius:5+i*.2,area:100});
  faces.push({id:id++,family:'cylinder',axisDirection:[0,0,1],localCenter:[20,0,0],radius:4,area:100});
  const yes=detectTurningByGpAx1(faces,50);assert.equal(yes.recognized,true);assert.equal(yes.collinearFraction,.9);
  faces[8].localCenter=[20,0,0]; // now 8/10 on the dominant gp_Ax1
  const no=detectTurningByGpAx1(faces,50);assert.equal(no.collinearFraction,.8);assert.equal(no.recognized,false);
}

// 5) Canonical arbitrator: no constant sheet thickness + strict concavity proof
// cannot terminate as Solid/unknown. It must become machining/turning/plate+machining.
{
  const base={stock:null,stockType:null,capabilities:{directFlatDxf:false,structuralProfile:false},processes:{cutting:false,machining:false},featureInstances:[
    {type:'pocket-floor',process:'milling',faceIds:[1,2,3],confidence:.97,parameters:{topologyProven:true,concavityProven:true,negativeVolume:true}}
  ],evidence:[],features:{},diagnostics:{},confidence:.9};
  const out=arbitrateManufacturingKnowledge(base,{sheetResult:null,machiningEvidence:{turning:{recognized:false}}});
  assert.equal(out.processes.machining,true);assert.equal(out.processes.milling,true);assert.equal(out.canonicalDecision,'machining');assert.equal(out.diagnostics.forcedByConcavity,true);
}

// 6) Structural-profile authority prevents raw-stock concave root fillets from
// globally converting an AISC section into a machined part.
{
  const base={stock:{stockType:'structural-profile'},stockType:'structural-profile',capabilities:{structuralProfile:true,directFlatDxf:false},processes:{profile:true,machining:false},featureInstances:[
    {type:'turning-axis-proof',process:'turning',faceIds:[1,2,3],confidence:.95,parameters:{topologyProven:true,gpAx1Proof:true,gpAx1CollinearFraction:.95}}
  ],evidence:[],features:{},diagnostics:{},confidence:.95};
  const out=arbitrateManufacturingKnowledge(base,{sheetResult:null,machiningEvidence:{turning:{recognized:true,collinearFraction:.95}}});
  assert.equal(out.canonicalDecision,'structural-profile');assert.equal(out.processes.machining,false);
}

// 7) Plate stock + strict concavity is explicitly Plate + machining even when a
// local-thickness sheet proof is unavailable.
{
  const base={stock:{stockType:'plate-blank'},stockType:'plate-blank',capabilities:{directFlatDxf:false,structuralProfile:false},processes:{cutting:true,machining:false},featureInstances:[
    {type:'pocket-floor',process:'milling',faceIds:[30,31,32],confidence:.98,parameters:{topologyProven:true,concavityProven:true,negativeVolume:true}}
  ],evidence:[],features:{},diagnostics:{},confidence:.94};
  const out=arbitrateManufacturingKnowledge(base,{sheetResult:null,machiningEvidence:{turning:{recognized:false}}});
  assert.equal(out.processes.machining,true);assert.equal(out.canonicalDecision,'plate-machining');
}

console.log('V8.22.0 strict-concavity machining AAG regression: PASS');
