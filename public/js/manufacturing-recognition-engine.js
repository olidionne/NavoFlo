/* NavoFlo V8.19.0 — Manufacturing Recognition Engine (MRE)
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
import { classifyManufacturingGeometry } from './manufacturing-classifier.js?v=8.19.0';

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
    axisSpan:Number.isFinite(Number(f.axisSpan))?Number(f.axisSpan):null,hole:f.hole||null,neighbors:new Set((f.neighborFaceIds||[]).map(Number))
  });
  const arcs=[];
  for(const e of edgeInfo||[]){
    const owners=(e.ownerFaceIds||[]).map(Number).filter(Number.isFinite);const edge={id:Number(e.id),family:fam(e.family),length:Number(e.length)||0,owners};
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

function normalizeStock({geometry,faceInfo,sheetResult,legacy,structuralProfile}){
  if(structuralProfile)return{stockType:'structural-profile',profile:structuralProfile,confidence:Number(structuralProfile?.confidence)||0.9,source:'structural-profile'};
  if(Number(sheetResult?.bendCount)>0)return{stockType:'sheet-metal',thicknessMm:Number(sheetResult.thickness)||null,confidence:0.99,source:'sheet-metal-brep'};
  const round=inferRoundStockFromFaces(geometry,faceInfo);
  // Prefer a strong round envelope over a weak plate/box hypothesis.  This is
  // essential for turned shafts with two planar end faces.
  if(round&&(!legacy||legacy.stockType==='plate-blank'||round.confidence>(Number(legacy.confidence)||0)-0.02)){
    const merged={...legacy,...round};return merged;
  }
  if(legacy)return{...legacy};
  if(sheetResult?.flatPlate)return derivePlateStock(geometry,faceInfo,sheetResult,null);
  return round||null;
}

function plateContext(stock,sheetResult,faceInfo){
  if(!stock)return null;let normal=null,t=null;
  if(stock.stockType==='plate-blank'){normal=canonicalAxis(stock.axis);t=Number(stock.thicknessMm);}
  if(!normal&&sheetResult?.flatPlate){const pair=majorPlanePair(faceInfo);if(pair){normal=pair.normal;t=pair.thickness;}}
  if(!normal||!(t>EPS))return null;return{normal,thickness:t};
}

function recognizePlateFeatures({geometry,faceInfo,aag,stock,sheetResult}){
  const ctx=plateContext(stock,sheetResult,faceInfo);if(!ctx)return[];const {normal,thickness}=ctx,scale=Math.max(thickness,1),cyls=cylinderRecords(faceInfo),groups=groupCylinders(cyls,scale),features=[];
  const faceById=new Map((faceInfo||[]).map(f=>[Number(f.id),f]));
  for(const g of groups){
    const align=Math.abs(V.dot(g.axis,normal));
    const neighbor=neighborFamilies(aag,g.faceIds),coneNeighbors=neighbor.neighborIds.filter(id=>fam(faceById.get(id)?.family)==='cone'),torusNeighbors=neighbor.neighborIds.filter(id=>fam(faceById.get(id)?.family)==='torus');
    if(align>=0.985){
      const spans=g.members.map(m=>m.span).filter(Number.isFinite),maxSpan=spans.length?Math.max(...spans):g.span,explicitThrough=g.members.some(m=>m.hole?.isThrough===true),explicitBlind=g.members.some(m=>m.hole&&m.hole.isThrough===false);
      const spanRatio=Number.isFinite(maxSpan)?maxSpan/Math.max(thickness,EPS):null,full=explicitThrough||(Number.isFinite(spanRatio)&&spanRatio>=0.92),partial=explicitBlind||(Number.isFinite(spanRatio)&&spanRatio<0.90);
      const compound=g.members.map(m=>m.face?.compoundHole).find(x=>x&&['counterbore','countersink'].includes(fam(x.family)));
      if(compound&&fam(compound.family)==='counterbore'){
        features.push(feature('counterbore','drilling',g.faceIds.concat(coneNeighbors),0.995,{holeDiameterMm:Number(compound.holeDiameter),counterboreDiameterMm:Number(compound.counterboreDiameter),counterboreDepthMm:Number(compound.counterboreDepth),through:compound.isThrough===true?true:compound.isThrough===false?false:null}));
      }else if(compound&&fam(compound.family)==='countersink'){
        features.push(feature('countersink','drilling',g.faceIds.concat(coneNeighbors),0.995,{holeDiameterMm:Number(compound.holeDiameter),countersinkDiameterMm:Number(compound.countersinkDiameter),countersinkAngleRad:Number(compound.countersinkAngle),through:compound.isThrough===true?true:compound.isThrough===false?false:null}));
      }else if(g.radii.length>=2){
        features.push(feature('counterbore','drilling',g.faceIds.concat(coneNeighbors),0.96,{radiiMm:g.radii,spanRatio}));
      }else if(partial){
        features.push(feature('blind-hole','drilling',g.faceIds,0.95,{diameterMm:g.radii[0]*2,spanRatio}));
      }else if(coneNeighbors.length){
        features.push(feature('countersink','drilling',g.faceIds.concat(coneNeighbors),0.94,{diameterMm:g.radii[0]*2,spanRatio}));
      }else if(full){
        // A plain through contour is compatible with laser/plasma/waterjet and
        // therefore does not, by itself, prove machining on a cuttable plate.
        features.push(feature('through-hole','cutting',g.faceIds,0.90,{diameterMm:g.radii[0]*2,spanRatio}));
      }
      if(torusNeighbors.length)features.push(feature('annular-groove','milling',g.faceIds.concat(torusNeighbors),0.95,{radiiMm:g.radii}));
    }else{
      features.push(feature('cross-hole','drilling',g.faceIds,0.95,{diameterMm:g.radii[0]*2,axis:g.axis}));
    }
  }

  // Interior planes parallel to the plate skins are pocket floors / recesses.
  const planes=(faceInfo||[]).filter(f=>fam(f.family)==='plane').map(f=>({f,n:canonicalAxis(f.localNormal),c:vec(f.localCentroid)||vec(f.localCenter)})).filter(x=>x.n&&x.c);
  const parallel=planes.filter(p=>Math.abs(V.dot(p.n,normal))>0.995),vals=parallel.map(p=>V.dot(p.c,normal));if(vals.length>=2){
    const lo=Math.min(...vals),hi=Math.max(...vals),tol=Math.max(thickness*0.04,1e-4);
    for(const p of parallel){const d=V.dot(p.c,normal);if(d>lo+tol&&d<hi-tol)features.push(feature('pocket-floor','milling',[Number(p.f.id)],0.92,{depthPosition:d}));}
  }
  // Tori are never created by a pure 2D profile cut.  Treat them as strong
  // secondary-machining evidence unless already attached to a recognized groove.
  const used=new Set(features.flatMap(f=>f.faceIds));for(const f of faceInfo||[]){if(fam(f.family)==='torus'&&!used.has(Number(f.id)))features.push(feature('groove-fillet','milling',[Number(f.id)],0.88,{}));}
  return dedupeFeatures(features);
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

function recognizeGenericBarFeatures({faceInfo,stock,sheetResult}){
  if(!stock||['round-bar','plate-blank','sheet-metal','structural-profile'].includes(stock.stockType)||sheetResult?.flatPlate)return[];const axis=canonicalAxis(stock.axis),features=[];if(!axis)return features;
  for(const f of faceInfo||[]){const family=fam(f.family),a=canonicalAxis(f.axisDirection);if(['cylinder','cylindrical'].includes(family)){const align=a?Math.abs(V.dot(a,axis)):0;features.push(feature(align<0.98?'cross-hole':'axial-bore','drilling',[Number(f.id)],0.90,{diameterMm:Number(f.radius)*2}));}else if(family==='cone')features.push(feature('chamfer-countersink','drilling',[Number(f.id)],0.82,{}));else if(family==='torus')features.push(feature('groove-fillet','milling',[Number(f.id)],0.86,{}));}
  return dedupeFeatures(features);
}

function dedupeFeatures(features){
  const out=[],seen=new Set();for(const f of features){const key=`${f.type}:${[...f.faceIds].sort((a,b)=>a-b).join(',')}`;if(seen.has(key))continue;seen.add(key);out.push(f);}return out;
}
function processSummary(features,{sheetResult,structuralProfile}={}){
  const p={cutting:false,bending:false,turning:false,drilling:false,milling:false,machining:false,profile:false};
  if(Number(sheetResult?.bendCount)>0)p.bending=true;
  if(sheetResult?.flatPlate)p.cutting=true;
  if(structuralProfile)p.profile=true;
  for(const f of features){if(f.process==='cutting')p.cutting=true;else if(f.process==='turning')p.turning=true;else if(f.process==='drilling')p.drilling=true;else if(f.process==='milling')p.milling=true;}
  p.machining=p.turning||p.drilling||p.milling;return p;
}
function evidenceFromFeatures(features,legacy){
  const map={'turned-step':'turning','turned-groove':'groove','turned-groove-fillet':'groove','turned-chamfer-taper':'chamfering','turned-shoulder':'turning','axial-bore':'drilling','blind-axial-bore':'blind-hole','blind-hole':'blind-hole','counterbore':'counterbore','countersink':'counterbore','cross-hole':'drilling','offset-bore':'drilling','pocket-floor':'pocket','annular-groove':'groove','groove-fillet':'groove','countersink-chamfer':'chamfering','through-hole':'through-hole'};
  const out=[];for(const f of features){const e=map[f.type];if(e)out.push(e);}if(Number.isFinite(legacy?.materialRemoval)&&legacy.materialRemoval>0.003)out.push('material-removal');return[...new Set(out)];
}
function featureConfidence(features){if(!features.length)return 0;const machining=features.filter(f=>f.process!=='cutting');if(!machining.length)return 0;return machining.reduce((s,f)=>s+f.confidence,0)/machining.length;}
function strongRoundShaft(stock,processes,features){
  if(stock?.stockType!=='round-bar'||!processes.turning)return false;const aspect=Number(stock.aspect),conf=Number(stock.confidence),turningFeatures=features.filter(f=>f.process==='turning').length;return Number.isFinite(aspect)&&aspect>=0.45&&conf>=0.72&&turningFeatures>=1;
}
function compatibilityProjection(stock,legacy,processes,features,evidence){
  const base={...(legacy||{}),...(stock||{})};base.machined=Boolean(processes.machining);base.process=base.machined?'machining':'stock-profile';base.evidence=evidence;base.features={...(legacy?.features||{}),recognizedInstances:features.length,secondaryMachining:base.machined};return base;
}

export function buildManufacturingKnowledge({geometry,faceInfo=[],edgeInfo=[],sheetResult=null,structuralProfile=null}={}){
  const aag=buildAttributedAdjacencyGraph(faceInfo,edgeInfo);let legacy=null;try{legacy=classifyManufacturingGeometry({geometry,faceInfo,edgeInfo});}catch{}
  const stock=normalizeStock({geometry,faceInfo,sheetResult,legacy,structuralProfile});
  let features=[];
  const roundPlateContext=Boolean(sheetResult?.flatPlate&&stock?.stockType==='round-bar'&&Number(stock?.aspect)<0.45);
  if(!roundPlateContext)features.push(...recognizeRoundFeatures({geometry,faceInfo,aag,stock}));
  features.push(...recognizePlateFeatures({geometry,faceInfo,aag,stock,sheetResult}));
  features.push(...recognizeGenericBarFeatures({geometry,faceInfo,aag,stock,sheetResult}));
  features=dedupeFeatures(features);
  const processes=processSummary(features,{sheetResult,structuralProfile});
  const suppressFlatDxf=strongRoundShaft(stock,processes,features);
  const capabilities={
    unfold:Boolean(sheetResult?.ok&&Number(sheetResult?.bendCount)>0),
    export2dDxf:Boolean(sheetResult?.ok&&(Number(sheetResult?.bendCount)>0||sheetResult?.flatPlate)&&!suppressFlatDxf),
    directFlatDxf:Boolean(sheetResult?.ok&&sheetResult?.flatPlate&&!suppressFlatDxf),
    structuralProfile:Boolean(structuralProfile)
  };
  const evidence=evidenceFromFeatures(features,legacy),compat=compatibilityProjection(stock,legacy,processes,features,evidence);
  const machineConfidence=featureConfidence(features),stockConfidence=Number(stock?.confidence)||0;
  let classification='solid';
  if(capabilities.unfold)classification='sheet-metal';
  else if(structuralProfile)classification='structural-profile';
  else if(capabilities.directFlatDxf&&processes.machining)classification='cuttable-plate-machined';
  else if(capabilities.directFlatDxf)classification='cuttable-plate';
  else if(processes.machining)classification='machined-part';
  else if(stock)classification='stock-profile';
  const estimatedRemovedVolumeMm3=Number.isFinite(Number(legacy?.stockVolume))&&Number.isFinite(Number(legacy?.materialRemoval))
    ? Math.max(0,Number(legacy.stockVolume)*Number(legacy.materialRemoval)):null;
  const delta={
    method:Number.isFinite(estimatedRemovedVolumeMm3)?'stock-minus-part-volume-estimate':'brep-feature-decomposition',
    estimatedRemovedVolumeMm3,featureCount:features.filter(f=>f.process!=='cutting').length,
    featureFaceIds:[...new Set(features.filter(f=>f.process!=='cutting').flatMap(f=>f.faceIds))]
  };
  return{
    ...compat,
    kind:'manufacturing-knowledge',knowledgeVersion:1,classification,stock:stock||null,capabilities,processes,featureInstances:features,delta,
    aag:{nodeCount:aag.nodeCount,arcCount:aag.arcCount},
    confidence:clamp(Math.max(stockConfidence,machineConfidence*0.96)),
    diagnostics:{...(legacy?.diagnostics||{}),mre:true,suppressFlatDxf,stockConfidence,machiningConfidence:machineConfidence,analysisPipeline:['brep-aag','stock-hypothesis','removal-feature-decomposition','capability-process-arbitration']}
  };
}
