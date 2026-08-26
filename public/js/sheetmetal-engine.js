/*
 * NavoFlo Sheet Metal Engine — V8.16 MVP
 * Clean-room implementation using STEP tessellation/topology already produced by
 * occt-js plus exact surface metadata returned by the NavoFlo CAD worker.
 *
 * Supported intentionally in this first production-candidate MVP:
 * - one connected constant-thickness sheet-metal skin
 * - planar flanges connected by cylindrical bends
 * - standard bends below 180°
 * - holes / cut-outs carried by the original face tessellation
 * - multiple bends through a spanning-tree unfold
 *
 * Unsupported cases are reported instead of silently approximated.
 */

const EPS=1e-9;
const TAU=Math.PI*2;

const V3={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  unit(a){const l=this.len(a);return l>EPS?this.scale(a,1/l):null;},
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),
  avg(points){if(!points.length)return[0,0,0];const s=points.reduce((o,p)=>this.add(o,p),[0,0,0]);return this.scale(s,1/points.length);}
};
const V2={
  add:(a,b)=>[a[0]+b[0],a[1]+b[1]],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1]],
  scale:(a,s)=>[a[0]*s,a[1]*s],
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1],
  len:a=>Math.hypot(a[0],a[1]),
  unit(a){const l=this.len(a);return l>EPS?this.scale(a,1/l):null;},
  perp:a=>[-a[1],a[0]],
  dist:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])
};

function clamp(v,a,b){return Math.min(b,Math.max(a,v));}
function median(values){if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function family(v){return String(v||'').toLowerCase();}
function isPlanar(v){return ['plane','planar'].includes(family(v));}
function isCyl(v){return ['cylinder','cylindrical'].includes(family(v));}
function p3FromArray(arr,i){return [Number(arr[i])||0,Number(arr[i+1])||0,Number(arr[i+2])||0];}
function edgePoints(edge){const a=edge?.points||[];const out=[];for(let i=0;i+2<a.length;i+=3)out.push(p3FromArray(a,i));return out;}

function geometryScale(geometry){
  const p=geometry?.positions||[];if(p.length<3)return{diag:1,tol:1e-6};
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i+2<p.length;i+=3){for(let k=0;k<3;k++){const v=Number(p[i+k]);if(v<min[k])min[k]=v;if(v>max[k])max[k]=v;}}
  const diag=Math.max(V3.dist(min,max),1e-3);return{diag,tol:Math.max(diag*1e-6,1e-7)};
}

function trianglesForFace(geometry,face){
  const pos=geometry.positions,idx=geometry.indices,out=[];
  const start=Math.max(0,Number(face.firstIndex)||0),end=Math.min(idx.length,start+(Number(face.indexCount)||0));
  for(let i=start;i+2<end;i+=3){
    const ia=Number(idx[i])*3,ib=Number(idx[i+1])*3,ic=Number(idx[i+2])*3;
    out.push([p3FromArray(pos,ia),p3FromArray(pos,ib),p3FromArray(pos,ic)]);
  }
  return out;
}

function faceStats(geometry,face){
  const tris=trianglesForFace(geometry,face);let area2Sum=0,centroid=[0,0,0],normalSum=[0,0,0];
  for(const [a,b,c] of tris){const cr=V3.cross(V3.sub(b,a),V3.sub(c,a)),a2=V3.len(cr);if(a2<EPS)continue;const tc=V3.scale(V3.add(V3.add(a,b),c),1/3);centroid=V3.add(centroid,V3.scale(tc,a2));normalSum=V3.add(normalSum,cr);area2Sum+=a2;}
  if(area2Sum>EPS)centroid=V3.scale(centroid,1/area2Sum);else centroid=[0,0,0];
  const normal=V3.unit(normalSum)||[0,0,1];
  return{triangles:tris,area:area2Sum/2,centroid,normal};
}

function isStraightEdge(edge,tol){
  const pts=edgePoints(edge);if(pts.length<2)return false;const a=pts[0],b=pts.at(-1),ab=V3.sub(b,a),len=V3.len(ab);if(len<EPS)return false;const u=V3.scale(ab,1/len);
  let maxErr=0;for(const p of pts){const ap=V3.sub(p,a),t=V3.dot(ap,u),q=V3.add(a,V3.scale(u,t));maxErr=Math.max(maxErr,V3.dist(p,q));}
  return maxErr<=Math.max(tol*5,len*1e-5);
}
function straightEdgeDirection(edge){const pts=edgePoints(edge);if(pts.length<2)return null;return V3.unit(V3.sub(pts.at(-1),pts[0]));}
function straightEdgeLength(edge){const pts=edgePoints(edge);if(pts.length<2)return 0;return V3.dist(pts[0],pts.at(-1));}

function lineDistanceParallel(c1,a,c2){const d=V3.sub(c2,c1),parallel=V3.scale(a,V3.dot(d,a));return V3.len(V3.sub(d,parallel));}
function sameAxisLine(a,b,tol){
  if(!a?.axis||!b?.axis||!a?.center||!b?.center)return false;
  if(Math.abs(V3.dot(a.axis,b.axis))<0.9998)return false;
  return lineDistanceParallel(a.center,a.axis,b.center)<=Math.max(tol*10,Math.max(a.radius||0,b.radius||0,1)*1e-5);
}
function compatibleAxisLine(a,b,tol,thickness=0){
  if(!a?.axis||!b?.axis||!a?.center||!b?.center)return false;
  if(Math.abs(V3.dot(a.axis,b.axis))<0.997)return false;
  const radialTol=Math.max(tol*80,Math.max(a.radius||0,b.radius||0,1)*5e-4,Number(thickness||0)*0.12);
  return lineDistanceParallel(a.center,a.axis,b.center)<=radialTol;
}
function radialToAxis(point,center,axis){const d=V3.sub(point,center),q=V3.add(center,V3.scale(axis,V3.dot(d,axis)));return V3.sub(point,q);}
function signedAngle(a,b,axis){const ua=V3.unit(a),ub=V3.unit(b);if(!ua||!ub)return 0;return Math.atan2(V3.dot(axis,V3.cross(ua,ub)),clamp(V3.dot(ua,ub),-1,1));}
function angleCandidateInSpan(phi,total){
  const candidates=[phi,phi+TAU,phi-TAU];const lo=Math.min(0,total),hi=Math.max(0,total);
  const distance=v=>v<lo?lo-v:(v>hi?v-hi:0);
  return candidates.sort((a,b)=>distance(a)-distance(b))[0];
}

function buildFaceContext(geometry,faceInfo,edgeInfo=[]){
  const faceById=new Map((geometry.faces||[]).map(f=>[Number(f.id),f]));
  const edgeById=new Map((geometry.edges||[]).map(e=>[Number(e.id),e]));
  const infoById=new Map((faceInfo||[]).map(f=>[Number(f.id),f]));
  const edgeInfoById=new Map((edgeInfo||[]).map(e=>[Number(e.id),e]));
  const statsById=new Map(),edgeOwnersById=new Map();
  for(const face of geometry.faces||[]){
    const fid=Number(face.id),info=infoById.get(fid)||{},stats=faceStats(geometry,face);
    // NavoUnfold is a B-Rep operation: when the STEP worker provides exact OCCT
    // centroid/normal data, use it instead of inferring the plane from tessellation.
    // This is especially important on large sheet faces whose mesh winding may be
    // split/reversed independently by the STEP importer.
    const exactCentroid=Array.isArray(info.localCentroid)?info.localCentroid.map(Number).slice(0,3):null;
    const exactNormal=V3.unit(Array.isArray(info.localNormal)?info.localNormal.map(Number).slice(0,3):[]);
    if(exactCentroid?.length===3&&exactCentroid.every(Number.isFinite))stats.centroid=exactCentroid;
    if(exactNormal)stats.normal=exactNormal;
    if(Number.isFinite(Number(info.area))&&Number(info.area)>EPS)stats.area=Number(info.area);
    statsById.set(fid,stats);
    for(const rawEid of face.edgeIndices||[]){const eid=Number(rawEid);if(!edgeOwnersById.has(eid))edgeOwnersById.set(eid,new Set());edgeOwnersById.get(eid).add(fid);}
  }
  for(const edge of geometry.edges||[]){const eid=Number(edge.id);if(!edgeOwnersById.has(eid))edgeOwnersById.set(eid,new Set());for(const rawOwner of edge.ownerFaceIds||[])edgeOwnersById.get(eid).add(Number(rawOwner));}
  return{faceById,edgeById,infoById,edgeInfoById,statsById,edgeOwnersById};
}

function coplanarFaceStats(a,b,tol){
  if(!a||!b)return false;const na=V3.unit(a.normal),nb=V3.unit(b.normal);if(!na||!nb)return false;
  if(Math.abs(V3.dot(na,nb))<0.9995)return false;
  const d=V3.sub(b.centroid,a.centroid),planeGap=Math.abs(V3.dot(d,na));
  return planeGap<=Math.max(tol*25,1e-7);
}

function combinePanelStats(ctx,faceIds){
  let area=0,centroid=[0,0,0],normal=[0,0,0],refNormal=null;
  for(const fid of faceIds){const st=ctx.statsById.get(fid);if(!st)continue;const w=Math.max(st.area,EPS);if(!refNormal)refNormal=st.normal;const sign=refNormal&&V3.dot(st.normal,refNormal)<0?-1:1;area+=w;centroid=V3.add(centroid,V3.scale(st.centroid,w));normal=V3.add(normal,V3.scale(st.normal,w*sign));}
  if(area>EPS)centroid=V3.scale(centroid,1/area);return{area,centroid,normal:V3.unit(normal)||refNormal||[0,0,1]};
}

function buildPlanarGroups(geometry,ctx,tol){
  const planarIds=(geometry.faces||[]).map(f=>Number(f.id)).filter(fid=>isPlanar(ctx.infoById.get(fid)?.family));
  const planarSet=new Set(planarIds),neighbors=new Map(planarIds.map(id=>[id,new Set()]));
  for(const ownersSet of ctx.edgeOwnersById.values()){
    const owners=[...ownersSet].filter(id=>planarSet.has(id));
    for(let i=0;i<owners.length;i++)for(let j=i+1;j<owners.length;j++){
      const a=owners[i],b=owners[j];if(coplanarFaceStats(ctx.statsById.get(a),ctx.statsById.get(b),tol)){neighbors.get(a).add(b);neighbors.get(b).add(a);}
    }
  }
  const groups=[],faceToGroup=new Map(),seen=new Set();
  for(const start of planarIds){if(seen.has(start))continue;const faceIds=[],queue=[start];seen.add(start);
    while(queue.length){const id=queue.shift();faceIds.push(id);for(const n of neighbors.get(id)||[]){if(!seen.has(n)){seen.add(n);queue.push(n);}}}
    const group={id:`panel-${groups.length}`,faceIds,faceSet:new Set(faceIds),stats:combinePanelStats(ctx,faceIds)};groups.push(group);for(const fid of faceIds)faceToGroup.set(fid,group.id);
  }
  const byId=new Map(groups.map(g=>[g.id,g]));return{groups,byId,faceToGroup};
}

function buildCylinderGroups(geometry,ctx,logicalGroups,tol,planarGroups){
  const grouped=new Set(),groups=[];
  for(const raw of logicalGroups||[]){
    const ids=(raw.faceIds||[]).map(Number).filter(id=>isCyl(ctx.infoById.get(id)?.family));
    if(!ids.length)continue;ids.forEach(id=>grouped.add(id));groups.push(ids);
  }
  for(const face of geometry.faces||[]){const id=Number(face.id);if(!grouped.has(id)&&isCyl(ctx.infoById.get(id)?.family))groups.push([id]);}

  return groups.map((faceIds,index)=>{
    const first=ctx.infoById.get(faceIds[0])||{},axis=V3.unit(first.axisDirection||first.localAxisDirection||[])||null,center=(first.center||first.localCenter||[]).map(Number).slice(0,3),radius=Number(first.radius);
    if(!axis||center.length<3||!Number.isFinite(radius))return null;
    const faceSet=new Set(faceIds),edgeIds=new Set();for(const fid of faceIds){for(const eid of ctx.faceById.get(fid)?.edgeIndices||[])edgeIds.add(Number(eid));}
    const neighborEdges=new Map();
    for(const eid of edgeIds){
      const edge=ctx.edgeById.get(eid);if(!edge||!isStraightEdge(edge,tol))continue;
      const edir=straightEdgeDirection(edge);if(!edir||Math.abs(V3.dot(edir,axis))<0.985)continue;
      for(const owner of ctx.edgeOwnersById.get(eid)||[]){
        const oid=Number(owner);if(faceSet.has(oid)||!isPlanar(ctx.infoById.get(oid)?.family))continue;const groupId=planarGroups.faceToGroup.get(oid);if(!groupId)continue;
        if(!neighborEdges.has(groupId))neighborEdges.set(groupId,new Map());neighborEdges.get(groupId).set(eid,edge);
      }
    }
    const boundaries=[];
    for(const [groupId,edgeMap] of neighborEdges){
      const edges=[...edgeMap.values()],panel=planarGroups.byId.get(groupId),points=edges.flatMap(edgePoints);if(points.length<2||!panel)continue;
      const mid=V3.avg(points),offsets=points.map(p=>V3.dot(V3.sub(p,mid),axis)),axisMid=V3.dot(mid,axis),axisValues=points.map(p=>V3.dot(p,axis));
      boundaries.push({groupId,faceIds:panel.faceIds.slice(),faceId:panel.faceIds[0],edges:edges.map(e=>Number(e.id)),mid,minOffset:Math.min(...offsets),maxOffset:Math.max(...offsets),axisMid,axisMin:Math.min(...axisValues),axisMax:Math.max(...axisValues),length:edges.reduce((s,e)=>s+straightEdgeLength(e),0),points});
    }
    boundaries.sort((a,b)=>b.length-a.length);
    let orientWeighted=0,orientArea=0;
    for(const fid of faceIds){
      const st=ctx.statsById.get(fid);if(!st||!(st.area>EPS))continue;
      const radial=V3.unit(radialToAxis(st.centroid,center,axis));if(!radial)continue;
      orientWeighted+=clamp(V3.dot(st.normal,radial),-1,1)*st.area;orientArea+=st.area;
    }
    const radialNormalScore=orientArea>EPS?orientWeighted/orientArea:NaN;
    return{id:`cyl-${index}`,faceIds,faceSet,edgeIds:[...edgeIds],axis,center,radius,boundaries,radialNormalScore};
  }).filter(Boolean);
}

function detectThickness(cylinders,tol){
  const nearest=[];
  for(let i=0;i<cylinders.length;i++){
    let best=Infinity;
    for(let j=0;j<cylinders.length;j++){if(i===j)continue;const a=cylinders[i],b=cylinders[j];if(!sameAxisLine(a,b,tol))continue;const d=Math.abs(a.radius-b.radius);if(d>tol*5&&d<best)best=d;}
    if(Number.isFinite(best))nearest.push(best);
  }
  if(!nearest.length)return null;
  const seed=median(nearest);if(!Number.isFinite(seed))return null;
  const band=Math.max(seed*0.08,tol*20),cluster=nearest.filter(v=>Math.abs(v-seed)<=band),value=median(cluster.length?cluster:nearest);
  return{value,count:cluster.length||nearest.length,samples:nearest.length,confidence:(cluster.length||nearest.length)/nearest.length};
}

function cylinderPartner(cyl,cylinders,thickness,tol){
  if(!Number.isFinite(thickness)||thickness<=0)return null;let best=null;
  for(const other of cylinders){
    if(other===cyl||!compatibleAxisLine(cyl,other,tol,thickness))continue;
    const diff=Math.abs(cyl.radius-other.radius),err=Math.abs(diff-thickness);
    const axisPenalty=(1-Math.abs(V3.dot(cyl.axis,other.axis)))*thickness*5;
    const linePenalty=lineDistanceParallel(cyl.center,cyl.axis,other.center);
    const score=err+axisPenalty+linePenalty;
    if(!best||score<best.score)best={other,diff,err,score};
  }
  const allowed=Math.max(thickness*0.30,tol*80);return best&&best.err<=allowed?best:null;
}

function resolveInsideRadius(cyl,cylinders,thickness,tol,fallbackRadius){
  const partner=cylinderPartner(cyl,cylinders,thickness,tol);
  if(partner){
    return{ok:true,value:Math.min(cyl.radius,partner.other.radius),source:'paired-cylinders',partner};
  }
  const fallback=fallbackRadius==null?NaN:Number(fallbackRadius);
  if(Number.isFinite(fallback)&&fallback>=0)return{ok:true,value:fallback,source:'user-radius',partner:null};
  const score=Number(cyl.radialNormalScore);
  if(Number.isFinite(score)){
    // Outward tessellation normals are expected for a closed STEP solid. A concave
    // cylindrical face therefore points toward its axis (inner bend); a convex one
    // points away from it (outer bend). This lets us recover R even when the opposite
    // cylinder was split or omitted by the exporter.
    if(score<=-0.15)return{ok:true,value:cyl.radius,source:'concave-cylinder',partner:null};
    if(score>=0.15&&Number.isFinite(thickness)&&cyl.radius>thickness){
      return{ok:true,value:Math.max(0,cyl.radius-thickness),source:'convex-cylinder-minus-thickness',partner:null};
    }
  }
  return{ok:false,value:NaN,source:'unresolved',partner:null};
}

function makeRootMap(ctx,panel,tol){
  if(!panel?.faceIds?.length||!panel.stats)return null;let u3=null;
  const candidates=[];for(const fid of panel.faceIds){const face=ctx.faceById.get(fid);for(const rawEid of face?.edgeIndices||[]){const edge=ctx.edgeById.get(Number(rawEid));if(edge&&isStraightEdge(edge,tol))candidates.push(edge);}}
  candidates.sort((a,b)=>straightEdgeLength(b)-straightEdgeLength(a));if(candidates.length)u3=straightEdgeDirection(candidates[0]);
  if(!u3){for(const fid of panel.faceIds){const st=ctx.statsById.get(fid);if(st?.triangles?.length){u3=V3.unit(V3.sub(st.triangles[0][1],st.triangles[0][0]));if(u3)break;}}}
  if(!u3)return null;const st=panel.stats;u3=V3.unit(V3.sub(u3,V3.scale(st.normal,V3.dot(u3,st.normal))))||u3;const v3=V3.unit(V3.cross(st.normal,u3));if(!v3)return null;
  return{origin3:st.centroid,origin2:[0,0],u3,v3,u2:[1,0],v2:[0,1]};
}
function mapPoint(map,p){const d=V3.sub(p,map.origin3),u=V3.dot(d,map.u3),v=V3.dot(d,map.v3);return V2.add(map.origin2,V2.add(V2.scale(map.u2,u),V2.scale(map.v2,v)));}

function projectedInteriorDirection(panel,boundary,axis){
  if(!panel?.stats||!boundary?.mid)return null;
  const raw=V3.sub(panel.stats.centroid,boundary.mid),flat=V3.sub(raw,V3.scale(axis,V3.dot(raw,axis)));
  return V3.unit(flat);
}
function validStandardBendAngle(angle){return Number.isFinite(angle)&&Math.abs(angle)>BEND_MIN_ANGLE&&Math.abs(angle)<Math.PI-THREE_DEG;}
function boundaryPairGeometry(cyl,a,b,planarGroups){
  const pa=planarGroups.byId.get(a?.groupId),pb=planarGroups.byId.get(b?.groupId);if(!pa||!pb||a.groupId===b.groupId)return null;
  const axis=V3.unit(cyl.axis);if(!axis)return null;
  const axisDotA=Math.abs(V3.dot(pa.stats.normal,axis)),axisDotB=Math.abs(V3.dot(pb.stats.normal,axis));
  // A true cylindrical sheet bend has its axis lying in both tangent flange planes.
  // Hole/slot walls have the opposite topology: their cylinder axis is approximately
  // normal to the two sheet skins. Reject those before they can masquerade as bends.
  const axisGeometrySuspicious=axisDotA>BEND_AXIS_PLANE_DOT_MAX||axisDotB>BEND_AXIS_PLANE_DOT_MAX;
  const planeAngle=Math.acos(clamp(Math.abs(V3.dot(pa.stats.normal,pb.stats.normal)),0,1));
  // Cylinders joining parallel/coplanar planar faces are not ordinary bends (<180°).
  // They are usually holes, grooves, rounds, split-face artifacts or hem topology.
  if(planeAngle<BEND_MIN_ANGLE)return null;
  const ia=projectedInteriorDirection(pa,a,axis),ib=projectedInteriorDirection(pb,b,axis);
  const travelAngle=ia&&ib?signedAngle(V3.scale(ia,-1),ib,axis):0;
  const normalAngle=signedAngle(pa.stats.normal,pb.stats.normal,axis);
  const r0=radialToAxis(a.mid,cyl.center,axis),r1=radialToAxis(b.mid,cyl.center,axis),radialAngle=signedAngle(r0,r1,axis);
  const candidates=[
    {angle:radialAngle,source:'cylinder-boundaries',weight:3},
    {angle:travelAngle,source:'panel-travel',weight:2},
    {angle:normalAngle,source:'panel-normals',weight:1}
  ].filter(x=>validStandardBendAngle(x.angle));
  if(!candidates.length)return{ok:false,axisDotA,axisDotB,axisGeometrySuspicious,planeAngle,radialAngle,travelAngle,normalAngle};
  // Prefer the exact cylinder sweep when it agrees with flange travel. If STEP
  // boundaries are degenerate/split, panel-travel is considerably more reliable.
  let chosen=candidates[0];
  if(validStandardBendAngle(travelAngle)&&validStandardBendAngle(radialAngle)){
    const delta=Math.abs(Math.abs(radialAngle)-Math.abs(travelAngle));
    if(delta>ANGLE_DISAGREE_TOL)chosen={angle:travelAngle,source:'panel-travel',weight:4};
  }else if(validStandardBendAngle(travelAngle)&&!validStandardBendAngle(radialAngle))chosen={angle:travelAngle,source:'panel-travel',weight:4};
  // Exact planar normals are authoritative. If a legacy/tessellated normal still
  // looks suspicious, keep the topologically/radially valid bend but penalize it
  // rather than deleting it. Through-holes remain rejected by the parallel-panel
  // angle test above.
  const score=Math.min(Number(a.length)||0,Number(b.length)||0)+chosen.weight*1e-3-(axisGeometrySuspicious?1e-4:0);
  return{ok:true,...chosen,score,axisDotA,axisDotB,axisGeometrySuspicious,planeAngle,radialAngle,travelAngle,normalAngle};
}
function chooseBendBoundaryPair(cyl,planarGroups){
  let best=null;
  for(let i=0;i<cyl.boundaries.length;i++)for(let j=i+1;j<cyl.boundaries.length;j++){
    const a=cyl.boundaries[i],b=cyl.boundaries[j],geom=boundaryPairGeometry(cyl,a,b,planarGroups);
    if(!geom?.ok)continue;if(!best||geom.score>best.geom.score)best={a,b,geom};
  }
  return best;
}

function createBendMapping({cyl,parentGroupId,childGroupId,parentMap,ctx,planarGroups,thickness,kResolver,fallbackRadius,tol,cylinders}){
  const pb=cyl.boundaries.find(b=>b.groupId===parentGroupId),cb=cyl.boundaries.find(b=>b.groupId===childGroupId);if(!pb||!cb)return{ok:false,code:'missing-tangent-boundary'};
  let axis3=cyl.axis.slice();const parentMid2=mapPoint(parentMap,pb.mid),axis2Raw=V2.sub(mapPoint(parentMap,V3.add(pb.mid,axis3)),parentMid2),axis2=V2.unit(axis2Raw);if(!axis2)return{ok:false,code:'bad-axis'};
  const parentPanel=planarGroups.byId.get(parentGroupId),childPanel=planarGroups.byId.get(childGroupId);if(!parentPanel||!childPanel)return{ok:false,code:'panel-missing'};
  const parentCentroid2=mapPoint(parentMap,parentPanel.stats.centroid),toInterior=V2.sub(parentCentroid2,parentMid2);let outward=V2.perp(axis2);if(V2.dot(outward,toInterior)>0)outward=V2.scale(outward,-1);
  const pairGeom=boundaryPairGeometry(cyl,pb,cb,planarGroups);
  if(!pairGeom?.ok)return{ok:false,code:'not-sheet-bend',diagnostics:{axisDotParent:pairGeom?.axisDotA??null,axisDotChild:pairGeom?.axisDotB??null,rawBoundaryAngleDeg:Math.abs(pairGeom?.radialAngle||0)*180/Math.PI,panelTravelAngleDeg:Math.abs(pairGeom?.travelAngle||0)*180/Math.PI,panelNormalAngleDeg:Math.abs(pairGeom?.normalAngle||0)*180/Math.PI}};
  let total=pairGeom.angle,angleSource=pairGeom.source;
  if(Math.abs(total)<BEND_MIN_ANGLE)return{ok:false,code:'zero-bend',diagnostics:{rawBoundaryAngleDeg:Math.abs(pairGeom.radialAngle)*180/Math.PI,panelTravelAngleDeg:Math.abs(pairGeom.travelAngle)*180/Math.PI,panelNormalAngleDeg:Math.abs(pairGeom.normalAngle)*180/Math.PI}};
  if(Math.abs(total)>=Math.PI-THREE_DEG)return{ok:false,code:'bend-180-unsupported',angleDeg:Math.abs(total)*180/Math.PI};
  const radiusResolution=resolveInsideRadius(cyl,cylinders,thickness,tol,fallbackRadius),innerRadius=radiusResolution.value;
  if(!radiusResolution.ok||!Number.isFinite(innerRadius)||innerRadius<0)return{ok:false,code:'inside-radius-unresolved',diagnostics:{cylinderRadius:cyl.radius,radialNormalScore:cyl.radialNormalScore,thickness,fallbackRadius:Number(fallbackRadius)}};
  const k=Number(kResolver?.(innerRadius,thickness));if(!Number.isFinite(k)||k<0||k>1)return{ok:false,code:'k-factor-invalid',diagnostics:{innerRadius,thickness,k}};
  const neutralRadius=innerRadius+k*thickness,bendAllowance=Math.abs(total)*neutralRadius,targetMid2=V2.add(parentMid2,V2.scale(outward,bendAllowance));
  const toChildInteriorRaw=V3.sub(childPanel.stats.centroid,cb.mid),toChildInterior=V3.sub(toChildInteriorRaw,V3.scale(axis3,V3.dot(toChildInteriorRaw,axis3)));
  let childV3=V3.unit(toChildInterior);
  if(!childV3){
    childV3=V3.unit(V3.cross(childPanel.stats.normal,axis3))||V3.unit(V3.cross(axis3,childPanel.stats.normal));
    if(childV3&&V3.dot(childV3,toChildInteriorRaw)<0)childV3=V3.scale(childV3,-1);
  }
  if(!childV3)return{ok:false,code:'child-plane-direction'};
  const childMap={origin3:cb.mid,origin2:targetMid2,u3:axis3,v3:childV3,u2:axis2,v2:outward};
  return{ok:true,parentGroupId,childGroupId,cyl,pb,cb,axis3,axis2,outward,parentMid2,targetMid2,totalAngle:total,angleDeg:Math.abs(total)*180/Math.PI,angleSource,innerRadius,radiusSource:radiusResolution.source,k,neutralRadius,bendAllowance,childMap,partnerRadius:radiusResolution.partner?.other?.radius??null};
}
const THREE_DEG=3*Math.PI/180;
const BEND_MIN_ANGLE=0.5*Math.PI/180;
const BEND_AXIS_PLANE_DOT_MAX=0.20;
const ANGLE_DISAGREE_TOL=2*Math.PI/180;

function projectPanelTriangles(ctx,panel,map){const out=[];for(const fid of panel.faceIds||[])for(const tri of ctx.statsById.get(fid)?.triangles||[])out.push(tri.map(p=>mapPoint(map,p)));return out;}
function mapBendPoint(mapping,p){
  const {cyl,pb,axis3,axis2,outward,parentMid2,totalAngle,neutralRadius}=mapping,r0=radialToAxis(pb.mid,cyl.center,axis3),sign=Math.sign(totalAngle)||1,radial=radialToAxis(p,cyl.center,axis3),raw=signedAngle(r0,radial,axis3),phi=angleCandidateInSpan(raw,totalAngle),s=phi*sign*neutralRadius,ax=V3.dot(V3.sub(p,pb.mid),axis3);
  return V2.add(parentMid2,V2.add(V2.scale(axis2,ax),V2.scale(outward,s)));
}
function projectBendTriangles(ctx,mapping){
  const out=[];for(const fid of mapping.cyl.faceIds){for(const tri of ctx.statsById.get(fid).triangles)out.push(tri.map(p=>mapBendPoint(mapping,p)));}return out;
}

function quantKey(p,tol){return`${Math.round(p[0]/tol)},${Math.round(p[1]/tol)}`;}
function edgeKey(a,b,tol){const ka=quantKey(a,tol),kb=quantKey(b,tol);return ka<kb?`${ka}|${kb}`:`${kb}|${ka}`;}
function computeBoundaryEdges(triangles,tol){
  const map=new Map();
  for(const tri of triangles){for(let i=0;i<3;i++){const a=tri[i],b=tri[(i+1)%3],key=edgeKey(a,b,tol),rec=map.get(key);if(rec)rec.count++;else map.set(key,{a,b,count:1});}}
  return[...map.values()].filter(r=>r.count===1).map(r=>[r.a,r.b]);
}
function bounds2D(triangles){let min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const tri of triangles)for(const p of tri){min[0]=Math.min(min[0],p[0]);min[1]=Math.min(min[1],p[1]);max[0]=Math.max(max[0],p[0]);max[1]=Math.max(max[1],p[1]);}if(!Number.isFinite(min[0]))return{min:[0,0],max:[0,0],width:0,height:0};return{min,max,width:max[0]-min[0],height:max[1]-min[1]};}

function isStraight2D(points,tol){
  if(points.length<2)return false;const a=points[0],b=points.at(-1),ab=V2.sub(b,a),len=V2.len(ab);if(len<EPS)return false;const u=V2.scale(ab,1/len);let err=0;
  for(const p of points){const ap=V2.sub(p,a),t=V2.dot(ap,u),q=V2.add(a,V2.scale(u,t));err=Math.max(err,V2.dist(p,q));}return err<=Math.max(tol*5,len*1e-5);
}
function ccwSweep(a,b){let d=(b-a)%TAU;if(d<0)d+=TAU;return d;}
function boundaryPrimitivesForSkin(geometry,ctx,panelMaps,usedBends,tol,planarGroups){
  const bendByFace=new Map(),skinFaces=new Set();for(const groupId of panelMaps.keys())for(const fid of planarGroups.byId.get(groupId)?.faceIds||[])skinFaces.add(Number(fid));for(const bend of usedBends)for(const fid of bend.cyl.faceIds){bendByFace.set(Number(fid),bend);skinFaces.add(Number(fid));}
  const primitives=[];
  for(const edge of geometry.edges||[]){
    const eid=Number(edge.id),owners=[...(ctx.edgeOwnersById.get(eid)||[])].map(Number).filter(id=>skinFaces.has(id));if(owners.length!==1)continue;const owner=owners[0],pts=edgePoints(edge);if(pts.length<2)continue;
    const groupId=planarGroups.faceToGroup.get(owner),panelMap=groupId?panelMaps.get(groupId):null,bendMap=bendByFace.get(owner);if(!panelMap&&!bendMap)continue;const mapped=pts.map(p=>panelMap?mapPoint(panelMap,p):mapBendPoint(bendMap,p));
    const info=ctx.edgeInfoById.get(eid)||{},ef=family(info.family);
    if(panelMap&&['circle','circular'].includes(ef)&&Number.isFinite(Number(info.radius))&&Array.isArray(info.localCenter)){
      const center=mapPoint(panelMap,info.localCenter.map(Number).slice(0,3)),radius=Number(info.radius),length=Number(info.length),desired=Number.isFinite(length)&&radius>EPS?length/radius:NaN;
      if(Number.isFinite(desired)&&Math.abs(desired-TAU)<=1e-3){primitives.push({kind:'circle',center,radius,edgeId:eid});continue;}
      const start=Math.atan2(mapped[0][1]-center[1],mapped[0][0]-center[0]),end=Math.atan2(mapped.at(-1)[1]-center[1],mapped.at(-1)[0]-center[0]);
      const sweepAB=ccwSweep(start,end),sweepBA=ccwSweep(end,start);let a=start,b=end;if(Number.isFinite(desired)&&Math.abs(sweepBA-desired)<Math.abs(sweepAB-desired)){a=end;b=start;}
      primitives.push({kind:'arc',center,radius,startRad:a,endRad:b,edgeId:eid});continue;
    }
    if(['line','linear'].includes(ef)||isStraight2D(mapped,tol)){primitives.push({kind:'line',a:mapped[0],b:mapped.at(-1),edgeId:eid});continue;}
    primitives.push({kind:'polyline',points:mapped,edgeId:eid});
  }
  return primitives;
}

function makeBendLine(mapping){
  const globalLo=Math.max(mapping.pb.axisMin,mapping.cb.axisMin),globalHi=Math.min(mapping.pb.axisMax,mapping.cb.axisMax);
  let a=Number.isFinite(globalLo)?globalLo-mapping.pb.axisMid:mapping.pb.minOffset,b=Number.isFinite(globalHi)?globalHi-mapping.pb.axisMid:mapping.pb.maxOffset;
  if(!(b>a)){a=mapping.pb.minOffset;b=mapping.pb.maxOffset;}
  const midS=mapping.bendAllowance/2;
  return{a:V2.add(mapping.parentMid2,V2.add(V2.scale(mapping.axis2,a),V2.scale(mapping.outward,midS))),b:V2.add(mapping.parentMid2,V2.add(V2.scale(mapping.axis2,b),V2.scale(mapping.outward,midS))),angleDeg:mapping.angleDeg,insideRadius:mapping.innerRadius,k:mapping.k,allowance:mapping.bendAllowance,sourceFaceIds:mapping.cyl.faceIds.slice()};
}

function dxfNum(v){if(!Number.isFinite(v))return'0';const n=Math.abs(v)<1e-10?0:v;return String(Number(n.toFixed(8)));}
export function flatPatternToDxf(result,{partName='NavoFlo_Flat_Pattern'}={}){
  if(!result?.ok)throw new Error('No valid flat pattern.');const lines=[];const add=(c,v)=>{lines.push(String(c),String(v));};
  add(0,'SECTION');add(2,'HEADER');add(9,'$ACADVER');add(1,'AC1009');add(9,'$MEASUREMENT');add(70,1);add(0,'ENDSEC');
  add(0,'SECTION');add(2,'TABLES');add(0,'TABLE');add(2,'LAYER');add(70,2);
  for(const [name,color] of [['CUT',7],['BEND',3]]){add(0,'LAYER');add(2,name);add(70,0);add(62,color);add(6,'CONTINUOUS');}
  add(0,'ENDTAB');add(0,'ENDSEC');add(0,'SECTION');add(2,'ENTITIES');
  const entity=(layer,a,b)=>{add(0,'LINE');add(8,layer);add(10,dxfNum(a[0]));add(20,dxfNum(a[1]));add(30,0);add(11,dxfNum(b[0]));add(21,dxfNum(b[1]));add(31,0);};
  const primitives=Array.isArray(result.boundaryPrimitives)&&result.boundaryPrimitives.length?result.boundaryPrimitives:null;
  if(primitives){
    for(const primitive of primitives){
      if(primitive.kind==='line')entity('CUT',primitive.a,primitive.b);
      else if(primitive.kind==='circle'){add(0,'CIRCLE');add(8,'CUT');add(10,dxfNum(primitive.center[0]));add(20,dxfNum(primitive.center[1]));add(30,0);add(40,dxfNum(primitive.radius));}
      else if(primitive.kind==='arc'){add(0,'ARC');add(8,'CUT');add(10,dxfNum(primitive.center[0]));add(20,dxfNum(primitive.center[1]));add(30,0);add(40,dxfNum(primitive.radius));add(50,dxfNum((primitive.startRad*180/Math.PI+360)%360));add(51,dxfNum((primitive.endRad*180/Math.PI+360)%360));}
      else if(primitive.kind==='polyline'){for(let i=0;i+1<primitive.points.length;i++)entity('CUT',primitive.points[i],primitive.points[i+1]);}
    }
  }else for(const [a,b] of result.boundaryEdges)entity('CUT',a,b);
  for(const bend of result.bendLines)entity('BEND',bend.a,bend.b);
  add(0,'ENDSEC');add(0,'EOF');return lines.join('\r\n')+'\r\n';
}

export function analyzeAndUnfold({geometry,faceInfo,edgeInfo=[],logicalGroups=[],fixedFaceId,thickness=null,fallbackInsideRadius=null,kResolver}){
  if(!geometry) return{ok:false,code:'geometry-missing',message:'STEP geometry is unavailable.'};
  const {diag,tol}=geometryScale(geometry),ctx=buildFaceContext(geometry,faceInfo,edgeInfo),fixed=Number(fixedFaceId),fixedInfo=ctx.infoById.get(fixed);
  if(!ctx.faceById.has(fixed))return{ok:false,code:'fixed-face-missing',message:'The selected fixed face is not part of this geometry.'};
  if(!isPlanar(fixedInfo?.family))return{ok:false,code:'fixed-face-not-planar',message:'The fixed face must be planar.'};

  const planarGroups=buildPlanarGroups(geometry,ctx,tol),fixedGroupId=planarGroups.faceToGroup.get(fixed),fixedPanel=planarGroups.byId.get(fixedGroupId);
  if(!fixedPanel)return{ok:false,code:'fixed-panel-missing',message:'The selected face could not be assigned to a planar sheet panel.'};
  const cylinders=buildCylinderGroups(geometry,ctx,logicalGroups,tol,planarGroups),autoThickness=detectThickness(cylinders,tol);let resolvedThickness=Number(thickness);
  if(!Number.isFinite(resolvedThickness)||resolvedThickness<=0)resolvedThickness=Number(autoThickness?.value);
  if(!Number.isFinite(resolvedThickness)||resolvedThickness<=0)return{ok:false,code:'thickness-unresolved',message:'Sheet thickness could not be detected. Enter T and try again.',detectedThickness:autoThickness};

  const warnings=[];if(autoThickness&&Number.isFinite(Number(thickness))&&Number(thickness)>0){const delta=Math.abs(Number(thickness)-autoThickness.value);if(delta>Math.max(resolvedThickness*0.12,tol*20))warnings.push('Entered thickness differs from the cylindrical-face thickness estimate.');}
  let rejectedNonBendCylinders=0;
  const candidateBends=cylinders.map(c=>{
    const unique=[];for(const b of c.boundaries){if(!unique.some(x=>x.groupId===b.groupId))unique.push(b);}
    if(unique.length<2)return null;
    const candidate={...c,boundaries:unique},pair=chooseBendBoundaryPair(candidate,planarGroups);
    if(!pair){rejectedNonBendCylinders++;return null;}
    // Keep only the tangent flange pair selected geometrically. This is essential for
    // slots/holes and STEP faces with more than two planar neighbours.
    candidate.boundaries=[pair.a,pair.b];candidate.pairGeometry=pair.geom;return candidate;
  }).filter(Boolean);
  const bendsByGroup=new Map();for(const bend of candidateBends){for(const b of bend.boundaries){if(!bendsByGroup.has(b.groupId))bendsByGroup.set(b.groupId,[]);bendsByGroup.get(b.groupId).push(bend);}}
  const rootMap=makeRootMap(ctx,fixedPanel,tol);if(!rootMap)return{ok:false,code:'fixed-face-map',message:'Unable to establish a coordinate system on the fixed face.'};

  const panelMaps=new Map([[fixedGroupId,rootMap]]),panelOrder=[fixedGroupId],usedBends=[],usedCylinderIds=new Set(),queue=[fixedGroupId],cycleLinks=[];
  while(queue.length){
    const parentGroupId=queue.shift(),parentMap=panelMaps.get(parentGroupId);
    for(const cyl of bendsByGroup.get(parentGroupId)||[]){
      if(usedCylinderIds.has(cyl.id))continue;const other=cyl.boundaries.find(b=>b.groupId!==parentGroupId);if(!other)continue;const childGroupId=other.groupId;
      if(panelMaps.has(childGroupId)){cycleLinks.push({parentGroupId,childGroupId,cylinder:cyl.id});usedCylinderIds.add(cyl.id);continue;}
      const mapping=createBendMapping({cyl,parentGroupId,childGroupId,parentMap,ctx,planarGroups,thickness:resolvedThickness,kResolver,fallbackRadius:fallbackInsideRadius,tol,cylinders});
      if(!mapping.ok){warnings.push(`Bend ${cyl.faceIds.join('/')} skipped: ${mapping.code}.`);cyl.lastFailure={code:mapping.code,diagnostics:mapping.diagnostics||null};usedCylinderIds.add(cyl.id);continue;}
      panelMaps.set(childGroupId,mapping.childMap);panelOrder.push(childGroupId);usedBends.push(mapping);usedCylinderIds.add(cyl.id);queue.push(childGroupId);
    }
  }
  if(cycleLinks.length)warnings.push('Closed/cyclic sheet topology detected; a spanning tree was unfolded. Add a seam for a production flat pattern.');
  if(!usedBends.length){
    const connectedBends=(bendsByGroup.get(fixedGroupId)||[]),connected=connectedBends.length,diagnostics={planarGroups:planarGroups.groups.length,fixedPanelFaces:fixedPanel.faceIds.slice(),cylinders:cylinders.length,candidateBends:candidateBends.length,rejectedNonBendCylinders,fixedPanelCandidateBends:connected,tolerance:tol,failures:connectedBends.map(c=>({faces:c.faceIds.slice(),radius:c.radius,radialNormalScore:c.radialNormalScore,failure:c.lastFailure||null}))};
    const message=connected?'A cylindrical bend touches the fixed panel, but its geometry could not be resolved safely. Check T / inside radius / K-factor.':'No standard cylindrical bend connected to the fixed panel was detected.';
    return{ok:false,code:connected?'bend-resolution-failed':'no-bends',message,detectedThickness:autoThickness,warnings,diagnostics};
  }

  const panelTriangles=[];for(const groupId of panelOrder){const panel=planarGroups.byId.get(groupId);if(panel)panelTriangles.push(...projectPanelTriangles(ctx,panel,panelMaps.get(groupId)));}
  const bendTriangles=[];for(const bend of usedBends)bendTriangles.push(...projectBendTriangles(ctx,bend));
  const triangles=[...panelTriangles,...bendTriangles],flatTol=Math.max(diag*1e-6,resolvedThickness*1e-5,1e-6),boundaryEdges=computeBoundaryEdges(triangles,flatTol),boundaryPrimitives=boundaryPrimitivesForSkin(geometry,ctx,panelMaps,usedBends,flatTol,planarGroups),bendLines=usedBends.map(makeBendLine),bounds=bounds2D(triangles);
  if(!triangles.length||!boundaryEdges.length)return{ok:false,code:'flat-empty',message:'The flat pattern could not be reconstructed.',warnings};
  const panelFaceIds=panelOrder.flatMap(id=>planarGroups.byId.get(id)?.faceIds||[]);
  return{ok:true,version:'NavoUnfold MVP 1.4',fixedFaceId:fixed,fixedPanelFaceIds:fixedPanel.faceIds.slice(),geometryId:String(geometry.id),thickness:resolvedThickness,detectedThickness:autoThickness,panelFaceIds,bendCount:usedBends.length,panelCount:panelOrder.length,triangles,boundaryEdges,boundaryPrimitives,bendLines,bounds,warnings,cycleLinks,diagnostics:{planarGroups:planarGroups.groups.length,fixedPanelFaces:fixedPanel.faceIds.slice(),cylinders:cylinders.length,candidateBends:candidateBends.length,rejectedNonBendCylinders,tolerance:tol}};
}

