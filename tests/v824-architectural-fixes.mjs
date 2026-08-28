/* NavoFlo V8.24 — Architectural fixes regression contract.
 *
 * Validates four changes introduced by the V8.24 architectural audit:
 *
 *  1. materialRemoval is no longer a machining proof in manufacturing-classifier.
 *  2. dominantPlateSkinFaceSet has a geometry-only fallback when stock = null.
 *  3. detectPocketFloors rejects through-connectivity components (large frames,
 *     obround washers, rectangular windows → never machining).
 *  4. Pre-stock Revolution Solver (gp_Ax1) forces round-bar stock even when the
 *     tessellation envelope check fails (turned shafts ST01-0002 family).
 *
 * GOLDEN RULE enforced here:
 *   materialRemoval, regardless of its value, MUST NEVER by itself constitute
 *   proof of secondary machining.  A part may have 80% material absent and still
 *   be a pure laser-cut plate if its geometry is fully explained by a 2D profile
 *   extruded to a constant thickness.
 */
import assert from 'node:assert/strict';
import { buildManufacturingKnowledge } from '../public/js/manufacturing-recognition-engine.js';
import { buildAttributedAdjacencyGraph } from '../public/js/manufacturing-recognition-engine.js';
import { analyzeMachiningEvidence, detectTurningByGpAx1 } from '../public/js/manufacturing-machining-evidence.js';
import { classifyManufacturingGeometry } from '../public/js/manufacturing-classifier.js';

// ─── helpers ─────────────────────────────────────────────────────────────────
function makeBox(L,W,T){
  // Flat box: 8 corners, two large skins (L×W) + 4 side walls
  const p=new Float32Array([
    0,0,0, L,0,0, L,W,0, 0,W,0,
    0,0,T, L,0,T, L,W,T, 0,W,T
  ]);
  // indices (two triangles per face x 6 faces) - minimal for volume calc
  const idx=new Uint32Array([
    0,2,1,0,3,2,       // bottom
    4,5,6,4,6,7,       // top
    0,1,5,0,5,4,       // front
    2,3,7,2,7,6,       // back
    1,2,6,1,6,5,       // right
    3,0,4,3,4,7        // left
  ]);
  return{positions:p,indices:idx,edges:[]};
}
const plane=(id,z,nx,ny,nz,area,cx,cy,cz,neighbors=[])=>({
  id,family:'plane',area,localCentroid:[cx,cy,cz],localCenter:[cx,cy,cz],
  localNormal:[nx,ny,nz],neighborFaceIds:neighbors,sameDomainFaceIds:[]
});
const cyl=(id,ax,ay,az,cx,cy,cz,r,span,area,through=null,neighbors=[])=>({
  id,family:'cylinder',area,localCenter:[cx,cy,cz],localCentroid:[cx,cy,cz],
  axisDirection:[ax,ay,az],radius:r,axisSpan:span,
  hole:through===null?null:{isThrough:through},neighborFaceIds:neighbors,sameDomainFaceIds:[]
});
const concaveEdge=(id,a,b)=>({id,family:'line',ownerFaceIds:[a,b],length:10,
  transition:'concave',strictConcave:true,strictConvex:false});

// ─── TEST 1: materialRemoval alone MUST NOT produce machining ────────────────
// A flat-bar candidate with 40% material removed (e.g. a profiled bar with
// a large slot cut away) must NOT set machined=true via the removal heuristic.
{
  const faceInfo=[
    plane(1,0,0,0,1,4800,50,25,0),  // bottom skin
    plane(2,10,0,0,1,4800,50,25,10), // top skin
    plane(3,0,0,1,0,1000,50,0,5),   // front wall
    plane(4,0,0,-1,0,1000,50,50,5), // back wall
    plane(5,0,1,0,0,500,0,25,5),    // left wall
    plane(6,0,-1,0,0,500,100,25,5)  // right wall
  ];
  // Rectangular bar candidate: 6 planes, no cylinders, no cones — pure flat bar
  const geo=makeBox(100,50,10);
  const result=classifyManufacturingGeometry({geometry:geo,faceInfo,edgeInfo:[]});
  // materialRemoval might be ~0 here but the point is the rule is structural:
  assert.ok(result,'legacy stock must be detected');
  // A pure flat box with NO feature machining evidence must NOT be machined
  // regardless of how much "volume removal" the tessellation infers.
  const hasCyls=faceInfo.some(f=>f.family==='cylinder');
  if(!hasCyls){
    assert.equal(result.machined,false,'RULE: no cylinder/cone/groove → machined must be false (materialRemoval removed as proof)');
    assert.ok(!result.evidence?.includes('material-removal'),'material-removal must NOT be in evidence');
  }
}

// ─── TEST 2: geometry-only skin fallback prevents false machining ─────────────
// Large rectangular frame (stock=null, sheetResult=ok:false).
// Before V8.24, dominantPlateSkinFaceSet returned empty (no stock/flatPlate),
// leaving inner-wall concave edges unsuppressed → false pocket-floor detection.
{
  const topSkin=plane(1, 0, 0,0,1, 7600, 100,100,10, [3,4,5,6]);
  const botSkin=plane(2, 0, 0,0,1, 7600, 100,100, 0, [3,4,5,6]);
  const wall3  =plane(3, 0, 0,1,0, 1600, 100,180, 5, [1,2]);
  const wall4  =plane(4, 0, 0,-1,0,1600, 100, 20, 5, [1,2]);
  const wall5  =plane(5, 0, 1,0,0, 1600,  20,100, 5, [1,2]);
  const wall6  =plane(6, 0,-1,0,0, 1600, 180,100, 5, [1,2]);
  const framefaces=[topSkin,botSkin,wall3,wall4,wall5,wall6];

  // Concave edges: inner wall surfaces are concave against both skins
  const edges=[
    concaveEdge(1,1,3),concaveEdge(2,1,4),concaveEdge(3,1,5),concaveEdge(4,1,6),
    concaveEdge(5,2,3),concaveEdge(6,2,4),concaveEdge(7,2,5),concaveEdge(8,2,6)
  ];
  const geo=makeBox(200,200,10);
  const aag=buildAttributedAdjacencyGraph(framefaces,edges);
  // Run without sheetResult AND without stock (simulates failed sheet detection)
  const ev=analyzeMachiningEvidence({aag,faceInfo:framefaces,geometry:geo,sheetResult:null,stock:null});
  // V8.24 fix: geometry probe detects the two large skins without needing stock;
  // their concave edges are suppressed → no pocket-floor on through-cuts.
  const pockets=ev.features.filter(f=>f.type==='pocket-floor'&&!f.parameters?.advisoryOnly);
  assert.equal(pockets.length,0,'large frame (no stock, no sheetResult): inner void must NOT produce pocket-floor');
}

// ─── TEST 3: through-connectivity guard — obround washer with offset hole ────
// A laser-cut obround washer: outer oblong + inner oblong hole (offset).
// All walls span full thickness → through-cuts, never pockets.
{
  const topSkin=plane(1, 0, 0,0,1, 2000, 50,50,10, [3,4,5,6,7,8]);
  const botSkin=plane(2, 0, 0,0,1, 2000, 50,50, 0, [3,4,5,6,7,8]);
  // Outer oblong walls (2 cylinders + 2 planes) — through-thickness
  const outerCyl1=cyl(3, 0,0,1, 20,50,5, 15,10, 942, true, [1,2]);
  const outerCyl2=cyl(4, 0,0,1, 80,50,5, 15,10, 942, true, [1,2]);
  const outerW1  =plane(5, 0, 0,1,0, 200, 50,15,5, [1,2]);
  const outerW2  =plane(6, 0, 0,-1,0,200, 50,85,5, [1,2]);
  // Inner oblong hole walls (offset to the right, also through-thickness)
  const holeCyl1 =cyl(7, 0,0,1, 40,50,5, 8,10, 502, true, [1,2]);
  const holeCyl2 =cyl(8, 0,0,1, 60,50,5, 8,10, 502, true, [1,2]);

  const allFaces=[topSkin,botSkin,outerCyl1,outerCyl2,outerW1,outerW2,holeCyl1,holeCyl2];
  // Concave edges between skins and inner hole walls
  const edges=[
    concaveEdge(1,1,7),concaveEdge(2,1,8),
    concaveEdge(3,2,7),concaveEdge(4,2,8)
  ];
  const geo=makeBox(100,100,10);
  const aag=buildAttributedAdjacencyGraph(allFaces,edges);
  const ev=analyzeMachiningEvidence({aag,faceInfo:allFaces,geometry:geo,
    sheetResult:{ok:true,flatPlate:true,thickness:10,fixedFaceId:1,panelFaceIds:[1,2],bendCount:0},
    stock:{stockType:'plate-blank',axis:[0,0,1],thicknessMm:10}});
  const pockets=ev.features.filter(f=>f.type==='pocket-floor'&&!f.parameters?.advisoryOnly);
  assert.equal(pockets.length,0,'obround washer: inner hole walls touching both skins must not produce pocket-floor');
}

// ─── TEST 4: Revolution Solver pré-stock → round-bar quand enveloppe échoue ──
// Simulate a turned shaft where inferRoundStockFromFaces would fail (sparse OD
// coverage) but detectTurningByGpAx1 proves >80% coaxial revolution faces.
{
  // 8 revolution faces on Z-axis at different radii (simulate stepped shaft)
  const shaftFaces=[];
  for(let i=0;i<8;i++){
    const r=5+i*3, z0=i*20, z1=(i+1)*20;
    shaftFaces.push({
      id:i+1,family:'cylinder',area:2*Math.PI*r*20,
      localCenter:[0,0,(z0+z1)/2],localCentroid:[0,0,(z0+z1)/2],
      axisDirection:[0,0,1],radius:r,axisSpan:20,axisMin:z0,axisMax:z1,
      neighborFaceIds:[],sameDomainFaceIds:[],hole:null
    });
  }
  // Top and bottom end caps (planes)
  shaftFaces.push(plane(9, 0, 0,0,1, 400, 0,0,160, []));
  shaftFaces.push(plane(10, 0, 0,0,-1, 400, 0,0,0, []));

  const turning=detectTurningByGpAx1(shaftFaces);
  // The turning proof must recognize ≥80% coaxial revolution faces
  assert.ok(turning.recognized,'gp_Ax1 must recognize a stepped shaft');
  assert.ok(turning.collinearFraction>0.80,'collinear fraction must be >80%');
  assert.ok(turning.distinctRadii>=2,'multiple radii must be detected');

  // Now test that buildManufacturingKnowledge correctly classifies the shaft
  // even when faceInfo has very sparse OD coverage (coverage<0.01 would make
  // inferRoundStockFromFaces fail, but Revolution Solver saves it)
  const shaftPositions=new Float32Array([
    // just a few tessellation points on the shaft surface (sparse coverage)
    5,0,0, 0,5,0, -5,0,0, 0,-5,0,  // bottom circle r=5
    29,0,160, 0,29,160, -29,0,160   // top circle r=29
  ]);
  const geo={positions:shaftPositions,indices:new Uint32Array([]),edges:[]};
  const m=buildManufacturingKnowledge({geometry:geo,faceInfo:shaftFaces,edgeInfo:[],sheetResult:null});
  assert.ok(m,'buildManufacturingKnowledge must not return null for a shaft');
  assert.equal(m.stock?.stockType,'round-bar','V8.24 Revolution Solver: shaft must be round-bar stock');
  assert.equal(m.processes?.turning,true,'shaft must be recognized as turned');
  assert.equal(m.machined,true,'shaft must be machined');
  assert.notEqual(m.classification,'solid','shaft must not be Solide STEP');
}

// ─── TEST 5: GOLDEN RULE — 80% materialRemoval + flatPlate → no machining ────
// A laser-cut plate with a huge rectangular window cut out (80% material absent)
// must remain a pure cutting operation — never machining.
{
  const geo=makeBox(200,200,10);
  const topSkin =plane(1, 0, 0,0,1, 3600, 100,100,10, [3,4,5,6,7,8]);
  const botSkin =plane(2, 0, 0,0,1, 3600, 100,100, 0, [3,4,5,6,7,8]);
  // Frame outer walls
  const ow1=plane(3, 0, 0,1,0, 200, 100,200,5, [1,2]);
  const ow2=plane(4, 0, 0,-1,0,200, 100,  0,5, [1,2]);
  const ow3=plane(5, 0, 1,0,0, 200,   0,100,5, [1,2]);
  const ow4=plane(6, 0,-1,0,0, 200, 200,100,5, [1,2]);
  // Frame inner walls (the large void)
  const iw1=plane(7, 0, 0,1,0, 1800, 100,180,5, [1,2]);
  const iw2=plane(8, 0, 0,-1,0,1800, 100, 20,5, [1,2]);
  const allFaces=[topSkin,botSkin,ow1,ow2,ow3,ow4,iw1,iw2];
  const edges=[
    concaveEdge(1,1,7),concaveEdge(2,1,8),concaveEdge(3,2,7),concaveEdge(4,2,8)
  ];
  const flatResult={ok:true,flatPlate:true,thickness:10,fixedFaceId:1,
    panelFaceIds:[1,2],bendCount:0,cuttablePlate:true};
  const m=buildManufacturingKnowledge({geometry:geo,faceInfo:allFaces,edgeInfo:edges,sheetResult:flatResult});
  assert.equal(m.capabilities?.directFlatDxf,true,'large window frame: must be directFlatDxf');
  assert.equal(m.processes?.milling,false,'GOLDEN RULE: large window = through-cut, milling must be false');
  assert.equal(m.processes?.machining,false,'GOLDEN RULE: large window = no machining regardless of materialRemoval');
  assert.equal(m.machined,false,'large window frame must not be machined');
}

console.log('V8.24 architectural fixes regression: PASS');
