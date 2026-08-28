/* NavoFlo V8.23.0 — deterministic machining evidence from the exact AAG.
 *
 * This module does NOT guess a process from a surface family. It consumes
 * exact B-Rep adjacency plus the worker's strict transition classification and
 * builds virtual negative-volume components from STRICTLY CONCAVE edges.
 *
 * Manufacturing rules implemented here:
 *   - blind drilling / counterbores / countersinks from concave cylinder ->
 *     plane/cone transitions and coaxial stepped cylinders;
 *   - milled pockets from a planar floor surrounded by concave wall edges;
 *   - grooves from a recessed revolution face bounded by concave shoulders;
 *   - turning authority when >80% of revolution faces share one gp_Ax1 line.
 */

const EPS=1e-9;
const REV_FAMILIES=new Set(['cylinder','cylindrical','cone','conical','torus','toroidal']);
const CYL_FAMILIES=new Set(['cylinder','cylindrical']);
const CONE_FAMILIES=new Set(['cone','conical']);
const TORUS_FAMILIES=new Set(['torus','toroidal']);
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const fam=v=>String(v||'').toLowerCase();
const vec=v=>Array.isArray(v)&&v.length>=3?v.slice(0,3).map(Number):null;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const len=a=>Math.hypot(a[0],a[1],a[2]);
function unit(a){const l=len(a||[]);return l>EPS?scale(a,1/l):null;}
function canonicalAxis(v){let n=unit(vec(v));if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=scale(n,-1);return n;}
function lineDistance(centerA,axis,centerB){const d=sub(centerB,centerA),p=scale(axis,dot(d,axis));return len(sub(d,p));}
function sameAxisLine(a,b,tol){return Boolean(a?.axis&&b?.axis&&a?.center&&b?.center&&Math.abs(dot(a.axis,b.axis))>=0.999&&lineDistance(a.center,a.axis,b.center)<=tol);}
function feature(type,process,faceIds,confidence,parameters={}){return{type,process,faceIds:[...new Set((faceIds||[]).map(Number).filter(Number.isFinite))],confidence:clamp(confidence),parameters};}
function edgeIsStrictConcave(e){return e?.strictConcave===true||String(e?.transition||'').toLowerCase()==='concave';}
function faceCenter(f){return vec(f?.localCentroid)||vec(f?.localCenter);}
function axisRecord(f){const axis=canonicalAxis(f?.axisDirection),center=vec(f?.localCenter);return axis&&center&&center.every(Number.isFinite)?{id:Number(f.id),face:f,family:fam(f.family),axis,center,radius:Number(f.radius),area:Number(f.area)||0}:null;}
function uniqueRadii(records,scaleMm){const tol=Math.max(scaleMm*0.002,0.03),out=[];for(const r of records.map(x=>x.radius).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b)){if(!out.length||Math.abs(out.at(-1)-r)>tol)out.push(r);}return out;}

function sheetNativeFaceSet(sheetResult){
  const ids=new Set();
  for(const id of sheetResult?.panelFaceIds||[])ids.add(Number(id));
  for(const bend of sheetResult?.bendLines||[])for(const id of bend?.sourceFaceIds||[])ids.add(Number(id));
  for(const selection of sheetResult?.selectionFaces||[])if(selection?.kind==='panel'||selection?.kind==='bend')for(const id of selection?.sourceFaceIds||[])ids.add(Number(id));
  return ids;
}
function edgeIsSuppressedSheetTransition(edge,sheetNativeFaceIds){
  if(!sheetNativeFaceIds?.size)return false;
  const owners=(edge?.owners||[]).map(Number).filter(Number.isFinite);
  return owners.length===2&&owners.every(id=>sheetNativeFaceIds.has(id));
}
function machiningConcaveEdge(edge,sheetNativeFaceIds){return edgeIsStrictConcave(edge)&&!edgeIsSuppressedSheetTransition(edge,sheetNativeFaceIds);}

export function buildNegativeVolumeComponents(aag,faceInfo=[],{sheetNativeFaceIds=null}={}){
  const faceById=new Map((faceInfo||[]).map(f=>[Number(f.id),f]));
  const concaveArcs=(aag?.arcs||[]).filter(e=>machiningConcaveEdge(e,sheetNativeFaceIds)).filter(e=>(e.owners||[]).length===2);
  const graph=new Map();
  for(const e of concaveArcs){
    const [a,b]=e.owners.map(Number);if(!graph.has(a))graph.set(a,[]);if(!graph.has(b))graph.set(b,[]);graph.get(a).push({faceId:b,edge:e});graph.get(b).push({faceId:a,edge:e});
  }
  const seen=new Set(),components=[];let nextId=1;
  for(const seed of graph.keys()){
    if(seen.has(seed))continue;const queue=[seed],faceIds=[],edgeIds=new Set(),edges=[];seen.add(seed);
    while(queue.length){const id=queue.shift();faceIds.push(id);for(const link of graph.get(id)||[]){edgeIds.add(Number(link.edge.id));edges.push(link.edge);if(!seen.has(link.faceId)){seen.add(link.faceId);queue.push(link.faceId);}}}
    const uniqEdges=[...new Map(edges.map(e=>[Number(e.id),e])).values()];
    const faces=faceIds.map(id=>faceById.get(id)).filter(Boolean),families=faces.map(f=>fam(f.family));
    components.push({id:`neg-${nextId++}`,faceIds:[...new Set(faceIds)],edgeIds:[...edgeIds],edges:uniqEdges,faces,families,strictConcaveEdgeCount:uniqEdges.length,totalFaceAreaMm2:faces.reduce((s,f)=>s+(Number(f.area)||0),0)});
  }
  return{components,concaveArcs,strictConcaveEdgeCount:concaveArcs.length};
}

function incidentConcaveEdges(aag,faceId,sheetNativeFaceIds=null){return(aag?.arcs||[]).filter(e=>machiningConcaveEdge(e,sheetNativeFaceIds)&&(e.owners||[]).map(Number).includes(Number(faceId)));}
function otherOwner(edge,faceId){return(edge?.owners||[]).map(Number).find(id=>id!==Number(faceId));}
function planeNormal(face){return fam(face?.family)==='plane'?canonicalAxis(face?.localNormal):null;}
function wallPerpendicularToFloor(wall,floor){const fn=planeNormal(floor);if(!fn)return false;const wf=fam(wall?.family);if(wf==='plane'){const wn=planeNormal(wall);return Boolean(wn&&Math.abs(dot(fn,wn))<=0.20);}if(CYL_FAMILIES.has(wf)||CONE_FAMILIES.has(wf)||TORUS_FAMILIES.has(wf))return true;return false;}

function detectPocketFloors(aag,faceInfo,negativeVolumes,sheetNativeFaceIds=null,allowedFloorNormals=null){
  const faceById=new Map((faceInfo||[]).map(f=>[Number(f.id),f])),out=[];
  for(const floor of faceInfo||[]){
    if(fam(floor.family)!=='plane')continue;const fn=planeNormal(floor);if(!fn)continue;
    // On a proven bent sheet, a milling-pocket floor must be parallel to one of
    // the actual panel skins. Perimeter/thickness walls can form perfectly
    // concave planar corners but are not pocket floors (503-00-01 regression).
    if(Array.isArray(allowedFloorNormals)&&allowedFloorNormals.length&&!allowedFloorNormals.some(n=>Math.abs(dot(fn,n))>=0.985))continue;
    const edges=incidentConcaveEdges(aag,Number(floor.id),sheetNativeFaceIds);if(edges.length<2)continue;
    const wallIds=[...new Set(edges.map(e=>otherOwner(e,floor.id)).filter(Number.isFinite))],walls=wallIds.map(id=>faceById.get(id)).filter(Boolean).filter(w=>wallPerpendicularToFloor(w,floor));
    if(walls.length<2)continue;
    // A valid pocket floor is bounded by at least two independent concave wall
    // transitions. Three/four walls increase confidence, but slots with two
    // straight walls + curved ends remain valid.
    const volume=negativeVolumes.components.find(v=>v.faceIds.includes(Number(floor.id)))||null;
    const confidence=clamp(0.91+Math.min(walls.length,4)*0.018+Math.min(edges.length,5)*0.008);
    out.push(feature('pocket-floor','milling',[Number(floor.id),...walls.map(w=>Number(w.id))],confidence,{topologyProven:true,concavityProven:true,negativeVolume:true,negativeVolumeId:volume?.id||null,strictConcaveEdgeIds:edges.map(e=>Number(e.id)),wallFaceIds:walls.map(w=>Number(w.id)),enclosedWallCount:walls.length}));
  }
  return out;
}

function detectBlindAndCompoundDrilling(aag,faceInfo,negativeVolumes,scaleMm=100,sheetNativeFaceIds=null){
  const byId=new Map((faceInfo||[]).map(f=>[Number(f.id),f])),out=[],axisTol=Math.max(scaleMm*0.003,0.05);
  const cylinders=(faceInfo||[]).map(axisRecord).filter(Boolean).filter(r=>CYL_FAMILIES.has(r.family));
  for(const c of cylinders){
    const edges=incidentConcaveEdges(aag,c.id,sheetNativeFaceIds),neighbors=edges.map(e=>({edge:e,id:otherOwner(e,c.id),face:byId.get(otherOwner(e,c.id))})).filter(x=>x.face);
    const planeNeighbors=neighbors.filter(x=>fam(x.face.family)==='plane'),coneNeighbors=neighbors.filter(x=>CONE_FAMILIES.has(fam(x.face.family)));
    const volume=negativeVolumes.components.find(v=>v.faceIds.includes(c.id))||null;
    if(c.face?.compoundHole){
      const family=fam(c.face.compoundHole.family),type=family==='countersink'?'countersink':'counterbore';
      out.push(feature(type,'drilling',[c.id,...neighbors.map(n=>n.id)],0.997,{exactCompoundHole:true,topologyProven:true,concavityProven:edges.length>0,negativeVolume:edges.length>0,negativeVolumeId:volume?.id||null,strictConcaveEdgeIds:edges.map(e=>Number(e.id))}));continue;
    }
    if(c.face?.hole?.isThrough===false&&planeNeighbors.length){
      out.push(feature('blind-hole','drilling',[c.id,...planeNeighbors.map(n=>n.id)],0.995,{exactHole:true,through:false,topologyProven:true,concavityProven:true,negativeVolume:true,negativeVolumeId:volume?.id||null,strictConcaveEdgeIds:edges.map(e=>Number(e.id)),diameterMm:Number(c.radius)*2,depthMm:Number(c.face.hole.depth)||Number(c.face.axisSpan)||null}));
    }else if(coneNeighbors.length){
      // Cylinder -> cone at a strict concave transition is a countersink/compound
      // drilled volume, not a mere external bevel.
      const aligned=coneNeighbors.filter(n=>{const r=axisRecord(n.face);return r&&sameAxisLine(c,r,axisTol);});
      if(aligned.length)out.push(feature('countersink','drilling',[c.id,...aligned.map(n=>n.id)],0.975,{topologyProven:true,concavityProven:true,negativeVolume:true,negativeVolumeId:volume?.id||null,strictConcaveEdgeIds:aligned.map(n=>Number(n.edge.id))}));
    }
  }
  // Counterbore proof: two or more coaxial cylindrical radii belong to the same
  // negative-volume component and at least one annular/planar shoulder transition
  // between them is strictly concave.
  for(const volume of negativeVolumes.components){
    const recs=volume.faces.map(axisRecord).filter(Boolean).filter(r=>CYL_FAMILIES.has(r.family));if(recs.length<2)continue;
    const groups=[];for(const r of recs){let g=groups.find(x=>sameAxisLine(x,r,axisTol));if(!g){g={...r,members:[]};groups.push(g);}g.members.push(r);}
    for(const g of groups){const radii=uniqueRadii(g.members,scaleMm);if(radii.length<2)continue;
      const planeIds=volume.faces.filter(f=>fam(f.family)==='plane').map(f=>Number(f.id));if(!planeIds.length)continue;
      const edgeIds=volume.edges.filter(edgeIsStrictConcave).map(e=>Number(e.id));
      out.push(feature('counterbore','drilling',[...g.members.map(m=>m.id),...planeIds],0.985,{topologyProven:true,concavityProven:true,negativeVolume:true,negativeVolumeId:volume.id,strictConcaveEdgeIds:edgeIds,radiiMm:radii}));
    }
  }
  return out;
}

export function detectTurningByGpAx1(faceInfo=[],scaleMm=100){
  const records=(faceInfo||[]).map(axisRecord).filter(Boolean).filter(r=>REV_FAMILIES.has(r.family));
  if(records.length<3)return{recognized:false,confidence:0,revolutionFaceCount:records.length,dominantFaceCount:0,collinearFraction:0};
  const radii=records.map(r=>r.radius).filter(v=>Number.isFinite(v)&&v>0),axisTol=Math.max(Math.max(...radii,scaleMm,1)*0.004,0.06),groups=[];
  for(const r of records){let g=groups.find(x=>sameAxisLine(x,r,axisTol));if(!g){g={axis:r.axis,center:r.center,members:[]};groups.push(g);}g.members.push(r);}
  groups.sort((a,b)=>b.members.length-a.members.length);const best=groups[0],fraction=best?best.members.length/records.length:0;
  const unique=best?uniqueRadii(best.members,Math.max(...radii,scaleMm,1)):[];
  const coneCount=best?.members.filter(m=>CONE_FAMILIES.has(m.family)).length||0,torusCount=best?.members.filter(m=>TORUS_FAMILIES.has(m.family)).length||0,cylinderCount=best?.members.filter(m=>CYL_FAMILIES.has(m.family)).length||0;
  // User requirement: strictly more than 80% of all revolution faces must share
  // one gp_Ax1 line. Additional radial detail avoids calling one simple bore or
  // one press-brake cylinder "turning".
  const radialDetail=unique.length>=2||coneCount>0||torusCount>0;
  const recognized=Boolean(best&&best.members.length>=3&&fraction>0.80&&radialDetail);
  const confidence=recognized?clamp(0.88+(fraction-0.80)*0.35+Math.min(Math.max(unique.length-2,0)*0.015,0.05)+Math.min((coneCount+torusCount)*0.008,0.04)):0;
  return{recognized,confidence,revolutionFaceCount:records.length,dominantFaceCount:best?.members.length||0,collinearFraction:fraction,axis:best?.axis||null,axisCenter:best?.center||null,axisToleranceMm:axisTol,distinctRadii:unique.length,cylinderCount,coneCount,torusCount,faceIds:best?.members.map(m=>m.id)||[]};
}

function detectConcaveGrooves(aag,faceInfo,negativeVolumes,turning,sheetNativeFaceIds=null){
  const byId=new Map((faceInfo||[]).map(f=>[Number(f.id),f])),out=[];
  for(const face of faceInfo||[]){
    const family=fam(face.family);if(!CYL_FAMILIES.has(family)&&!TORUS_FAMILIES.has(family))continue;
    const edges=incidentConcaveEdges(aag,Number(face.id),sheetNativeFaceIds);if(edges.length<2)continue;
    const neighbors=edges.map(e=>byId.get(otherOwner(e,face.id))).filter(Boolean),planes=neighbors.filter(n=>fam(n.family)==='plane');
    if(planes.length<2&&family!=='torus')continue;
    const volume=negativeVolumes.components.find(v=>v.faceIds.includes(Number(face.id)))||null;
    const process=turning?.recognized?'turning':'milling',type=turning?.recognized?'turned-groove':'annular-groove';
    out.push(feature(type,process,[Number(face.id),...neighbors.map(n=>Number(n.id))],0.975,{topologyProven:true,concavityProven:true,negativeVolume:true,negativeVolumeId:volume?.id||null,strictConcaveEdgeIds:edges.map(e=>Number(e.id)),gpAx1CollinearFraction:Number(turning?.collinearFraction)||null}));
  }
  return out;
}

function dedupe(features){const seen=new Set(),out=[];for(const f of features||[]){const k=`${f.type}:${[...(f.faceIds||[])].sort((a,b)=>a-b).join(',')}`;if(seen.has(k))continue;seen.add(k);out.push(f);}return out;}

export function analyzeMachiningEvidence({aag,faceInfo=[],geometry=null,structuralProfile=null,sheetResult=null,stock=null}={}){
  const points=geometry?.positions||[],scaleMm=(()=>{let lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i+2<points.length;i+=3){for(let k=0;k<3;k++){const v=Number(points[i+k]);if(Number.isFinite(v)){lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);}}}const spans=hi.map((v,i)=>v-lo[i]).filter(Number.isFinite);return spans.length?Math.max(...spans,1):100;})();
  // A real press-brake bend is itself concave on one side of the sheet. Those
  // panel↔bend transitions are stock-forming geometry, not removed material.
  // Remove only edges whose TWO owners belong to the proven sheet skin; an edge
  // from a sheet skin to a hole/pocket wall remains eligible machining evidence.
  const nativeSheetFaces=sheetNativeFaceSet(sheetResult),faceById=new Map((faceInfo||[]).map(f=>[Number(f.id),f]));
  const panelNormals=Number(sheetResult?.bendCount)>0?[...new Set((sheetResult?.panelFaceIds||[]).map(id=>faceById.get(Number(id))).map(planeNormal).filter(Boolean).map(n=>n.map(v=>Math.round(v*1e6)/1e6).join(',')))].map(k=>k.split(',').map(Number)):null;
  const negativeVolumes=buildNegativeVolumeComponents(aag,faceInfo,{sheetNativeFaceIds:nativeSheetFaces}),turning=detectTurningByGpAx1(faceInfo,scaleMm,stock),features=[];
  features.push(...detectBlindAndCompoundDrilling(aag,faceInfo,negativeVolumes,scaleMm,nativeSheetFaces));
  features.push(...detectPocketFloors(aag,faceInfo,negativeVolumes,nativeSheetFaces,panelNormals));
  features.push(...detectConcaveGrooves(aag,faceInfo,negativeVolumes,turning,nativeSheetFaces));
  // A structural section may contain stock root fillets that are geometrically
  // concave. Structural-profile authority therefore suppresses a global turning
  // promotion. Real secondary features can still be retained by their local
  // exact-hole / negative-volume proofs for diagnostics.
  if(turning.recognized&&!structuralProfile){
    const concaveOnAxis=new Set(negativeVolumes.concaveArcs.flatMap(e=>e.owners||[]));
    const axisConcave=turning.faceIds.some(id=>concaveOnAxis.has(Number(id)));
    features.push(feature('turning-axis-proof','turning',turning.faceIds,turning.confidence,{gpAx1Proof:true,gpAx1CollinearFraction:turning.collinearFraction,revolutionFaceCount:turning.revolutionFaceCount,dominantFaceCount:turning.dominantFaceCount,distinctRadii:turning.distinctRadii,concavityCorroborated:axisConcave,topologyProven:true}));
  }
  return{features:dedupe(features),negativeVolumes:{count:negativeVolumes.components.length,strictConcaveEdgeCount:negativeVolumes.strictConcaveEdgeCount,suppressedSheetNativeFaceCount:nativeSheetFaces.size,components:negativeVolumes.components.map(v=>({id:v.id,faceIds:v.faceIds,edgeIds:v.edgeIds,families:v.families,strictConcaveEdgeCount:v.strictConcaveEdgeCount,totalFaceAreaMm2:v.totalFaceAreaMm2}))},turning};
}

export const MACHINING_EVIDENCE_VERSION='8.23.0';
