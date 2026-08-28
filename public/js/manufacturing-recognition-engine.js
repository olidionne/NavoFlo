/* NavoFlo V8.23.1 — Manufacturing Recognition Engine (MRE)
 *
 * Architecture:
 *   exact B-Rep/AAG -> stock hypothesis -> virtual delta/removal features
 *   -> independent capabilities/processes -> UI summary.
 *
 * Important: "what stock is it?", "can it export a DXF?", and "was it
 * machined?" are independent questions.  A disk may be cut from plate AND
 * contain a counterbore/groove; a shaft may be round stock AND heavily turned.
 * This module deliberately does not collapse those facts into one enum.
 */
import { classifyManufacturingGeometry } from './manufacturing-classifier.js?v=8.20.0';
import { applyRawStockKnowledge, RAW_STOCK_KNOWLEDGE_VERSION } from './raw-stock-knowledge.js?v=8.20.0';
import { arbitrateManufacturingKnowledge, CRITICAL_ARBITRATOR_VERSION } from './manufacturing-critical-arbitrator.js?v=8.23.1';
import { detectFastenerComponent, FASTENER_RECOGNIZER_VERSION } from './fastener-recognition.js?v=8.21.1';
import { analyzeMachiningEvidence, detectTurningByGpAx1, MACHINING_EVIDENCE_VERSION } from './manufacturing-machining-evidence.js?v=8.23.1';

const EPS=1e-8;
const V={
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  unit(a){const l=this.len(a);return l>EPS?this.scale(a,1/l):null;},
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
};
function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
function fam(v){return String(v||'').toLowerCase();}
function vec(v){return Array.isArray(v)&&v.length>=3?v.slice(0,3).map(Number):null;}
function canonicalAxis(v){let n=V.unit(vec(v)||[]);if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=V.scale(n,-1);return n;}
function axisLineDistance(ca,axis,cb){const d=V.sub(cb,ca),t=V.dot(d,axis);return V.len(V.sub(d,V.scale(axis,t)));}
function sameAxisLine(aAxis,aCenter,bAxis,bCenter,tol){if(!aAxis||!aCenter||!bAxis||!bCenter)return false;if(Math.abs(V.dot(aAxis,bAxis))<0.9985)return false;return axisLineDistance(aCenter,aAxis,bCenter)<=tol;}
function pointsOf(geometry){const p=geometry?.positions||[],out=[];for(let i=0;i+2<p.length;i+=3){const q=[Number(p[i]),Number(p[i+1]),Number(p[i+2])];if(q.every(Number.isFinite))out.push(q);}return out;}
function projectionRange(points,axis){let lo=Infinity,hi=-Infinity;for(const p of points){const d=V.dot(p,axis);if(Number.isFinite(d)){lo=Math.min(lo,d);hi=Math.max(hi,d);}}return Number.isFinite(lo)&&Number.isFinite(hi)?{min:lo,max:hi,span:hi-lo}:null;}
function uniqueNumbers(values,tol){const out=[];for(const value of values.filter(Number.isFinite).sort((a,b)=>a-b)){if(!out.length||Math.abs(out[out.length-1]-value)>tol)out.push(value);}return out;}
function feature(type,process,faceIds,confidence,parameters={}){return{type,process,faceIds:[...new Set((faceIds||[]).map(Number).filter(Number.isFinite))],confidence:clamp(confidence),parameters};}

export function buildAttributedAdjacencyGraph(faceInfo=[],edgeInfo=[]){
  const nodes=new Map();
  for(const f of faceInfo||[])nodes.set(Number(f.id),{
    id:Number(f.id),family:fam(f.family),area:Number(f.area)||0,center:vec(f.localCentroid)||vec(f.localCenter),
    normal:canonicalAxis(f.localNormal),axis:canonicalAxis(f.axisDirection),radius:Number.isFinite(Number(f.radius))?Number(f.radius):null,
    axisMin:Number.isFinite(Number(f.axisMin))?Number(f.axisMin):null,axisMax:Number.isFinite(Number(f.axisMax))?Number(f.axisMax):null,
    axisSpan:Number.isFinite(Number(f.axisSpan))?Number(f.axisSpan):null,hole:f.hole||null,chamfer:f.chamfer||null,sameDomainFaceIds:(f.sameDomainFaceIds||[]).map(Number),neighbors:new Set((f.neighborFaceIds||[]).map(Number))
  });
  const arcs=[];
  for(const e of edgeInfo||[]){
    const owners=(e.ownerFaceIds||[]).map(Number).filter(Number.isFinite);const edge={
      id:Number(e.id),family:fam(e.family),length:Number(e.length)||0,owners,
      transition:String(e.transition||'unknown').toLowerCase(),strictConcave:e.strictConcave===true,strictConvex:e.strictConvex===true,
      normalDot:Number.isFinite(Number(e.normalDot))?Number(e.normalDot):null,normalAngleDeg:Number.isFinite(Number(e.normalAngleDeg))?Number(e.normalAngleDeg):null,
      sideAB:Number.isFinite(Number(e.sideAB))?Number(e.sideAB):null,sideBA:Number.isFinite(Number(e.sideBA))?Number(e.sideBA):null
    };
    arcs.push(edge);
    for(let i=0;i<owners.length;i++)for(let j=i+1;j<owners.length;j++){
      nodes.get(owners[i])?.neighbors.add(owners[j]);nodes.get(owners[j])?.neighbors.add(owners[i]);
    }
  }
  return{nodes,arcs,nodeCount:nodes.size,arcCount:arcs.length};
}

function cylinderRecords(faceInfo=[]){
  return(faceInfo||[]).filter(f=>['cylinder','cylindrical'].includes(fam(f.family))).map(f=>({
    face:f,id:Number(f.id),axis:canonicalAxis(f.axisDirection),center:vec(f.localCenter),radius:Number(f.radius),area:Number(f.area)||0,
    min:Number.isFinite(Number(f.axisMin))?Number(f.axisMin):null,max:Number.isFinite(Number(f.axisMax))?Number(f.axisMax):null,
    span:Number.isFinite(Number(f.axisSpan))?Number(f.axisSpan):null,hole:f.hole||null
  })).filter(c=>c.axis&&c.center&&c.center.every(Number.isFinite)&&c.radius>EPS);
}
function groupCylinders(cylinders,scale=1){
  const groups=[];const tol=Math.max(scale*0.002,1e-4);
  for(const c of cylinders){
    let g=groups.find(x=>sameAxisLine(x.axis,x.center,c.axis,c.center,tol));
    if(!g){g={axis:c.axis,center:c.center,members:[]};groups.push(g);}g.members.push(c);
  }
  for(const g of groups){
    g.radii=uniqueNumbers(g.members.map(m=>m.radius),Math.max(scale*0.001,1e-4));
    const mins=g.members.map(m=>m.min).filter(Number.isFinite),maxs=g.members.map(m=>m.max).filter(Number.isFinite);
    g.min=mins.length?Math.min(...mins):null;g.max=maxs.length?Math.max(...maxs):null;g.span=Number.isFinite(g.min)&&Number.isFinite(g.max)?g.max-g.min:null;
    g.faceIds=g.members.map(m=>m.id);
  }
  return groups;
}
function neighborFamilies(aag,faceIds){
  const ids=new Set(faceIds),families=[],neighborIds=new Set();
  for(const id of ids){for(const n of aag.nodes.get(Number(id))?.neighbors||[]){if(ids.has(n))continue;neighborIds.add(n);const f=aag.nodes.get(n);if(f)families.push(f.family);}}
  return{families,neighborIds:[...neighborIds]};
}
function radialEnvelope(points,axis,center,min,max){
  if(!points.length)return null;const pad=Math.max((Number(max)-Number(min))*0.08,1e-4);let lo=Infinity,hi=-Infinity,count=0;
  for(const p of points){const t=V.dot(p,axis);if(Number.isFinite(min)&&Number.isFinite(max)&&(t<min-pad||t>max+pad))continue;const d=V.sub(p,center),q=V.sub(d,V.scale(axis,V.dot(d,axis))),r=V.len(q);if(Number.isFinite(r)){lo=Math.min(lo,r);hi=Math.max(hi,r);count++;}}
  return count?{min:lo,max:hi,count}:null;
}

function inferRoundStockFromFaces(geometry,faceInfo=[]){
  const points=pointsOf(geometry),cyls=cylinderRecords(faceInfo);if(!points.length||!cyls.length)return null;
  const groups=groupCylinders(cyls,Math.max(...cyls.map(c=>c.radius))*2);let best=null;
  for(const g of groups){
    const R=Math.max(...g.members.map(m=>m.radius)),range=projectionRange(points,g.axis);if(!(R>EPS&&range?.span>EPS))continue;
    let maxRad=0;for(const p of points){const d=V.sub(p,g.center),q=V.sub(d,V.scale(g.axis,V.dot(d,g.axis)));maxRad=Math.max(maxRad,V.len(q));}
    const envelopeError=Math.abs(maxRad-R)/Math.max(R,EPS);if(envelopeError>0.055)continue;
    const outerArea=g.members.filter(m=>Math.abs(m.radius-R)<=Math.max(R*0.002,1e-4)).reduce((s,m)=>s+m.area,0),lateral=2*Math.PI*R*range.span,coverage=lateral>EPS?outerArea/lateral:0;
    // A machined shaft may leave very little raw OD, therefore multiple coaxial
    // radii + cones/tori are strong evidence even if outer-surface coverage is low.
    const coaxialComplexity=g.radii.length>=2;
    if(coverage<0.004&&!coaxialComplexity)continue;
    let confidence=0.80+Math.min(coverage,1)*0.12+(coaxialComplexity?0.06:0)-envelopeError*2.0;
    const candidate={stockType:'round-bar',axis:g.axis,axisCenter:g.center,lengthMm:range.span,diameterMm:R*2,aspect:range.span/(2*R),confidence:clamp(confidence),stockSurfaceCoverage:coverage,envelopeError,source:'mre-round-envelope'};
    if(!best||candidate.confidence>best.confidence)best=candidate;
  }
  return best;
}

function majorPlanePair(faceInfo=[]){
  const planes=(faceInfo||[]).filter(f=>fam(f.family)==='plane').map(f=>({face:f,id:Number(f.id),n:canonicalAxis(f.localNormal),c:vec(f.localCentroid)||vec(f.localCenter),area:Number(f.area)||0})).filter(p=>p.n&&p.c&&p.area>EPS);
  if(planes.length<2)return null;const maxArea=Math.max(...planes.map(p=>p.area));let best=null;
  for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++){
    const a=planes[i],b=planes[j];if(Math.abs(V.dot(a.n,b.n))<0.9993)continue;const t=Math.abs(V.dot(V.sub(b.c,a.c),a.n));if(!(t>EPS))continue;
    const areaRatio=Math.min(a.area,b.area)/Math.max(a.area,b.area);const dominance=Math.min(a.area,b.area)/Math.max(maxArea,EPS);if(areaRatio<0.45||dominance<0.28)continue;
    const score=Math.min(a.area,b.area)*areaRatio;if(!best||score>best.score)best={a,b,normal:a.n,thickness:t,areaRatio,dominance,score};
  }
  return best;
}
function derivePlateStock(geometry,faceInfo,sheetResult,legacy){
  const points=pointsOf(geometry);if(!points.length)return null;
  let normal=canonicalAxis(legacy?.stockType==='plate-blank'?legacy.axis:null),thickness=Number(legacy?.stockType==='plate-blank'?legacy.thicknessMm:NaN),pair=null;
  if(!normal||!(thickness>EPS)){pair=majorPlanePair(faceInfo);if(pair){normal=pair.normal;thickness=pair.thickness;}}
  if(!normal&&sheetResult?.fixedFaceId){const f=(faceInfo||[]).find(x=>Number(x.id)===Number(sheetResult.fixedFaceId));normal=canonicalAxis(f?.localNormal);}
  if(!(thickness>EPS)&&Number(sheetResult?.thickness)>EPS)thickness=Number(sheetResult.thickness);
  if(!normal||!(thickness>EPS))return null;
  const rangeN=projectionRange(points,normal);if(!rangeN)return null;
  // Find two stable axes in the plate plane from long straight edges.
  const dirs=[];for(const e of geometry?.edges||[]){const pts=Array.from(e.points||[]).map(Number);if(pts.length<6)continue;const a=pts.slice(0,3),b=pts.slice(-3),d=V.unit(V.sub(b,a));if(!d||Math.abs(V.dot(d,normal))>0.08)continue;if(dirs.every(x=>Math.abs(V.dot(x,d))<0.995))dirs.push(d);}
  let u=dirs[0]||null,v=u?(dirs.find(x=>Math.abs(V.dot(x,u))<0.25)||null):null;
  if(!u){const ref=Math.abs(normal[0])<0.8?[1,0,0]:[0,1,0];u=V.unit(V.cross(normal,ref));}if(!v&&u)v=V.unit(V.cross(normal,u));if(!u||!v)return null;
  const ru=projectionRange(points,u),rv=projectionRange(points,v);if(!ru||!rv)return null;const major=Math.max(ru.span,rv.span),minor=Math.min(ru.span,rv.span);
  return{stockType:'plate-blank',axis:normal,lengthMm:major,widthMm:minor,thicknessMm:thickness,aspect:major/Math.max(minor,EPS),confidence:clamp(0.88+(pair?.areaRatio||0)*0.05),source:'mre-plate-slab'};
}

// V8.24 — synthesise a minimal round-bar stock record from a gp_Ax1 turning
// proof when inferRoundStockFromFaces fails (e.g. tight envelope-error threshold
// on heavily machined shafts whose tessellation jitters past the nominal OD).
function syntheticRoundFromTurning(geometry,faceInfo,turning){
  if(!turning?.recognized||!turning.axis||!turning.axisCenter)return null;
  const axis=turning.axis,center=turning.axisCenter,points=pointsOf(geometry);
  if(!points.length)return null;
  const range=projectionRange(points,axis);if(!range||range.span<=EPS)return null;
  let maxR=0;
  for(const p of points){const d=V.sub(p,center),t=V.dot(d,axis),perp=V.sub(d,V.scale(axis,t));const r=V.len(perp);if(r>maxR)maxR=r;}
  if(!(maxR>EPS))return null;
  return{stockType:'round-bar',axis,axisCenter:center,lengthMm:range.span,diameterMm:maxR*2,
    aspect:range.span/(maxR*2),stockSurfaceCoverage:0.001,envelopeError:0,
    confidence:clamp(turning.confidence-0.04),source:'gp-ax1-revolution-solver'};
}

function normalizeStock({geometry,faceInfo,sheetResult,legacy,structuralProfile,revolutionHint}){
  if(structuralProfile)return{stockType:'structural-profile',profile:structuralProfile,confidence:Number(structuralProfile?.confidence)||0.9,source:'structural-profile'};
  if(sheetResult?.rolledPlate&&sheetResult?.rolledPlateData){const r=sheetResult.rolledPlateData;return{stockType:'rolled-plate',axis:canonicalAxis(r.axis),axisCenter:vec(r.axisCenter),thicknessMm:Number(r.thicknessMm)||null,widthMm:Number(r.axialLengthMm)||null,lengthMm:Number(r.developedLengthMm)||null,developedLengthMm:Number(r.developedLengthMm)||null,outerDiameterMm:Number(r.outerDiameterMm)||null,innerDiameterMm:Number(r.innerDiameterMm)||null,gapAngleDeg:Number(r.gapAngleDeg)||0,confidence:Number(r.confidence)||0.96,source:'rolled-slit-plate-brep'};}
  if(Number(sheetResult?.bendCount)>0)return{stockType:'sheet-metal',thicknessMm:Number(sheetResult.thickness)||null,confidence:0.99,source:'sheet-metal-brep'};
  const round=inferRoundStockFromFaces(geometry,faceInfo);
  // V8.24 — gp_Ax1 Revolution Solver fallback: when the tessellation envelope
  // check fails (e.g. noisy STEP or heavily machined OD), synthesise a round-bar
  // stock record from the turning proof axis so recognizeRoundFeatures can run.
  if(!round&&revolutionHint?.recognized){
    const synth=syntheticRoundFromTurning(geometry,faceInfo,revolutionHint);
    if(synth&&(!legacy||legacy.stockType==='plate-blank'||synth.confidence>(Number(legacy?.confidence)||0)-0.02)){
      return{...legacy,...synth};
    }
  }
  // Prefer a strong round envelope over a weak plate/box hypothesis.  This is
  // essential for turned shafts with two planar end faces.
  if(round&&(!legacy||legacy.stockType==='plate-blank'||round.confidence>(Number(legacy.confidence)||0)-0.02)){
    const merged={...legacy,...round};return merged;
  }
  if(legacy?.commercialStockReclassified&&sheetResult?.flatPlate){
    const plate=derivePlateStock(geometry,faceInfo,sheetResult,null);
    if(plate)return{...legacy,...plate,stockType:'plate-blank',stockKnowledge:legacy.stockKnowledge,commercialStockReclassified:true,originalStockType:legacy.originalStockType||'flat-bar',source:'raw-stock-knowledge+plate-slab'};
  }
  if(legacy)return applyRawStockKnowledge({...legacy});
  if(sheetResult?.flatPlate)return derivePlateStock(geometry,faceInfo,sheetResult,null);
  return applyRawStockKnowledge(round||null);
}

function plateContext(stock,sheetResult,faceInfo){
  if(!stock)return null;let normal=null,t=null;
  if(stock.stockType==='plate-blank'){normal=canonicalAxis(stock.axis);t=Number(stock.thicknessMm);}
  if(!normal&&sheetResult?.flatPlate){const pair=majorPlanePair(faceInfo);if(pair){normal=pair.normal;t=pair.thickness;}}
  if(!normal||!(t>EPS))return null;return{normal,thickness:t};
}

function plateMachiningContext(faceInfo,aag,normal,thickness){
  const faceById=new Map((faceInfo||[]).map(f=>[Number(f.id),f]));
  const planes=(faceInfo||[]).filter(f=>fam(f.family)==='plane').map(f=>({f,id:Number(f.id),n:canonicalAxis(f.localNormal),c:vec(f.localCentroid)||vec(f.localCenter),area:Number(f.area)||0})).filter(x=>x.n&&x.c);
  const parallel=planes.filter(p=>Math.abs(V.dot(p.n,normal))>0.995);
  if(parallel.length<2)return{faceById,planes,parallel,skinIds:new Set(),interiorPlanes:[],components:[],skinAreaRatio:null};
  const values=parallel.map(p=>V.dot(p.c,normal)),lo=Math.min(...values),hi=Math.max(...values),tol=Math.max(thickness*0.035,1e-4);
  const lowSkin=parallel.filter(p=>Math.abs(V.dot(p.c,normal)-lo)<=tol),highSkin=parallel.filter(p=>Math.abs(V.dot(p.c,normal)-hi)<=tol);
  const lowSkinIds=new Set(lowSkin.map(p=>p.id)),highSkinIds=new Set(highSkin.map(p=>p.id));
  // Expand skins through worker-provided virtual same-domain groups. This is the
  // analysis equivalent of OCCT ShapeUpgrade_UnifySameDomain: a SolidWorks seam
  // can split one physical plane into multiple adjacent B-Rep faces, but all of
  // them still belong to the same skin and must not become a fake pocket floor.
  const expandDomain=set=>{for(const id of [...set])for(const d of aag.nodes.get(Number(id))?.sameDomainFaceIds||[])set.add(Number(d));};
  expandDomain(lowSkinIds);expandDomain(highSkinIds);
  const skinIds=new Set([...lowSkinIds,...highSkinIds]);
  const interiorPlanes=parallel.filter(p=>!skinIds.has(Number(p.id))).filter(p=>{const d=V.dot(p.c,normal);return d>lo+tol&&d<hi-tol;});

  // V8.19.1: treat the AAG as the source of truth for STEP split/seam faces.
  // Removing the two physical skins leaves independent side-wall/cavity
  // components. A periodic cylinder/torus split into two B-Rep faces stays in
  // the same component instead of becoming two unrelated "features".
  const eligible=new Set([...aag.nodes.keys()].filter(id=>!skinIds.has(Number(id))));
  const seen=new Set(),components=[];
  for(const seed of eligible){
    if(seen.has(seed))continue;const queue=[seed],ids=[];seen.add(seed);
    while(queue.length){const id=queue.shift();ids.push(id);for(const n of aag.nodes.get(id)?.neighbors||[]){if(eligible.has(n)&&!seen.has(n)){seen.add(n);queue.push(n);}}}
    if(ids.length)components.push(ids);
  }
  const lowArea=[...lowSkinIds].reduce((sum,id)=>sum+(Number(faceById.get(Number(id))?.area)||0),0),highArea=[...highSkinIds].reduce((sum,id)=>sum+(Number(faceById.get(Number(id))?.area)||0),0),skinAreaRatio=Math.min(lowArea,highArea)/Math.max(lowArea,highArea,EPS);
  return{faceById,planes,parallel,skinIds,lowSkinIds,highSkinIds,interiorPlanes,components,lowArea,highArea,skinAreaRatio,lo,hi,tol};
}
function plateComponentCylinderGroups(ids,ctx,normal,thickness){
  const records=[];for(const id of ids){const f=ctx.faceById.get(Number(id));if(!f||!['cylinder','cylindrical'].includes(fam(f.family)))continue;const axis=canonicalAxis(f.axisDirection),center=vec(f.localCenter),radius=Number(f.radius);if(!axis||!center||!(radius>EPS))continue;records.push({face:f,id:Number(id),axis,center,radius,area:Number(f.area)||0,min:Number.isFinite(Number(f.axisMin))?Number(f.axisMin):null,max:Number.isFinite(Number(f.axisMax))?Number(f.axisMax):null,span:Number.isFinite(Number(f.axisSpan))?Number(f.axisSpan):null,hole:f.hole||null});}
  if(!records.length)return[];
  // Components already encode topology. Axis grouping inside one component now
  // heals periodic seam faces while keeping unrelated coaxial cavities apart.
  return groupCylinders(records,Math.max(thickness,1));
}
function componentIsPureStockBoundary(ids,ctx,stock,normal,thickness){
  if(stock?.stockType!=='round-bar'||!(Number(stock.diameterMm)>EPS))return false;
  const axis=canonicalAxis(stock.axis),center=vec(stock.axisCenter),R=Number(stock.diameterMm)/2;if(!axis||!center)return false;
  let radial=false,otherMachining=false;
  for(const id of ids){const f=ctx.faceById.get(Number(id)),family=fam(f?.family);if(['cone','conical','torus','toroidal'].includes(family))otherMachining=true;
    if(['cylinder','cylindrical'].includes(family)){const a=canonicalAxis(f?.axisDirection),c=vec(f?.localCenter),r=Number(f?.radius);if(a&&c&&Number.isFinite(r)&&Math.abs(V.dot(a,axis))>0.998&&axisLineDistance(center,axis,c)<Math.max(R*0.01,0.03)&&Math.abs(r-R)<Math.max(R*0.01,0.03))radial=true;else otherMachining=true;}
    if(family==='plane'){const n=canonicalAxis(f?.localNormal);if(n&&Math.abs(V.dot(n,normal))>0.995){const d=V.dot(vec(f.localCentroid)||vec(f.localCenter)||[0,0,0],normal);if(d>ctx.lo+ctx.tol&&d<ctx.hi-ctx.tol)otherMachining=true;}}
  }
  return radial&&!otherMachining;
}

function isSupportedPocketFloor(id,ctx,aag,normal){
  const node=aag.nodes.get(Number(id)),f=ctx.faceById.get(Number(id));if(!node||!f)return false;
  const floorN=canonicalAxis(f.localNormal);if(!floorN||Math.abs(V.dot(floorN,normal))<0.995)return false;
  const wallIds=[];for(const nId of node.neighbors||[]){const nf=ctx.faceById.get(Number(nId));if(!nf)continue;const family=fam(nf.family);if(family==='plane'){const nn=canonicalAxis(nf.localNormal);if(nn&&Math.abs(V.dot(nn,normal))>0.995)continue;}wallIds.push(Number(nId));}
  if(!wallIds.length)return false;
  let touchesLow=false,touchesHigh=false;
  for(const wallId of wallIds){for(const n of aag.nodes.get(wallId)?.neighbors||[]){if(ctx.lowSkinIds?.has(Number(n)))touchesLow=true;if(ctx.highSkinIds?.has(Number(n)))touchesHigh=true;}}
  // V8.21: a true blind pocket floor must be connected to exactly ONE physical
  // skin through its side walls. If the component reaches both skins it is a
  // through-cut/through-passage and cannot prove milling.
  return touchesLow!==touchesHigh;
}
function globalPlateAnalyticFeatures({faceInfo,ctx,normal,thickness,stock,excludeFaceIds=null}){
  // V8.21 deterministic proof floor.  Surface family alone is NOT a process
  // proof: a torus can be a rolled/stock fillet, a cone can be a bevel-cut edge,
  // and a transverse cylinder can be an external radius.  Only exact OCCT hole
  // descriptors are promoted here.  Pocket/groove topology is handled by the AAG
  // component pass above where skin contact can actually prove a blind feature.
  const out=[],excluded=excludeFaceIds instanceof Set?excludeFaceIds:new Set(excludeFaceIds||[]);
  for(const f of faceInfo||[]){
    const family=fam(f.family),id=Number(f.id);if(ctx.skinIds.has(id)||excluded.has(id))continue;
    if(f.compoundHole&&fam(f.compoundHole.family)==='counterbore'){
      out.push(feature('counterbore','drilling',[id],0.995,{analyticFallback:true,exactCompoundHole:true,topologyProven:true}));continue;
    }
    if(f.compoundHole&&fam(f.compoundHole.family)==='countersink'){
      out.push(feature('countersink','drilling',[id],0.995,{analyticFallback:true,exactCompoundHole:true,topologyProven:true}));continue;
    }
    if(!['cylinder','cylindrical'].includes(family)||!f.hole)continue;
    const a=canonicalAxis(f.axisDirection),r=Number(f.radius);if(!a||!(r>EPS))continue;
    const align=Math.abs(V.dot(a,normal));
    if(f.hole.isThrough===false){out.push(feature('blind-hole','drilling',[id],0.992,{diameterMm:r*2,depthMm:Number(f.hole.depth)||Number(f.axisSpan),analyticFallback:true,exactHole:true,topologyProven:true}));continue;}
    if(f.hole.isThrough===true&&align<0.985){out.push(feature('cross-hole','drilling',[id],0.985,{diameterMm:r*2,analyticFallback:true,exactHole:true,topologyProven:true}));continue;}
  }
  return dedupeFeatures(out);
}
function componentSkinContact(ids,ctx,aag){
  let low=false,high=false;
  for(const id of ids){
    const node=aag.nodes.get(Number(id));
    for(const n of node?.neighbors||[]){if(ctx.lowSkinIds?.has(Number(n)))low=true;if(ctx.highSkinIds?.has(Number(n)))high=true;}
  }
  return{low,high,both:low&&high};
}
function componentSurfaceFamilies(ids,ctx){
  const counts=new Map();
  for(const id of ids){const family=fam(ctx.faceById.get(Number(id))?.family);counts.set(family,(counts.get(family)||0)+1);}
  return counts;
}
function classifyPureThroughCutComponent(ids,ctx,aag,normal,thickness){
  // A pure 2D cut through a constant-thickness plate has side walls that join
  // BOTH physical skins, no offset floor, no cone/torus, and every radial wall
  // spans the complete thickness.  This is the exact topological distinction
  // needed for obround/slot cuts: two cylindrical ends + two planar side walls
  // are ONE through-slot, not "2 holes + 2 pockets".
  const contact=componentSkinContact(ids,ctx,aag);if(!contact.both)return null;
  const families=componentSurfaceFamilies(ids,ctx),cylinders=[],planes=[];
  for(const id of ids){
    const f=ctx.faceById.get(Number(id)),family=fam(f?.family);if(!f)continue;
    if(['cone','conical','torus','toroidal','sphere','spherical'].includes(family))return null;
    if(['cylinder','cylindrical'].includes(family)){
      const axis=canonicalAxis(f.axisDirection),span=Number(f.axisSpan),explicit=f.hole?.isThrough;
      if(!axis||Math.abs(V.dot(axis,normal))<0.985)return null;
      if(explicit===false)return null;
      if(explicit!==true&&Number.isFinite(span)&&span<thickness*0.92)return null;
      cylinders.push(Number(id));continue;
    }
    if(family==='plane'){
      const n=canonicalAxis(f.localNormal);if(!n)return null;
      // A plane parallel to the plate skins inside the slab is a floor/recess,
      // not a through-cut side wall.
      if(Math.abs(V.dot(n,normal))>0.985)return null;
      planes.push(Number(id));continue;
    }
    // Be conservative for NURBS/unknown walls until ML/Boolean delta confirms
    // the complete instance.  Do not silently suppress possible machining.
    return null;
  }
  // V8.20.3: a rectangular/window cut can be 100% planar.  Once the side-wall
  // component is proven to touch BOTH skins and contains no skin-parallel floor,
  // it is a through-profile just as surely as a circular/obround hole.  The outer
  // stock perimeter is removed separately by area ranking in recognizePlateFeatures.
  if(!cylinders.length&&planes.length<3)return null;
  const allIds=[...new Set(ids.map(Number))];
  const wallAreaMm2=allIds.reduce((sum,id)=>sum+(Number(ctx.faceById.get(Number(id))?.area)||0),0);
  let type='through-profile';
  if(cylinders.length>=2&&planes.length>=1)type='through-slot';
  else if(cylinders.length===1&&planes.length===0)type='through-hole';
  return feature(type,'cutting',allIds,0.985,{throughCutEquivalent:true,topologyProven:true,cylinderFaceCount:cylinders.length,planeWallCount:planes.length,wallAreaMm2,planarWindow:cylinders.length===0});
}
function mergeThroughCutComponents(features){
  // If a topological through-slot/profile covers the same faces as lower-level
  // through-hole/cross-hole/pocket guesses, the instance-level feature wins.
  const thru=features.filter(f=>['through-slot','through-profile','through-pocket','through-passage','through-step','through-polygon'].includes(f.type));
  if(!thru.length)return features;
  return features.filter(f=>{
    if(thru.includes(f))return true;
    if(!['through-hole','cross-hole','pocket-floor','one-sided-recess'].includes(f.type))return true;
    const A=new Set(f.faceIds||[]);for(const t of thru){const B=new Set(t.faceIds||[]);let overlap=0;for(const id of A)if(B.has(id))overlap++;if(A.size&&overlap/A.size>=0.65)return false;}return true;
  });
}

function suppressGenericMachiningFragmentsCoveredByThroughCuts(features,{plateContext=false}={}){
  if(!plateContext)return features;
  const throughTypes=new Set(['through-slot','through-profile','through-pocket','through-passage','through-step','through-polygon','through-hole']);
  const genericTypes=new Set(['cross-hole','pocket-floor','one-sided-recess','offset-bore']);
  const through=(features||[]).filter(f=>throughTypes.has(f.type)&&f?.parameters?.topologyProven!==false);
  if(!through.length)return features;
  return(features||[]).filter(f=>{
    if(!genericTypes.has(f.type))return true;
    // Never erase a genuinely one-sided/exact manufacturing feature. Compound
    // holes, blind holes and grooves use other feature types and therefore do
    // not enter this branch. Generic fragments lose only when their own B-Rep
    // faces are already explained by one proven full-thickness cut component.
    const A=new Set((f.faceIds||[]).map(Number));if(!A.size)return true;
    for(const t of through){const B=new Set((t.faceIds||[]).map(Number));let overlap=0;for(const id of A)if(B.has(id))overlap++;const ratio=overlap/Math.max(1,A.size);if(ratio>=0.50||overlap>=Math.min(2,A.size))return false;}
    return true;
  });
}

function recognizePlateFeatures({geometry,faceInfo,aag,stock,sheetResult}){
  const ctx0=plateContext(stock,sheetResult,faceInfo);if(!ctx0)return[];const {normal,thickness}=ctx0,ctx=plateMachiningContext(faceInfo,aag,normal,thickness),features=[];
  const used=new Set();
  // Pre-classify every full-thickness wall component.  For profiles whose OUTER
  // perimeter itself contains arcs (obround/rounded plate), the outer wall can
  // look exactly like an internal through-slot.  Side-wall area = perimeter × T,
  // so when 2+ closed full-thickness components exist the largest one is the
  // physical external perimeter; smaller ones are internal through cuts.
  const throughByKey=new Map();
  for(const ids of ctx.components){
    if(componentIsPureStockBoundary(ids,ctx,stock,normal,thickness))continue;
    const t=classifyPureThroughCutComponent(ids,ctx,aag,normal,thickness);if(t)throughByKey.set([...ids].map(Number).sort((a,b)=>a-b).join(','),t);
  }
  const throughCandidates=[...throughByKey.values()].sort((a,b)=>(Number(b.parameters?.wallAreaMm2)||0)-(Number(a.parameters?.wallAreaMm2)||0));
  // A single proven full-thickness component is much more safely interpreted
  // as an internal cut than discarded as the outside perimeter. Only nominate
  // the largest candidate as the external perimeter when there are at least two
  // closed full-thickness components to compare.
  const externalThroughFaceKey=throughCandidates.length>=2?[...throughCandidates[0].faceIds].sort((a,b)=>a-b).join(','):null;
  for(const ids of ctx.components){
    if(componentIsPureStockBoundary(ids,ctx,stock,normal,thickness))continue;
    const componentKey=[...ids].map(Number).sort((a,b)=>a-b).join(',');
    const throughCut=throughByKey.get(componentKey)||null;
    if(throughCut&&componentKey!==externalThroughFaceKey){features.push(throughCut);for(const id of ids)used.add(Number(id));continue;}
    if(throughCut&&componentKey===externalThroughFaceKey)continue;
    const families=ids.map(id=>fam(ctx.faceById.get(Number(id))?.family));
    const coneIds=ids.filter(id=>['cone','conical'].includes(fam(ctx.faceById.get(Number(id))?.family)));
    const torusIds=ids.filter(id=>['torus','toroidal'].includes(fam(ctx.faceById.get(Number(id))?.family)));
    const rawInteriorPlaneIds=ids.filter(id=>ctx.interiorPlanes.some(p=>p.id===Number(id)));
    const interiorPlaneIds=rawInteriorPlaneIds.filter(id=>isSupportedPocketFloor(id,ctx,aag,normal));
    const groups=plateComponentCylinderGroups(ids,ctx,normal,thickness);
    const skinContact=componentSkinContact(ids,ctx,aag);
    let componentMachining=false;
    for(const g of groups){
      const align=Math.abs(V.dot(g.axis,normal));if(align<0.985){const exactHole=g.members.some(m=>m.hole);if(exactHole){features.push(feature('cross-hole','drilling',g.faceIds,0.985,{diameterMm:g.radii[0]*2,axis:g.axis,exactHole:true,topologyProven:true}));componentMachining=true;}continue;}
      const spans=g.members.map(m=>m.span).filter(Number.isFinite),maxSpan=spans.length?Math.max(...spans):g.span,spanRatio=Number.isFinite(maxSpan)?maxSpan/Math.max(thickness,EPS):null;
      const explicitThrough=g.members.some(m=>m.hole?.isThrough===true),explicitBlind=g.members.some(m=>m.hole&&m.hole.isThrough===false);
      const full=explicitThrough||(Number.isFinite(spanRatio)&&spanRatio>=0.92),partialBySpan=Number.isFinite(spanRatio)&&spanRatio<0.90,partial=explicitBlind||(partialBySpan&&!skinContact.both&&(skinContact.low||skinContact.high)&&interiorPlaneIds.length>0);
      const compound=g.members.map(m=>m.face?.compoundHole).find(x=>x&&['counterbore','countersink'].includes(fam(x.family)));
      if(compound&&fam(compound.family)==='counterbore'){
        features.push(feature('counterbore','drilling',ids,0.995,{holeDiameterMm:Number(compound.holeDiameter),counterboreDiameterMm:Number(compound.counterboreDiameter),counterboreDepthMm:Number(compound.counterboreDepth),through:compound.isThrough===true?true:compound.isThrough===false?false:null,exactCompoundHole:true,topologyProven:true}));componentMachining=true;
      }else if(compound&&fam(compound.family)==='countersink'){
        features.push(feature('countersink','drilling',ids,0.995,{holeDiameterMm:Number(compound.holeDiameter),countersinkDiameterMm:Number(compound.countersinkDiameter),countersinkAngleRad:Number(compound.countersinkAngle),through:compound.isThrough===true?true:compound.isThrough===false?false:null,exactCompoundHole:true,topologyProven:true}));componentMachining=true;
      }else if(g.radii.length>=2&&(partial||coneIds.length||torusIds.length||interiorPlaneIds.length)){
        features.push(feature('counterbore','drilling',ids,0.97,{radiiMm:g.radii,spanRatio}));componentMachining=true;
      }else if(partial){features.push(feature('blind-hole','drilling',g.faceIds,explicitBlind?0.992:0.94,{diameterMm:g.radii[0]*2,spanRatio,exactHole:explicitBlind,topologyProven:explicitBlind||Boolean(interiorPlaneIds.length)}));componentMachining=true;
      }else if(coneIds.length&&g.members.some(m=>m.hole)){features.push(feature('countersink','drilling',ids,0.96,{diameterMm:g.radii[0]*2,spanRatio,exactHole:true,topologyProven:true}));componentMachining=true;
      }else if(full){features.push(feature('through-hole','cutting',g.faceIds,0.91,{diameterMm:g.radii[0]*2,spanRatio}));}
    }
    const blindComponent=(!skinContact.both&&(skinContact.low||skinContact.high));
    if(torusIds.length&&blindComponent&&(interiorPlaneIds.length||groups.some(g=>g.members.some(m=>m.hole?.isThrough===false)))){features.push(feature('annular-groove','milling',ids,0.97,{splitFaceCount:torusIds.length,topologyProven:true}));componentMachining=true;}
    for(const id of interiorPlaneIds){features.push(feature('pocket-floor','milling',[id],0.965,{topologyProven:true,oneSkinContact:true}));componentMachining=true;}
    // A cone/toroid cannot be produced by a pure normal 2D profile cut. This
    // fallback intentionally survives missing/fragmented cylinder metadata.
    if(!groups.length&&coneIds.length&&blindComponent&&interiorPlaneIds.length){features.push(feature('countersink-chamfer','drilling',ids,0.91,{topologyProven:true}));componentMachining=true;}
    if(!groups.length&&torusIds.length&&blindComponent&&interiorPlaneIds.length){features.push(feature('groove-fillet','milling',ids,0.93,{topologyProven:true}));componentMachining=true;}
    if(componentMachining)for(const id of ids)used.add(Number(id));
  }

  // Strong fallback based on BOTH plate skins. Pure 2D cutting preserves the
  // same material footprint on both skins (through holes included). A sizeable
  // top/bottom material-area mismatch proves a one-sided recess, pocket,
  // counterbore or similar secondary operation even when STEP exporters split
  // the radial wall into several periodic faces.
  // Skin-area mismatch is supporting evidence only.  A STEP exporter can split
  // one physical skin into several same-domain faces (the visible SolidWorks
  // "separation line").  Never call that machining by area alone.  Require a
  // real offset floor, blind radial surface, cone or torus as corroboration.
  const analyticSupport=features.some(f=>['pocket-floor','blind-hole','counterbore','countersink','annular-groove','groove-fillet','countersink-chamfer'].includes(f.type));
  if(Number.isFinite(ctx.skinAreaRatio)&&ctx.skinAreaRatio<0.985&&analyticSupport){
    const faceIds=[...ctx.skinIds];features.push(feature('one-sided-recess','milling',faceIds,clamp(0.82+(1-ctx.skinAreaRatio)*0.5),{skinAreaRatio:ctx.skinAreaRatio,lowAreaMm2:ctx.lowArea,highAreaMm2:ctx.highArea,corroborated:true}));
  }

  // Global analytic pass: this is independent of AAG component splitting and is
  // deliberately redundant.  It catches grooves/blind bores even when a STEP
  // periodic seam fragments the physical feature into unexpected components.
  features.push(...globalPlateAnalyticFeatures({faceInfo,ctx,normal,thickness,stock,excludeFaceIds:new Set(features.flatMap(f=>f.faceIds))}));
  return dedupeFeatures(mergeThroughCutComponents(features));
}
function recognizeRoundFeatures({geometry,faceInfo,aag,stock}){
  if(stock?.stockType!=='round-bar')return[];const points=pointsOf(geometry),axis=canonicalAxis(stock.axis),center=vec(stock.axisCenter),R=Number(stock.diameterMm)/2,L=Number(stock.lengthMm);if(!axis||!center||!(R>EPS&&L>EPS))return[];
  const cyls=cylinderRecords(faceInfo),groups=groupCylinders(cyls,2*R),features=[],tolR=Math.max(R*0.015,0.02);
  for(const g of groups){
    const align=Math.abs(V.dot(g.axis,axis)),sameLine=align>0.995&&axisLineDistance(center,axis,g.center)<=Math.max(R*0.02,0.03);
    if(!sameLine){if(align<0.98)features.push(feature('cross-hole','drilling',g.faceIds,0.96,{diameterMm:g.radii[0]*2}));else features.push(feature('offset-bore','drilling',g.faceIds,0.90,{diameterMm:g.radii[0]*2}));continue;}
    for(const m of g.members){
      if(Math.abs(m.radius-R)<=tolR)continue;
      const env=radialEnvelope(points,axis,center,m.min,m.max),external=env&&env.max<=m.radius+Math.max(R*0.035,0.05),span=Number(m.span)||0,narrow=span>0&&span<Math.max(R*0.65,1);
      if(m.hole?.isThrough===true){features.push(feature('axial-bore','drilling',[m.id],0.96,{diameterMm:m.radius*2,through:true}));continue;}
      if(m.hole&&m.hole.isThrough===false){features.push(feature('blind-axial-bore','drilling',[m.id],0.97,{diameterMm:m.radius*2,depthMm:Number(m.hole.depth)||span}));continue;}
      if(external){features.push(feature(narrow?'turned-groove':'turned-step','turning',[m.id],narrow?0.94:0.92,{diameterMm:m.radius*2,spanMm:span}));}
      else features.push(feature('axial-bore','drilling',[m.id],0.88,{diameterMm:m.radius*2,through:null}));
    }
  }
  // Coaxial cones are turned chamfers/tapers. Non-coaxial cones usually belong
  // to countersinks or milled/drilled features.
  for(const f of faceInfo||[]){if(!['cone','conical'].includes(fam(f.family)))continue;const a=canonicalAxis(f.axisDirection),c=vec(f.localCenter);const id=Number(f.id);if(a&&c&&Math.abs(V.dot(a,axis))>0.995&&axisLineDistance(center,axis,c)<Math.max(R*0.03,0.05))features.push(feature('turned-chamfer-taper','turning',[id],0.92,{}));else features.push(feature('countersink-chamfer','drilling',[id],0.84,{}));}
  for(const f of faceInfo||[]){if(fam(f.family)==='torus')features.push(feature('turned-groove-fillet','turning',[Number(f.id)],0.93,{}));}
  // Interior axial-normal planes are turning shoulders/faces.
  const range=projectionRange(points,axis);if(range){for(const f of faceInfo||[]){if(fam(f.family)!=='plane')continue;const n=canonicalAxis(f.localNormal),c=vec(f.localCentroid)||vec(f.localCenter);if(!n||!c||Math.abs(V.dot(n,axis))<0.995)continue;const d=V.dot(c,axis),tol=Math.max(L*0.01,0.05);if(d>range.min+tol&&d<range.max-tol)features.push(feature('turned-shoulder','turning',[Number(f.id)],0.86,{}));}}
  return dedupeFeatures(features);
}


function revolutionAxisRecords(faceInfo=[]){
  return(faceInfo||[]).filter(f=>['cylinder','cylindrical','cone','conical','torus','toroidal'].includes(fam(f.family))).map(f=>({
    face:f,id:Number(f.id),family:fam(f.family),axis:canonicalAxis(f.axisDirection),center:vec(f.localCenter),radius:Number(f.radius),area:Number(f.area)||0,
    min:Number.isFinite(Number(f.axisMin))?Number(f.axisMin):null,max:Number.isFinite(Number(f.axisMax))?Number(f.axisMax):null,span:Number.isFinite(Number(f.axisSpan))?Number(f.axisSpan):null
  })).filter(r=>r.axis&&r.center&&r.center.every(Number.isFinite));
}
function groupRevolutionAxes(records,scale=1){
  const groups=[],tol=Math.max(scale*0.0025,0.03);
  for(const r of records){let g=groups.find(x=>sameAxisLine(x.axis,x.center,r.axis,r.center,tol));if(!g){g={axis:r.axis,center:r.center,members:[]};groups.push(g);}g.members.push(r);}
  for(const g of groups){g.faceIds=g.members.map(m=>m.id);g.cylinders=g.members.filter(m=>['cylinder','cylindrical'].includes(m.family));g.cones=g.members.filter(m=>['cone','conical'].includes(m.family));g.tori=g.members.filter(m=>['torus','toroidal'].includes(m.family));g.radii=uniqueNumbers(g.members.map(m=>m.radius).filter(r=>r>EPS),Math.max(scale*0.001,0.02));g.area=g.members.reduce((sum,m)=>sum+(Number(m.area)||0),0);}
  return groups;
}

// V8.23.0 — morphology proof for machined round plates/pucks.
// The former `roundPlateContext` guard suppressed the complete round-feature
// recognizer in order to keep a laser-cut disk from being called a turned part.
// That also hid very real countersinks and annular grooves.  Here the raw OD is
// ignored, while SECONDARY axis groups are evaluated independently:
//   • off-axis Cylinder + Cone on one gp_Ax1 line => countersunk drilling;
//   • off-axis stepped cylinders => counterbore;
//   • toroidal / reduced-radius geometry on the stock axis => annular groove.
// These are relational B-Rep patterns, never a surface-family-only guess.
function recognizeRoundPlateSecondaryFeatures({faceInfo,stock}){
  if(stock?.stockType!=='round-bar'||!(Number(stock.aspect)<0.45))return[];
  const axis=canonicalAxis(stock.axis),center=vec(stock.axisCenter),R=Number(stock.diameterMm)/2,T=Number(stock.lengthMm);if(!axis||!center||!(R>EPS&&T>EPS))return[];
  const groups=groupRevolutionAxes(revolutionAxisRecords(faceInfo),Math.max(R*2,T,1)),features=[],axisTol=Math.max(R*0.02,0.05);
  for(const g of groups){
    const align=Math.abs(V.dot(g.axis,axis)),offset=axisLineDistance(center,axis,g.center),central=align>=0.995&&offset<=axisTol;
    if(!central){
      // Normal-to-plate secondary holes stay parallel to the stock axis but are
      // spatially offset from it.  A cone + cylinder sharing that offset axis is
      // the canonical countersink signature exported by SolidWorks/Inventor.
      if(align>=0.992&&g.cylinders.length&&g.cones.length){
        const cylR=Math.min(...g.cylinders.map(c=>Number(c.radius)).filter(r=>r>EPS)),coneR=Math.max(...g.cones.map(c=>Number(c.radius)).filter(r=>r>EPS));
        if(Number.isFinite(cylR)&&Number.isFinite(coneR)&&coneR>cylR*1.015){features.push(feature('countersink','drilling',g.faceIds,0.985,{axisPatternProven:true,topologyProven:true,coaxialCylinderCone:true,offAxisFromStock:true,diameterMm:cylR*2,countersinkDiameterMm:coneR*2,stockAxisOffsetMm:offset}));continue;}
      }
      const cylRadii=uniqueNumbers(g.cylinders.map(c=>Number(c.radius)).filter(r=>r>EPS),Math.max(R*0.001,0.02));
      if(align>=0.992&&cylRadii.length>=2){features.push(feature('counterbore','drilling',g.faceIds,0.98,{axisPatternProven:true,topologyProven:true,coaxialSteppedCylinders:true,offAxisFromStock:true,radiiMm:cylRadii,stockAxisOffsetMm:offset}));continue;}
      continue;
    }
    // The outer stock cylinder is intentionally ignored.  Toroidal faces or a
    // compact family of reduced coaxial radii on the central axis imply material
    // removal around the circumference (O-ring/annular groove or turned recess).
    const torusIds=g.tori.map(t=>t.id),reducedCyl=g.cylinders.filter(c=>Number(c.radius)>EPS&&Number(c.radius)<R-Math.max(R*0.02,0.08));
    if(torusIds.length>=1&&(reducedCyl.length>=1||g.tori.length>=2)){
      features.push(feature('annular-groove','milling',[...torusIds,...reducedCyl.map(c=>c.id)],0.985,{axisPatternProven:true,topologyProven:true,coaxialWithStock:true,stockAxisOffsetMm:offset,torusFaceCount:torusIds.length,reducedCylinderCount:reducedCyl.length}));
    }
  }
  return dedupeFeatures(features);
}

function recognizeRolledPlateFeatures({faceInfo,stock}){
  if(stock?.stockType!=='rolled-plate')return[];
  const axis=canonicalAxis(stock.axis),center=vec(stock.axisCenter),outer=Number(stock.outerDiameterMm)/2,inner=Number(stock.innerDiameterMm)/2,scale=Math.max(outer||0,inner||0,Number(stock.thicknessMm)||1,1);
  if(!axis||!center)return[];
  const groups=groupCylinders(cylinderRecords(faceInfo),scale*2),features=[];
  for(const g of groups){
    const align=Math.abs(V.dot(g.axis,axis)),sameLine=align>0.995&&axisLineDistance(center,axis,g.center)<=Math.max(scale*0.015,0.05),r=Math.max(...g.radii);
    if(sameLine&&(Math.abs(r-outer)<=Math.max(scale*0.015,0.05)||Math.abs(r-inner)<=Math.max(scale*0.015,0.05)))continue; // rolled OD/ID skins
    if(align<0.985)features.push(feature('cross-hole','drilling',g.faceIds,0.95,{diameterMm:r*2,rolledPlate:true}));
    else if(!sameLine)features.push(feature('offset-bore','drilling',g.faceIds,0.88,{diameterMm:r*2,rolledPlate:true}));
  }
  return dedupeFeatures(features);
}

function sheetFormingFaceIds(sheetResult){
  const ids=new Set();for(const id of sheetResult?.panelFaceIds||[])ids.add(Number(id));for(const b of sheetResult?.bendLines||[])for(const id of b?.sourceFaceIds||[])ids.add(Number(id));for(const sf of sheetResult?.selectionFaces||[])if(sf?.kind==='panel'||sf?.kind==='bend')for(const id of sf?.sourceFaceIds||[])ids.add(Number(id));return ids;
}
function recognizeExactChamfers({faceInfo,sheetResult,structuralProfile}={}){
  // DescribeExactChamfer is an OCCT topological feature descriptor, not a guess
  // from a sloped planar face. Keep forming panels/bend skins out of the feature
  // set so a press-brake wall cannot become a machined bevel.
  const forming=sheetFormingFaceIds(sheetResult),out=[];
  for(const f of faceInfo||[]){
    const id=Number(f.id);if(!Number.isFinite(id)||!f.chamfer||forming.has(id))continue;
    // On proven structural stock a catalog end bevel can be a cut condition; keep
    // it advisory unless the component is otherwise non-structural.
    const confidence=structuralProfile?0.90:0.995;
    out.push(feature('edge-chamfer','milling',[id],confidence,{exactChamfer:true,topologyProven:true,profile:String(f.chamfer.profile||''),variant:String(f.chamfer.variant||''),distanceA:Number(f.chamfer.distanceA)||null,distanceB:Number(f.chamfer.distanceB)||null,supportAngle:Number(f.chamfer.supportAngle)||null}));
  }
  return dedupeFeatures(out);
}

function recognizeGenericBarFeatures({faceInfo,stock,sheetResult}){
  if(!stock||['round-bar','plate-blank','sheet-metal','rolled-plate','structural-profile'].includes(stock.stockType)||sheetResult?.flatPlate)return[];const axis=canonicalAxis(stock.axis),features=[];if(!axis)return features;
  for(const f of faceInfo||[]){const family=fam(f.family),a=canonicalAxis(f.axisDirection);if(['cylinder','cylindrical'].includes(family)&&f.hole){const align=a?Math.abs(V.dot(a,axis)):0;features.push(feature(align<0.98?'cross-hole':'axial-bore','drilling',[Number(f.id)],f.hole.isThrough===false?0.99:0.97,{diameterMm:Number(f.radius)*2,exactHole:true,through:f.hole.isThrough}));}else if(f.compoundHole){const type=fam(f.compoundHole.family)==='countersink'?'countersink':'counterbore';features.push(feature(type,'drilling',[Number(f.id)],0.995,{exactCompoundHole:true}));}}
  return dedupeFeatures(features);
}


function plateSurfaceSignals(faceInfo=[],stock=null,sheetResult=null){
  const counts={plane:0,cylinder:0,cone:0,torus:0,other:0,blindCylinders:0,throughCylinders:0,partialCylinders:0,compoundHoles:0,exactChamfers:0};
  const thickness=Number(sheetResult?.thickness)||Number(stock?.thicknessMm)||null;
  for(const f of faceInfo||[]){
    const family=fam(f.family);
    if(family==='plane')counts.plane++;
    else if(['cylinder','cylindrical'].includes(family)){
      counts.cylinder++;
      if(f.hole?.isThrough===false)counts.blindCylinders++;
      if(f.hole?.isThrough===true)counts.throughCylinders++;
      const span=Number(f.axisSpan);
      if(Number.isFinite(span)&&Number.isFinite(thickness)&&thickness>EPS&&span<thickness*0.90)counts.partialCylinders++;
    }else if(['cone','conical'].includes(family))counts.cone++;
    else if(['torus','toroidal'].includes(family))counts.torus++;
    else counts.other++;
    if(f.compoundHole)counts.compoundHoles++;
    if(f.chamfer)counts.exactChamfers++;
  }
  return counts;
}
function computeNeedsMlReview({classification,capabilities,processes,features,signals,stock,confidence}){
  const directPlate=Boolean(capabilities?.directFlatDxf);
  const definiteFeatureCount=(features||[]).filter(f=>f.process!=='cutting').length;
  // V8.20.3: a deterministic constant-thickness plate with ONLY topologically
  // proven through-cuts must not be sent to AAGNet just because a large window
  // makes the stock-volume confidence low.  ML is advisory and can otherwise
  // hallucinate a giant rectangular/obround through opening as one or more
  // pockets, incorrectly promoting laser cutting to secondary machining.
  if(directPlate&&definiteFeatureCount===0&&!(signals?.torus>0)&&!(signals?.compoundHoles>0)&&!(signals?.blindCylinders>0)&&!(signals?.partialCylinders>0)&&!(signals?.cone>0))return false;
  if(stock?.stockType==='rolled-plate'&&Number(stock?.confidence)>=0.90)return false;
  // ML is a second opinion, not the source of truth. Ask for it only when the
  // local B-Rep engine sees an ambiguous instance-level pattern or when its
  // confidence is not strong enough for manufacturing semantics.
  if(Number(confidence)<0.94)return true;
  if(directPlate){
    if((signals?.torus||0)>0||(signals?.compoundHoles||0)>0||(signals?.blindCylinders||0)>0||(signals?.partialCylinders||0)>1)return definiteFeatureCount===0;
    const lowLevel=(features||[]).filter(f=>['cross-hole','pocket-floor','one-sided-recess'].includes(f.type));
    if(processes?.machining&&lowLevel.length===definiteFeatureCount&&definiteFeatureCount>0)return true;
    const throughFragments=(features||[]).filter(f=>['through-hole','cross-hole'].includes(f.type)).length;
    if(throughFragments>=2&&definiteFeatureCount>0)return true;
  }
  if(stock?.stockType==='round-bar'&&!processes?.turning&&Number(stock?.aspect)>=0.45&&(signals?.cylinder||0)>=2)return true;
  return false;
}

function dedupeFeatures(features){
  const out=[],seen=new Set();for(const f of features){const key=`${f.type}:${[...f.faceIds].sort((a,b)=>a-b).join(',')}`;if(seen.has(key))continue;seen.add(key);out.push(f);}return out;
}
function processSummary(features,{sheetResult,structuralProfile}={}){
  const p={cutting:false,bending:false,rolling:false,turning:false,drilling:false,milling:false,machining:false,profile:false};
  if(Number(sheetResult?.bendCount)>0)p.bending=true;
  if(sheetResult?.rolledPlate)p.rolling=true;
  if(sheetResult?.flatPlate)p.cutting=true;
  if(structuralProfile)p.profile=true;
  for(const f of features){if(f.process==='cutting')p.cutting=true;else if(f.process==='turning')p.turning=true;else if(f.process==='drilling')p.drilling=true;else if(f.process==='milling')p.milling=true;}
  p.machining=p.turning||p.drilling||p.milling;return p;
}
function evidenceFromFeatures(features,legacy,{stock=null}={}){
  const map={'turned-step':'turning','turned-groove':'groove','turned-groove-fillet':'groove','turned-chamfer-taper':'chamfering','turned-shoulder':'turning','axial-bore':'drilling','blind-axial-bore':'blind-hole','blind-hole':'blind-hole','counterbore':'counterbore','countersink':'counterbore','cross-hole':'drilling','offset-bore':'drilling','pocket-floor':'pocket','annular-groove':'groove','groove-fillet':'groove','countersink-chamfer':'chamfering','one-sided-recess':'pocket','edge-chamfer':'chamfering','through-hole':'through-hole'};
  const out=[];for(const f of features){const e=map[f.type];if(e)out.push(e);}if(stock?.stockType!=='rolled-plate'&&Number.isFinite(legacy?.materialRemoval)&&legacy.materialRemoval>0.003)out.push('material-removal');return[...new Set(out)];
}
function featureConfidence(features){if(!features.length)return 0;const machining=features.filter(f=>f.process!=='cutting');if(!machining.length)return 0;return machining.reduce((s,f)=>s+f.confidence,0)/machining.length;}
function strongRoundShaft(stock,processes,features){
  if(stock?.stockType!=='round-bar'||!processes.turning)return false;const aspect=Number(stock.aspect),conf=Number(stock.confidence),turningFeatures=features.filter(f=>f.process==='turning').length;return Number.isFinite(aspect)&&aspect>=0.45&&conf>=0.72&&turningFeatures>=1;
}
function compatibilityProjection(stock,legacy,processes,features,evidence){
  const base={...(legacy||{}),...(stock||{})};base.machined=Boolean(processes.machining);base.process=base.machined?'machining':'stock-profile';base.evidence=evidence;base.features={...(legacy?.features||{}),recognizedInstances:features.length,secondaryMachining:base.machined};return base;
}

export function buildManufacturingKnowledge({geometry,faceInfo=[],edgeInfo=[],sheetResult=null,structuralProfile=null,mlPrediction=null,componentName=null}={}){
  const aag=buildAttributedAdjacencyGraph(faceInfo,edgeInfo);
  const fastener=detectFastenerComponent({name:componentName||geometry?.name||'',geometry,faceInfo,edgeInfo});
  const fastenerConfidence=Number(fastener?.confidence)||0,fastenerNamed=String(fastener?.source||'').includes('name');
  // Hardware exclusion is deliberately asymmetric: a false positive can hide a
  // real fabricated gusset from DXF/analysis. Geometry-only hardware therefore
  // needs near-canonical proof; explicit Inventor/Content Center names may use a
  // slightly lower threshold because the B-Rep is still checked by the recognizer.
  if(fastener?.recognized&&(fastenerNamed?fastenerConfidence>=0.94:fastenerConfidence>=0.965)){
    const processes={cutting:false,bending:false,rolling:false,turning:false,drilling:false,milling:false,machining:false,profile:false,fastener:true};
    const stock={stockType:'fastener',fastenerType:fastener.type,lengthMm:Number(fastener.lengthMm)||null,diameterMm:Number(fastener.diameterMm)||null,confidence:Number(fastener.confidence)||0.95,source:fastener.source||'deterministic-fastener',fastener};
    return{
      kind:'manufacturing-knowledge',knowledgeVersion:9,classification:'fastener',stockType:'fastener',fastenerType:fastener.type,fastener,stock,
      lengthMm:stock.lengthMm,diameterMm:stock.diameterMm,confidence:stock.confidence,machined:false,process:'fastener',processes,
      capabilities:{unfold:false,export2dDxf:false,directFlatDxf:false,structuralProfile:false,rolledPlate:false,fastener:true},
      featureInstances:[],features:{recognizedInstances:0,secondaryMachining:false,definiteMachiningInstances:0,throughCutInstances:0},
      evidence:['fastener',...(fastener.evidence||[])],delta:{method:'not-applicable-fastener',estimatedRemovedVolumeMm3:null,featureCount:0,featureFaceIds:[]},
      aag:{nodeCount:aag.nodeCount,arcCount:aag.arcCount,strictConcaveEdgeCount:0,negativeVolumeCount:0},materialRemoval:null,
      diagnostics:{mre:true,fastener:true,needsMlReview:false,analysisPipeline:['brep-aag','fastener-metadata-prior','fastener-brep-signature','manufacturing-exclusion'],fastenerRecognizerVersion:FASTENER_RECOGNIZER_VERSION}
    };
  }
  let legacy=null;try{legacy=classifyManufacturingGeometry({geometry,faceInfo,edgeInfo});}catch{}
  const physicalSheetShell=Boolean(sheetResult?.ok&&Number(sheetResult?.bendCount)>0&&sheetResult?.diagnostics?.pairedBendEvidence?.ok&&sheetResult?.diagnostics?.pairedBendEvidence?.radiusThicknessClosure!==false);
  // A structural-profile object left in sheet diagnostics is a rejected competing
  // hypothesis, not manufacturing authority. Once Rext-Rint=T is proven on the
  // same gp_Ax1 over a topological bend, do not let that rejected profile leak
  // back into stock normalization and relabel the formed part as U/C/W/L.
  const effectiveStructuralProfile=physicalSheetShell?null:structuralProfile;
  // V8.24 — pre-stock Revolution Solver: compute gp_Ax1 turning proof BEFORE
  // stock normalisation so the round-bar stock can be synthesised even when the
  // tessellation envelope check in inferRoundStockFromFaces fails.  This is the
  // key fix for turned shafts (ST01-0002, ST04-0026/27/30) that previously
  // fell back to "Solide STEP" when coverage or envelopeError thresholds were
  // not met.
  const preStockTurning=(!effectiveStructuralProfile&&!sheetResult?.rolledPlate&&!(Number(sheetResult?.bendCount)>0))
    ?detectTurningByGpAx1(faceInfo):{recognized:false};
  const stock=normalizeStock({geometry,faceInfo,sheetResult,legacy,structuralProfile:effectiveStructuralProfile,revolutionHint:preStockTurning});
  const machiningEvidence=analyzeMachiningEvidence({aag,faceInfo,geometry,structuralProfile:effectiveStructuralProfile,sheetResult,stock});
  let features=[...(machiningEvidence.features||[])];
  // V8.24 — puck/flange solver: a round-bar stock with aspect < 0.45 (short,
  // fat disk) activates the secondary-feature recognizer that handles off-axis
  // bolt holes, countersinks and annular grooves via relational axis morphology.
  // Previously this was gated on sheetResult.flatPlate being true, which never
  // fires for real flanges/pucks because their perimeter is cylindrical (not a
  // laser-cut profile). The new condition accepts the puck context when either
  // flatPlate is detected OR the sheet analysis simply returned ok:false — the
  // round-bar + short-aspect proof is sufficient evidence of a puck geometry.
  const roundPlateContext=Boolean(
    stock?.stockType==='round-bar'&&Number(stock?.aspect)<0.45&&
    (sheetResult?.flatPlate||!sheetResult?.ok)
  );
  if(roundPlateContext)features.push(...recognizeRoundPlateSecondaryFeatures({faceInfo,stock}));
  else if(stock?.stockType!=='rolled-plate')features.push(...recognizeRoundFeatures({geometry,faceInfo,aag,stock}));
  features.push(...recognizePlateFeatures({geometry,faceInfo,aag,stock,sheetResult}));
  features.push(...recognizeRolledPlateFeatures({geometry,faceInfo,aag,stock,sheetResult}));
  features.push(...recognizeGenericBarFeatures({geometry,faceInfo,aag,stock,sheetResult}));
  features.push(...recognizeExactChamfers({faceInfo,sheetResult,structuralProfile:effectiveStructuralProfile}));
  const plateLikeContext=Boolean(sheetResult?.flatPlate||stock?.stockType==='plate-blank'||(stock?.stockType==='round-bar'&&Number(stock?.aspect)<0.45));
  // Arbitration occurs AFTER all local recognizers have spoken. A topologically
  // proven through-cut owns its wall faces and suppresses lower-level pocket /
  // cross-hole fragments generated from the same concave perimeter.
  features=suppressGenericMachiningFragmentsCoveredByThroughCuts(features,{plateContext:plateLikeContext});
  features=dedupeFeatures(features);
  const processes=processSummary(features,{sheetResult,structuralProfile:effectiveStructuralProfile});
  const suppressFlatDxf=strongRoundShaft(stock,processes,features);
  const structural=Boolean(effectiveStructuralProfile);
  const capabilities={
    // A proven structural profile has authority over local fillet cylinders that
    // happen to look like press-brake bend pairs.  Never expose unfold/DXF for it.
    unfold:Boolean(!structural&&sheetResult?.ok&&Number(sheetResult?.bendCount)>0),
    export2dDxf:Boolean(!structural&&sheetResult?.ok&&(Number(sheetResult?.bendCount)>0||sheetResult?.flatPlate)&&!suppressFlatDxf),
    directFlatDxf:Boolean(!structural&&sheetResult?.ok&&sheetResult?.flatPlate&&!suppressFlatDxf),
    structuralProfile:structural,
    rolledPlate:Boolean(sheetResult?.rolledPlate||stock?.stockType==='rolled-plate')
  };
  const evidence=evidenceFromFeatures(features,legacy,{stock}),compat=compatibilityProjection(stock,legacy,processes,features,evidence);
  const machineConfidence=featureConfidence(features),stockConfidence=Number(stock?.confidence)||0;
  let classification='solid';
  if(effectiveStructuralProfile)classification='structural-profile';
  else if(capabilities.unfold)classification='sheet-metal';
  else if(capabilities.directFlatDxf&&processes.machining)classification='cuttable-plate-machined';
  else if(capabilities.directFlatDxf)classification='cuttable-plate';
  else if(stock?.stockType==='rolled-plate')classification=processes.machining?'rolled-plate-machined':'rolled-plate';
  else if(processes.machining)classification='machined-part';
  else if(stock)classification='stock-profile';
  const estimatedRemovedVolumeMm3=Number.isFinite(Number(legacy?.stockVolume))&&Number.isFinite(Number(legacy?.materialRemoval))
    ? Math.max(0,Number(legacy.stockVolume)*Number(legacy.materialRemoval)):null;
  const delta={
    method:Number.isFinite(estimatedRemovedVolumeMm3)?'stock-minus-part-volume-estimate':'brep-feature-decomposition',
    estimatedRemovedVolumeMm3,featureCount:features.filter(f=>f.process!=='cutting').length,
    featureFaceIds:[...new Set(features.filter(f=>f.process!=='cutting').flatMap(f=>f.faceIds))]
  };
  const signals=plateSurfaceSignals(faceInfo,stock,sheetResult);
  const localConfidence=clamp(Math.max(stockConfidence,machineConfidence*0.96));
  const base={
    ...compat,
    kind:'manufacturing-knowledge',knowledgeVersion:9,classification,stock:stock||null,capabilities,processes,featureInstances:features,delta,
    aag:{nodeCount:aag.nodeCount,arcCount:aag.arcCount,strictConcaveEdgeCount:Number(machiningEvidence?.negativeVolumes?.strictConcaveEdgeCount)||0,negativeVolumeCount:Number(machiningEvidence?.negativeVolumes?.count)||0},
    confidence:localConfidence,
    diagnostics:{...(legacy?.diagnostics||{}),mre:true,suppressFlatDxf,stockConfidence,machiningConfidence:machineConfidence,surfaceSignals:signals,
      analysisPipeline:['brep-aag','strict-concave-transition-proof','virtual-negative-volumes','same-domain-healing','commercial-stock-prior','stock-hypothesis','instance-through-cut-proof','blind-hole-pocket-groove-proof','gp-ax1-turning-proof','removal-feature-decomposition','canonical-manufacturing-arbitration'],
      machiningEvidence:{negativeVolumes:machiningEvidence?.negativeVolumes||null,turning:machiningEvidence?.turning||null},machiningEvidenceVersion:MACHINING_EVIDENCE_VERSION,
      rawStockKnowledgeVersion:RAW_STOCK_KNOWLEDGE_VERSION,criticalArbitratorVersion:CRITICAL_ARBITRATOR_VERSION,physicalSheetShellAuthority:physicalSheetShell}
  };
  base.diagnostics.needsMlReview=computeNeedsMlReview({classification,capabilities,processes,features,signals,stock,confidence:localConfidence});
  const finalKnowledge=arbitrateManufacturingKnowledge(base,{sheetResult,mlPrediction,machiningEvidence});
  finalKnowledge.classification=finalKnowledge.capabilities?.structuralProfile?'structural-profile':
    finalKnowledge.capabilities?.unfold?'sheet-metal':
    finalKnowledge.capabilities?.directFlatDxf&&finalKnowledge.processes?.machining?'cuttable-plate-machined':
    finalKnowledge.capabilities?.directFlatDxf?'cuttable-plate':
    finalKnowledge.stock?.stockType==='rolled-plate'?(finalKnowledge.processes?.machining?'rolled-plate-machined':'rolled-plate'):
    finalKnowledge.stock?.stockType==='plate-blank'&&finalKnowledge.processes?.machining?'plate-machined':
    finalKnowledge.processes?.machining?'machined-part':
    finalKnowledge.stock?'stock-profile':'solid';
  finalKnowledge.diagnostics={...(finalKnowledge.diagnostics||{}),needsMlReview:Boolean(base.diagnostics.needsMlReview&&!mlPrediction?.ok)};
  return finalKnowledge;
}

export function applyManufacturingMlPrediction(knowledge,{sheetResult=null,mlPrediction=null}={}){
  if(!knowledge||!mlPrediction?.ok)return knowledge;
  const out=arbitrateManufacturingKnowledge(knowledge,{sheetResult,mlPrediction,machiningEvidence:knowledge?.diagnostics?.machiningEvidence||null});
  out.classification=out.capabilities?.structuralProfile?'structural-profile':out.capabilities?.unfold?'sheet-metal':out.capabilities?.directFlatDxf&&out.processes?.machining?'cuttable-plate-machined':out.capabilities?.directFlatDxf?'cuttable-plate':out.stock?.stockType==='rolled-plate'?(out.processes?.machining?'rolled-plate-machined':'rolled-plate'):out.stock?.stockType==='plate-blank'&&out.processes?.machining?'plate-machined':out.processes?.machining?'machined-part':out.stock?'stock-profile':'solid';
  out.confidence=clamp(Math.max(Number(out.confidence)||0,Number(mlPrediction.confidence)||0));
  out.diagnostics={...(out.diagnostics||{}),needsMlReview:false,mlReviewed:true};
  return out;
}
