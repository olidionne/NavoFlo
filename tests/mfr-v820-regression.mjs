import assert from 'node:assert/strict';
import { buildManufacturingKnowledge, applyManufacturingMlPrediction } from '../public/js/manufacturing-recognition-engine.js';
import { arbitrateManufacturingKnowledge } from '../public/js/manufacturing-critical-arbitrator.js';

const boxPositions=new Float32Array([
  0,0,0, 100,0,0, 100,50,0, 0,50,0,
  0,0,10,100,0,10,100,50,10,0,50,10
]);
const geometry={positions:boxPositions,indices:new Uint32Array(),edges:[]};
const skin=(id,z,area=4800)=>({id,family:'plane',area,localCentroid:[50,25,z],localCenter:[50,25,z],localNormal:[0,0,1],neighborFaceIds:[]});

function flatResult(){return{ok:true,flatPlate:true,cuttablePlate:true,bendCount:0,thickness:10,fixedFaceId:1};}
function link(faces,id,neighbors){faces.find(f=>f.id===id).neighborFaceIds=neighbors;}

// 1) An obround through cut is a CUTTING instance, not drilling + pocket.
{
  const faces=[skin(1,0),skin(2,10),
    {id:3,family:'cylinder',area:157,localCenter:[30,25,5],axisDirection:[0,0,1],radius:5,axisSpan:10,hole:{isThrough:true},neighborFaceIds:[]},
    {id:4,family:'cylinder',area:157,localCenter:[70,25,5],axisDirection:[0,0,1],radius:5,axisSpan:10,hole:{isThrough:true},neighborFaceIds:[]},
    {id:5,family:'plane',area:400,localCentroid:[50,20,5],localNormal:[0,1,0],neighborFaceIds:[]},
    {id:6,family:'plane',area:400,localCentroid:[50,30,5],localNormal:[0,1,0],neighborFaceIds:[]}
  ];
  for(const id of [3,4,5,6])link(faces,id,[1,2,...[3,4,5,6].filter(x=>x!==id)]);
  link(faces,1,[3,4,5,6]);link(faces,2,[3,4,5,6]);
  const k=buildManufacturingKnowledge({geometry,faceInfo:faces,edgeInfo:[],sheetResult:flatResult()});
  assert.equal(k.capabilities.directFlatDxf,true);
  assert.equal(k.processes.machining,false);
  assert.ok(k.featureInstances.some(f=>f.type==='through-slot'));
}

// 2) Torus + blind cylinder on a flat plate is definite secondary machining.
{
  const faces=[skin(1,0),skin(2,10),
    {id:3,family:'torus',area:120,localCenter:[50,25,8],axisDirection:[0,0,1],neighborFaceIds:[1,4]},
    {id:4,family:'cylinder',area:90,localCenter:[50,25,7],axisDirection:[0,0,1],radius:8,axisSpan:3,hole:{isThrough:false,depth:3},neighborFaceIds:[1,3]}
  ];link(faces,1,[3,4]);
  const k=buildManufacturingKnowledge({geometry,faceInfo:faces,edgeInfo:[],sheetResult:flatResult()});
  assert.equal(k.processes.machining,true);
  assert.ok(k.featureInstances.some(f=>f.type==='annular-groove'));
  assert.ok(k.featureInstances.some(f=>f.type==='blind-hole'));
}

// 3) Same-domain split of a skin is not a fake pocket.
{
  const a=skin(1,0,4800),b=skin(2,10,4800),split=skin(3,0,300);
  a.sameDomainFaceIds=[1,3];split.sameDomainFaceIds=[1,3];a.neighborFaceIds=[3];split.neighborFaceIds=[1];
  const k=buildManufacturingKnowledge({geometry,faceInfo:[a,b,split],edgeInfo:[],sheetResult:flatResult()});
  assert.equal(k.processes.machining,false);
  assert.ok(!k.featureInstances.some(f=>f.type==='pocket-floor'||f.type==='one-sided-recess'));
}

// 4) Critical ML second opinion can collapse weak obround fragments, but it may
// never erase a hard local counterbore/groove.
{
  const weak={stock:{stockType:'plate-blank'},stockType:'plate-blank',capabilities:{directFlatDxf:true},processes:{cutting:true,drilling:true,milling:true,machining:true},featureInstances:[
    {type:'cross-hole',process:'drilling',faceIds:[3],confidence:.90,parameters:{}},
    {type:'pocket-floor',process:'milling',faceIds:[5],confidence:.92,parameters:{}}
  ],evidence:['drilling','pocket'],features:{},diagnostics:{}};
  const ml={ok:true,engine:'AAGNet',features:[{name:'rectangular_through_slot',confidence:.96,faces:[1,2,3,4],faceIdDomain:'pythonocc-topology-order-advisory'}]};
  const fixed=arbitrateManufacturingKnowledge(weak,{sheetResult:flatResult(),mlPrediction:ml});
  assert.equal(fixed.processes.machining,false);
  assert.ok(fixed.featureInstances.some(f=>f.type==='through-slot'));

  const hard={...weak,featureInstances:[{type:'counterbore',process:'drilling',faceIds:[7],confidence:.99,parameters:{}}]};
  const preserved=arbitrateManufacturingKnowledge(hard,{sheetResult:flatResult(),mlPrediction:ml});
  assert.equal(preserved.processes.machining,true);
  assert.ok(preserved.featureInstances.some(f=>f.type==='counterbore'));
}

// 5) V8.21.1 safety policy: advisory ML can flag a possible blind hole, but cannot
// upgrade a clean plate to machining without exact OCCT/topology proof.
{
  const base={stock:{stockType:'plate-blank'},stockType:'plate-blank',capabilities:{directFlatDxf:true},processes:{cutting:true,machining:false},featureInstances:[],evidence:[],features:{},diagnostics:{needsMlReview:true},confidence:.9};
  const ml={ok:true,engine:'AAGNet',confidence:.94,features:[{name:'blind_hole',confidence:.94,faces:[2],faceIdDomain:'pythonocc-topology-order-advisory'}]};
  const enhanced=applyManufacturingMlPrediction(base,{sheetResult:flatResult(),mlPrediction:ml});
  assert.equal(enhanced.processes.machining,false);
  assert.equal(enhanced.processes.possibleMachining,true);
  assert.ok(enhanced.featureInstances.some(f=>f.type==='blind-hole'&&f.parameters?.advisoryOnly));
}

console.log('V8.20 manufacturing regression contract: PASS');
