import { wrapR2000Dxf, R2000_MODELSPACE_HANDLE } from './dxf-r2000-template.js?v=8.17.6';

/*
 * NavoFlo Sheet Metal Engine — V8.17.6
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

function exactEdgePoints(ctx,edge){
  const info=ctx?.edgeInfoById?.get(Number(edge?.id));
  const a=Array.isArray(info?.localStartPoint)?info.localStartPoint.map(Number).slice(0,3):null;
  const b=Array.isArray(info?.localEndPoint)?info.localEndPoint.map(Number).slice(0,3):null;
  if(a?.length===3&&b?.length===3&&a.every(Number.isFinite)&&b.every(Number.isFinite))return[a,b];
  return edgePoints(edge);
}
function exactStraightEdge(ctx,edge,tol){
  const info=ctx?.edgeInfoById?.get(Number(edge?.id));
  if(['line','linear'].includes(family(info?.family))){const len=Number(info?.length);if(Number.isFinite(len)&&len>tol)return true;const pts=exactEdgePoints(ctx,edge);return pts.length>=2&&V3.dist(pts[0],pts.at(-1))>tol;}
  return isStraightEdge(edge,tol);
}
function exactStraightEdgeDirection(ctx,edge){const pts=exactEdgePoints(ctx,edge);return pts.length>=2?V3.unit(V3.sub(pts.at(-1),pts[0])):null;}
function exactStraightEdgeLength(ctx,edge){const info=ctx?.edgeInfoById?.get(Number(edge?.id)),v=Number(info?.length);if(Number.isFinite(v)&&v>=0)return v;const pts=exactEdgePoints(ctx,edge);return pts.length>=2?V3.dist(pts[0],pts.at(-1)):0;}

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

  // V8.17.5 — coplanar skin-fragment stitching.
  // A hole/cut that reaches two bend boundaries can split one physical planar
  // sheet skin into several OCCT faces that no longer share an edge with each
  // other. They are still the same rigid panel when they are coplanar *and*
  // touch the same non-planar B-Rep face (bend or cut wall). Stitch those
  // fragments through that common topological neighbor. This is stricter than
  // globally merging equal planes, so separate folded flanges that merely happen
  // to be coplanar remain independent.
  const nonPlanarToPlanar=new Map();
  for(const ownersSet of ctx.edgeOwnersById.values()){
    const owners=[...ownersSet].map(Number),planars=owners.filter(id=>planarSet.has(id)),nonPlanars=owners.filter(id=>!planarSet.has(id));
    if(!planars.length||!nonPlanars.length)continue;
    for(const nid of nonPlanars){if(!nonPlanarToPlanar.has(nid))nonPlanarToPlanar.set(nid,new Set());for(const pid of planars)nonPlanarToPlanar.get(nid).add(pid);}
  }
  for(const planarFaces of nonPlanarToPlanar.values()){
    const ids=[...planarFaces];
    for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
      const a=ids[i],b=ids[j];if(coplanarFaceStats(ctx.statsById.get(a),ctx.statsById.get(b),tol)){neighbors.get(a).add(b);neighbors.get(b).add(a);}
    }
  }
  const groups=[],faceToGroup=new Map(),seen=new Set();
  for(const start of planarIds){if(seen.has(start))continue;const faceIds=[],queue=[start];seen.add(start);
    while(queue.length){const id=queue.shift();faceIds.push(id);for(const n of neighbors.get(id)||[]){if(!seen.has(n)){seen.add(n);queue.push(n);}}}
    const group={id:`panel-${groups.length}`,faceIds,faceSet:new Set(faceIds),stats:combinePanelStats(ctx,faceIds)};groups.push(group);for(const fid of faceIds)faceToGroup.set(fid,group.id);
  }
  const byId=new Map(groups.map(g=>[g.id,g]));return{groups,byId,faceToGroup};
}

function planeCylinderTangency(cyl,panel,tol){
  const axis=V3.unit(cyl?.axis),n=V3.unit(panel?.stats?.normal),pc=panel?.stats?.centroid,center=cyl?.center,radius=Number(cyl?.radius);
  if(!axis||!n||!pc||!center||!Number.isFinite(radius)||radius<=0)return null;
  // Same principle used by mature sheet-metal unfolders: a true plane/cylinder
  // bend connection is identified from the exact surfaces, not from how the
  // shared edge happened to be tessellated or classified. The cylinder axis
  // lies in the flange plane, and the distance from the axis to the plane is R.
  const axisDot=Math.abs(V3.dot(axis,n));
  const signedDistance=V3.dot(V3.sub(center,pc),n);
  const radialError=Math.abs(Math.abs(signedDistance)-radius);
  const angularTol=0.025; // ~1.43 deg; intentionally tolerant of imported STEP noise.
  const distanceTol=Math.max(tol*120,Math.abs(radius)*2e-4,1e-6);
  if(axisDot>angularTol||radialError>distanceTol)return null;
  // Orthogonal projection of any point on the cylinder axis onto the tangent
  // plane gives a point on the theoretical line of contact.
  const contactBase=V3.sub(center,V3.scale(n,signedDistance));
  return{axis,n,signedDistance,radialError,axisDot,contactBase,distanceTol};
}

function axisExtentFromPoints(points,axis){
  const vals=(points||[]).filter(p=>Array.isArray(p)&&p.length>=3&&p.every(Number.isFinite)).map(p=>V3.dot(p,axis));
  if(!vals.length)return null;return{min:Math.min(...vals),max:Math.max(...vals)};
}

function contactPointAtAxis(contactBase,axis,axisValue){
  return V3.add(contactBase,V3.scale(axis,axisValue-V3.dot(contactBase,axis)));
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
    if(!axis||center.length<3||!center.every(Number.isFinite)||!Number.isFinite(radius))return null;
    const faceSet=new Set(faceIds),edgeIds=new Set();
    for(const fid of faceIds){for(const eid of ctx.faceById.get(fid)?.edgeIndices||[])edgeIds.add(Number(eid));}

    // Build adjacency from *every shared B-Rep edge*. Do not require the edge to
    // already be tagged LINE or to contain a usable tessellation. FreeCAD's V2
    // unfolder follows the same robust pattern: shared-face graph first, exact
    // surface tangency second. This is the critical V8.16.6 change.
    const neighborEdges=new Map();
    for(const eid of edgeIds){
      for(const owner of ctx.edgeOwnersById.get(eid)||[]){
        const oid=Number(owner);if(faceSet.has(oid)||!isPlanar(ctx.infoById.get(oid)?.family))continue;
        const groupId=planarGroups.faceToGroup.get(oid);if(!groupId)continue;
        if(!neighborEdges.has(groupId))neighborEdges.set(groupId,new Set());neighborEdges.get(groupId).add(eid);
      }
    }

    // Global axial extent is a reliable fallback for split or oddly classified
    // shared edges. It uses all exact edge endpoints available on the cylinder.
    const allCylinderPoints=[];
    for(const eid of edgeIds){const e=ctx.edgeById.get(eid);if(e)allCylinderPoints.push(...exactEdgePoints(ctx,e));}
    const globalExtent=axisExtentFromPoints(allCylinderPoints,axis);

    const boundaries=[];
    for(const [groupId,eidSet] of neighborEdges){
      const panel=planarGroups.byId.get(groupId);if(!panel)continue;
      const tangent=planeCylinderTangency({axis,center,radius},panel,tol);if(!tangent)continue;
      const edges=[...eidSet].map(eid=>ctx.edgeById.get(eid)).filter(Boolean);
      const sharedPoints=edges.flatMap(e=>exactEdgePoints(ctx,e));
      let extent=axisExtentFromPoints(sharedPoints,axis);
      if(!extent||extent.max-extent.min<=tol*2)extent=globalExtent;
      let axisMin=extent?.min,axisMax=extent?.max;
      if(!Number.isFinite(axisMin)||!Number.isFinite(axisMax)||axisMax-axisMin<=tol*2){
        // Last-resort estimate from all edges of the planar panel. This keeps the
        // topological decision independent of the shared edge representation.
        const panelPoints=[];
        for(const fid of panel.faceIds||[]){for(const rawEid of ctx.faceById.get(fid)?.edgeIndices||[]){const pe=ctx.edgeById.get(Number(rawEid));if(pe)panelPoints.push(...exactEdgePoints(ctx,pe));}}
        const panelExtent=axisExtentFromPoints(panelPoints,axis);axisMin=panelExtent?.min;axisMax=panelExtent?.max;
      }
      if(!Number.isFinite(axisMin)||!Number.isFinite(axisMax)||axisMax-axisMin<=tol*2)continue;
      const axisMid=(axisMin+axisMax)/2,mid=contactPointAtAxis(tangent.contactBase,axis,axisMid);
      const p0=contactPointAtAxis(tangent.contactBase,axis,axisMin),p1=contactPointAtAxis(tangent.contactBase,axis,axisMax);
      boundaries.push({
        groupId,faceIds:panel.faceIds.slice(),faceId:panel.faceIds[0],edges:[...eidSet],
        mid,minOffset:axisMin-axisMid,maxOffset:axisMax-axisMid,axisMid,axisMin,axisMax,
        length:axisMax-axisMin,points:[p0,p1],source:'exact-surface-tangency',
        tangency:{axisDot:tangent.axisDot,radialError:tangent.radialError,signedDistance:tangent.signedDistance}
      });
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

function detectPlanarThickness(planarGroups,tol){
  // Flat laser-cut plates may contain no bend cylinders at all. In that case the
  // two dominant, parallel planar skins are the most reliable local thickness
  // signal. Rank by usable skin area so opposite side walls of a rectangular
  // solid cannot beat the large top/bottom faces.
  const groups=(planarGroups?.groups||[]).filter(g=>g?.stats?.area>EPS);
  let best=null;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j],na=V3.unit(a.stats.normal),nb=V3.unit(b.stats.normal);
    if(!na||!nb||Math.abs(V3.dot(na,nb))<0.9995)continue;
    const d=V3.sub(b.stats.centroid,a.stats.centroid),signed=V3.dot(d,na),gap=Math.abs(signed);
    if(!(gap>Math.max(tol*25,1e-7)))continue;
    const areaA=Number(a.stats.area)||0,areaB=Number(b.stats.area)||0,maxArea=Math.max(areaA,areaB),minArea=Math.min(areaA,areaB);
    if(!(minArea>EPS))continue;
    const ratio=minArea/Math.max(maxArea,EPS);if(ratio<0.55)continue;
    const span=Math.sqrt(minArea),lateral=V3.len(V3.sub(d,V3.scale(na,signed)));
    if(gap>Math.max(span*0.5,tol*100))continue;
    if(lateral>Math.max(span*0.20,gap*4,tol*100))continue;
    const score=minArea*ratio/(1+lateral/Math.max(span,EPS));
    if(!best||score>best.score)best={value:gap,score,areaRatio:ratio,lateral,groups:[a.id,b.id]};
  }
  return best?{value:best.value,count:2,samples:2,confidence:best.areaRatio,source:'parallel-planar-skins',groups:best.groups}:null;
}


// V8.17.4 — exact flat-prism proof.
//
// A rounded CUT contour must never be confused with a sheet-metal bend.  The
// reliable distinction is not "does the solid contain cylinders?" but "is the
// whole solid an extrusion between two translated, congruent planar caps?".
//
// For an actually flat laser-cut plate, the two sheet skins are exact translated
// copies.  Every point of the solid lies between those two support planes and
// their projected B-Rep boundary edges are congruent.  Cylinders whose axes run
// through the thickness (rounded outside corners, holes, etc.) are therefore cut
// geometry, not bends.  A formed sheet cannot pass this proof because another
// flange leaves the cap slab and/or the two cap boundaries stop being translated
// copies.
function canonicalDirection(v){
  let n=V3.unit(v);if(!n)return null;
  let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;
  if(n[k]<0)n=V3.scale(n,-1);return n;
}
function planeBasis(normal){
  const n=canonicalDirection(normal);if(!n)return null;
  const refs=[[1,0,0],[0,1,0],[0,0,1]].sort((a,b)=>Math.abs(V3.dot(a,n))-Math.abs(V3.dot(b,n)));
  const u=V3.unit(V3.cross(n,refs[0]));if(!u)return null;const v=V3.unit(V3.cross(n,u));if(!v)return null;
  return{n,u,v};
}
function allGeometryPoints(geometry,ctx){
  const out=[],p=geometry?.positions||[];
  for(let i=0;i+2<p.length;i+=3){const q=p3FromArray(p,i);if(q.every(Number.isFinite))out.push(q);}
  for(const edge of geometry?.edges||[])for(const q of exactEdgePoints(ctx,edge))if(q?.length===3&&q.every(Number.isFinite))out.push(q);
  return out;
}
function planarGroupBoundaryEdges(group,ctx){
  if(!group?.faceSet)return[];const ids=new Set();
  for(const fid of group.faceIds||[])for(const raw of ctx.faceById.get(Number(fid))?.edgeIndices||[]){
    const eid=Number(raw),owners=ctx.edgeOwnersById.get(eid)||new Set(),inside=[...owners].filter(id=>group.faceSet.has(Number(id))).length;
    if(inside===1)ids.add(eid);
  }
  return[...ids].map(id=>ctx.edgeById.get(id)).filter(Boolean);
}
function qnum(v,step){return Math.round(Number(v)/step);}
function point2Key(p,basis,step){return`${qnum(V3.dot(p,basis.u),step)},${qnum(V3.dot(p,basis.v),step)}`;}
function projectedEdgeSignature(edge,ctx,basis,step){
  const info=ctx.edgeInfoById.get(Number(edge?.id))||{},fam=family(info.family||'other'),pts=exactEdgePoints(ctx,edge);
  if(pts.length<2)return null;
  let a=point2Key(pts[0],basis,step),b=point2Key(pts.at(-1),basis,step);if(a>b)[a,b]=[b,a];
  const len=Number(info.length),parts=[fam,Number.isFinite(len)?qnum(len,step):0,a,b];
  const center=Array.isArray(info.localCenter)?info.localCenter.map(Number).slice(0,3):null,radius=Number(info.radius);
  if(center?.length===3&&center.every(Number.isFinite))parts.push(point2Key(center,basis,step));
  if(Number.isFinite(radius))parts.push(qnum(radius,step));
  return parts.join('|');
}
function projectedBoundarySignature(group,ctx,basis,step){
  const sig=[];for(const edge of planarGroupBoundaryEdges(group,ctx)){const s=projectedEdgeSignature(edge,ctx,basis,step);if(s)sig.push(s);}
  sig.sort();return sig;
}
function signaturesEqual(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true;}
function detectExactFlatPrism(geometry,ctx,planarGroups,tol,diag){
  const groups=(planarGroups?.groups||[]).filter(g=>g?.stats?.area>EPS),points=allGeometryPoints(geometry,ctx);if(groups.length<2||points.length<3)return null;
  const maxArea=Math.max(...groups.map(g=>Number(g.stats.area)||0)),supportTol=Math.max(tol*40,diag*2e-6,1e-6),matchStep=Math.max(tol*8,diag*5e-7,1e-7);
  let best=null;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
    const a=groups[i],b=groups[j],basis=planeBasis(a.stats.normal),nb=canonicalDirection(b.stats.normal);if(!basis||!nb||Math.abs(V3.dot(basis.n,nb))<0.99995)continue;
    const da=V3.dot(a.stats.centroid,basis.n),db=V3.dot(b.stats.centroid,basis.n),lo=Math.min(da,db),hi=Math.max(da,db),thickness=hi-lo;if(!(thickness>supportTol))continue;
    let minN=Infinity,maxN=-Infinity,minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
    for(const p of points){const pn=V3.dot(p,basis.n),pu=V3.dot(p,basis.u),pv=V3.dot(p,basis.v);minN=Math.min(minN,pn);maxN=Math.max(maxN,pn);minU=Math.min(minU,pu);maxU=Math.max(maxU,pu);minV=Math.min(minV,pv);maxV=Math.max(maxV,pv);}
    // Both cap planes must be the global support planes of the entire solid.
    if(Math.abs(lo-minN)>supportTol||Math.abs(hi-maxN)>supportTol)continue;
    const inPlaneSpan=Math.max(maxU-minU,maxV-minV);if(!(inPlaneSpan>supportTol)||thickness>inPlaneSpan*0.75)continue;
    const areaA=Number(a.stats.area)||0,areaB=Number(b.stats.area)||0,areaRatio=Math.min(areaA,areaB)/Math.max(areaA,areaB,EPS);
    // The cap pair must be a dominant skin pair. This rejects small parallel
    // machining faces that happen to sit at an extremum.
    if(areaRatio<0.995||Math.min(areaA,areaB)<maxArea*0.45)continue;
    const sa=projectedBoundarySignature(a,ctx,basis,matchStep),sb=projectedBoundarySignature(b,ctx,basis,matchStep);if(!sa.length||!signaturesEqual(sa,sb))continue;
    const score=Math.min(areaA,areaB)*areaRatio/(1+thickness/Math.max(inPlaneSpan,EPS));
    if(!best||score>best.score)best={score,value:thickness,groups:[a.id,b.id],capA:a,capB:b,basis,areaRatio,boundaryEdges:sa.length,supportError:Math.max(Math.abs(lo-minN),Math.abs(hi-maxN)),source:'translated-congruent-caps',confidence:1};
  }
  return best;
}


// V8.17.6 — conservative structural/profile extrusion recognition.
//
// Geometry alone cannot prove *manufacturing intent*: a very long press-brake
// channel and a cold-formed stock channel can be mathematically identical.
// What we can prove safely is the geometric class "long constant-direction
// profile/extrusion".  We only promote that class when the evidence is strong:
// a dominant family of exact linear B-Rep edges, many long parallel traces,
// a large length/cross-section aspect ratio, and side-surface area aligned with
// the same axis.  Flat plates are handled first by detectExactFlatPrism(), so a
// laser-cut plate never gets stolen by this detector.
function canonicalAxis(v){
  let n=V3.unit(v);if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=V3.scale(n,-1);return n;
}
function profilePlaneBasis(axis){
  const n=canonicalAxis(axis);if(!n)return null;const refs=[[1,0,0],[0,1,0],[0,0,1]].sort((a,b)=>Math.abs(V3.dot(a,n))-Math.abs(V3.dot(b,n)));
  const u=V3.unit(V3.cross(n,refs[0]));if(!u)return null;const v=V3.unit(V3.cross(n,u));if(!v)return null;return{n,u,v};
}
function detectStructuralProfileExtrusion(geometry,ctx,tol,diag){
  const lines=[];
  for(const edge of geometry.edges||[]){
    const info=ctx.edgeInfoById.get(Number(edge.id))||{};if(!['line','linear'].includes(family(info.family)))continue;
    const length=exactStraightEdgeLength(ctx,edge),dir=canonicalAxis(exactStraightEdgeDirection(ctx,edge));if(!(length>tol*20)||!dir)continue;
    const pts=exactEdgePoints(ctx,edge);if(pts.length<2)continue;lines.push({edge,length,dir,a:pts[0],b:pts.at(-1)});
  }
  if(lines.length<5)return null;
  const clusters=[];
  for(const line of lines){
    let cluster=clusters.find(c=>Math.abs(V3.dot(c.axis,line.dir))>=0.9995);
    if(!cluster){cluster={axis:line.dir.slice(),members:[],score:0};clusters.push(cluster);}
    const aligned=V3.dot(cluster.axis,line.dir)<0?V3.scale(line.dir,-1):line.dir;cluster.members.push(line);cluster.score+=line.length;
    const weighted=V3.add(V3.scale(cluster.axis,Math.max(cluster.score-line.length,EPS)),V3.scale(aligned,line.length));cluster.axis=canonicalAxis(weighted)||cluster.axis;
  }
  clusters.sort((a,b)=>b.score-a.score);const best=clusters[0];if(!best||best.members.length<5)return null;
  const basis=profilePlaneBasis(best.axis),points=allGeometryPoints(geometry,ctx);if(!basis||points.length<4)return null;
  let lo=Infinity,hi=-Infinity,minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for(const p of points){const d=V3.dot(p,basis.n),u=V3.dot(p,basis.u),v=V3.dot(p,basis.v);lo=Math.min(lo,d);hi=Math.max(hi,d);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minV=Math.min(minV,v);maxV=Math.max(maxV,v);}
  const length=hi-lo,spanU=maxU-minU,spanV=maxV-minV,crossSpan=Math.max(spanU,spanV);if(!(length>tol*50&&crossSpan>tol*20))return null;
  const aspect=length/crossSpan;
  // 2.45 keeps this intentionally conservative. The real regression profiles
  // supplied for V8.17.6 range from ~2.82 to >32, while the formed-sheet
  // regression parts stay below 1.85.
  if(aspect<2.45)return null;
  const longEdges=best.members.filter(e=>e.length>=length*0.55);if(longEdges.length<5)return null;
  const traceStep=Math.max(tol*20,crossSpan*1e-5,1e-6),traceKeys=new Set();
  for(const e of longEdges){const p=V3.scale(V3.add(e.a,e.b),0.5),u=V3.dot(p,basis.u),v=V3.dot(p,basis.v);traceKeys.add(`${Math.round(u/traceStep)},${Math.round(v/traceStep)}`);}
  if(traceKeys.size<4)return null;
  let totalArea=0,longitudinalArea=0;
  for(const info of ctx.infoById.values()){
    const area=Number(info?.area);if(!(area>EPS))continue;totalArea+=area;const fam=family(info.family);
    if(isPlanar(fam)){
      const n=V3.unit(Array.isArray(info.localNormal)?info.localNormal.map(Number).slice(0,3):[]);if(n&&Math.abs(V3.dot(n,basis.n))<=0.08)longitudinalArea+=area;
    }else if(isCyl(fam)){
      const a=V3.unit(Array.isArray(info.axisDirection)?info.axisDirection.map(Number).slice(0,3):[]);if(a&&Math.abs(V3.dot(a,basis.n))>=0.995)longitudinalArea+=area;
    }
  }
  const sideAreaRatio=totalArea>EPS?longitudinalArea/totalArea:1;if(sideAreaRatio<0.52)return null;
  const coverage=median(longEdges.map(e=>Math.min(1,e.length/length)))||0;
  const confidence=clamp(0.45+Math.min((aspect-2.45)/6,0.25)+Math.min((longEdges.length-5)/20,0.15)+Math.min(Math.max(sideAreaRatio-0.52,0)*0.35,0.15),0,1);
  return{kind:'constant-section-profile',axis:basis.n,length,crossSpan,spanU,spanV,aspect,longEdgeCount:longEdges.length,traceCount:traceKeys.size,sideAreaRatio,coverage,confidence};
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
  const candidates=[];for(const fid of panel.faceIds){const face=ctx.faceById.get(fid);for(const rawEid of face?.edgeIndices||[]){const edge=ctx.edgeById.get(Number(rawEid));if(edge&&exactStraightEdge(ctx,edge,tol))candidates.push(edge);}}
  candidates.sort((a,b)=>exactStraightEdgeLength(ctx,b)-exactStraightEdgeLength(ctx,a));if(candidates.length)u3=exactStraightEdgeDirection(ctx,candidates[0]);
  if(!u3){for(const fid of panel.faceIds){const st=ctx.statsById.get(fid);if(st?.triangles?.length){u3=V3.unit(V3.sub(st.triangles[0][1],st.triangles[0][0]));if(u3)break;}}}
  if(!u3)return null;const st=panel.stats;u3=V3.unit(V3.sub(u3,V3.scale(st.normal,V3.dot(u3,st.normal))))||u3;const v3=V3.unit(V3.cross(st.normal,u3));if(!v3)return null;
  return{origin3:st.centroid,origin2:[0,0],u3,v3,u2:[1,0],v2:[0,1]};
}
function mapPoint(map,p){const d=V3.sub(p,map.origin3),u=V3.dot(d,map.u3),v=V3.dot(d,map.v3);return V2.add(map.origin2,V2.add(V2.scale(map.u2,u),V2.scale(map.v2,v)));}

function panelMapAgreementError(ctx,panel,a,b){
  if(!panel||!a||!b)return Infinity;
  const samples=[];
  if(Array.isArray(panel.stats?.centroid))samples.push(panel.stats.centroid);
  for(const fid of panel.faceIds||[]){
    const tris=ctx.statsById.get(fid)?.triangles||[];
    for(let i=0;i<Math.min(tris.length,4);i++)for(const p of tris[i])samples.push(p);
    if(samples.length>=25)break;
  }
  let err=0;
  for(const p of samples)err=Math.max(err,V2.dist(mapPoint(a,p),mapPoint(b,p)));
  return err;
}

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
  let best=null,fallback=null;
  for(let i=0;i<cyl.boundaries.length;i++)for(let j=i+1;j<cyl.boundaries.length;j++){
    const a=cyl.boundaries[i],b=cyl.boundaries[j],geom=boundaryPairGeometry(cyl,a,b,planarGroups);
    if(geom?.ok){if(!best||geom.score>best.geom.score)best={a,b,geom};continue;}
    // Exact-topology fallback: two long axial B-Rep boundaries on distinct planar
    // panels plus a non-zero radial sweep are sufficient to identify a standard
    // cylindrical sheet bend. This avoids rejecting valid STEP bends when one
    // imported panel normal/centroid is numerically awkward. Hole walls do not
    // qualify here because their plane/cylinder boundaries are circular, not axial.
    const axis=V3.unit(cyl.axis),pa=planarGroups.byId.get(a.groupId),pb=planarGroups.byId.get(b.groupId);
    if(!axis||!pa||!pb||a.groupId===b.groupId)continue;
    const r0=radialToAxis(a.mid,cyl.center,axis),r1=radialToAxis(b.mid,cyl.center,axis),radialAngle=signedAngle(r0,r1,axis);
    if(!validStandardBendAngle(radialAngle))continue;
    const g={ok:true,angle:radialAngle,source:'exact-topology-radial',weight:5,score:Math.min(Number(a.length)||0,Number(b.length)||0)+0.005,axisDotA:Math.abs(V3.dot(pa.stats.normal,axis)),axisDotB:Math.abs(V3.dot(pb.stats.normal,axis)),axisGeometrySuspicious:false,planeAngle:Math.acos(clamp(Math.abs(V3.dot(pa.stats.normal,pb.stats.normal)),0,1)),radialAngle,travelAngle:0,normalAngle:0};
    if(!fallback||g.score>fallback.geom.score)fallback={a,b,geom:g};
  }
  return best||fallback;
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

  // V8.17.0 — skew/angled bend fix.
  // pb.mid and cb.mid are the mid-points of two *different* tangent boundaries.
  // On a rectangular bend their axial coordinates are usually identical, but on
  // a skewed/angled trim they are not. Mapping cb.mid directly to targetMid2 then
  // shifts the child flange along the bend axis and leaves an open contour. Keep
  // one absolute axial datum (pb.axisMid) for the bend and both adjacent panels.
  const childAxisShift=(Number(cb.axisMid)||0)-(Number(pb.axisMid)||0);
  const childOrigin2=V2.add(targetMid2,V2.scale(axis2,childAxisShift));
  const childMap={origin3:cb.mid,origin2:childOrigin2,u3:axis3,v3:childV3,u2:axis2,v2:outward};

  // The tessellated cylindrical skin must always run from 0 -> bendAllowance in
  // the developed view, regardless of axis orientation. Use the exact radial
  // sweep for interpolation and only use the chosen bend angle for BA magnitude.
  const rParent=radialToAxis(pb.mid,cyl.center,axis3),rChild=radialToAxis(cb.mid,cyl.center,axis3);
  const radialSweep=signedAngle(rParent,rChild,axis3);
  return{ok:true,parentGroupId,childGroupId,cyl,pb,cb,axis3,axis2,outward,parentMid2,targetMid2,totalAngle:total,radialSweep,angleDeg:Math.abs(total)*180/Math.PI,angleSource,innerRadius,radiusSource:radiusResolution.source,k,neutralRadius,bendAllowance,childMap,partnerRadius:radiusResolution.partner?.other?.radius??null};
}
const THREE_DEG=3*Math.PI/180;
const BEND_MIN_ANGLE=0.5*Math.PI/180;
const BEND_AXIS_PLANE_DOT_MAX=0.20;
const ANGLE_DISAGREE_TOL=2*Math.PI/180;

function projectPanelTriangles(ctx,panel,map){const out=[];for(const fid of panel.faceIds||[])for(const tri of ctx.statsById.get(fid)?.triangles||[])out.push(tri.map(p=>mapPoint(map,p)));return out;}
function mapBendPoint(mapping,p){
  const {cyl,pb,axis3,axis2,outward,parentMid2,bendAllowance}=mapping;
  const r0=radialToAxis(pb.mid,cyl.center,axis3),radial=radialToAxis(p,cyl.center,axis3),raw=signedAngle(r0,radial,axis3);
  const sweep=validStandardBendAngle(mapping.radialSweep)?mapping.radialSweep:mapping.totalAngle;
  const phi=angleCandidateInSpan(raw,sweep);
  // Parametric 0..1 mapping prevents an axis-sign mismatch from throwing bend
  // triangles to the wrong side of the flat pattern. A tiny tolerance is allowed
  // for STEP/tessellation noise, then clamped to the physical bend strip.
  const ratio=Math.abs(sweep)>EPS?clamp(phi/sweep,-1e-6,1+1e-6):0;
  const s=clamp(ratio,0,1)*bendAllowance,ax=V3.dot(V3.sub(p,pb.mid),axis3);
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
function angleInsideCcwSweep(start,end,angle,eps=1e-5){
  const sweep=ccwSweep(start,end),pos=ccwSweep(start,angle);
  return pos<=sweep+eps;
}
function chooseCircularArcDirection(start,end,samplePoints,center,desiredSweep){
  // A DXF ARC is always drawn counter-clockwise from group 50 to group 51.
  // For a 180° arc, start->end and end->start both have exactly the same length,
  // so edge length alone cannot tell us which semicircle is the real one. Use the
  // OCCT tessellated interior points to determine on which side of the chord the
  // B-Rep arc actually lies; keep exact length as a fallback/tie-breaker.
  const sampleAngles=(samplePoints||[])
    .map(p=>Math.atan2(p[1]-center[1],p[0]-center[0]))
    .filter(Number.isFinite);
  const score=(a,b)=>{
    const sweep=ccwSweep(a,b);let inside=0,outside=0;
    for(const t of sampleAngles){
      // Ignore samples effectively on either endpoint; they do not discriminate
      // between the two possible DXF semicircles.
      const da=Math.min(ccwSweep(a,t),ccwSweep(t,a));
      const db=Math.min(ccwSweep(b,t),ccwSweep(t,b));
      if(Math.min(da,db)<1e-4)continue;
      if(angleInsideCcwSweep(a,b,t))inside++;else outside++;
    }
    const lengthError=Number.isFinite(desiredSweep)?Math.abs(sweep-desiredSweep):0;
    return{a,b,inside,outside,lengthError,sweep};
  };
  const ab=score(start,end),ba=score(end,start);
  if(ab.inside!==ba.inside)return ab.inside>ba.inside?ab:ba;
  if(ab.outside!==ba.outside)return ab.outside<ba.outside?ab:ba;
  if(Math.abs(ab.lengthError-ba.lengthError)>1e-8)return ab.lengthError<ba.lengthError?ab:ba;
  return ab;
}
function boundaryPrimitivesForSkin(geometry,ctx,panelMaps,usedBends,tol,planarGroups,logicalGroups=[]){
  const bendByFace=new Map(),skinFaces=new Set();for(const groupId of panelMaps.keys())for(const fid of planarGroups.byId.get(groupId)?.faceIds||[])skinFaces.add(Number(fid));for(const bend of usedBends)for(const fid of bend.cyl.faceIds){bendByFace.set(Number(fid),bend);skinFaces.add(Number(fid));}
  // Map every source face to the same logical-face group used by the folded
  // viewer. This lets a hole wall remain one selectable cylindrical face after
  // unfolding even when OCCT split it into several B-Rep face fragments.
  const logicalByFace=new Map();for(const group of logicalGroups||[]){const ids=[...new Set((group?.faceIds||[]).map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);if(!ids.length)continue;for(const id of ids)logicalByFace.set(id,ids);}
  const primitives=[];
  for(const edge of geometry.edges||[]){
    const eid=Number(edge.id),allOwners=[...(ctx.edgeOwnersById.get(eid)||[])].map(Number),owners=allOwners.filter(id=>skinFaces.has(id));if(owners.length!==1)continue;const owner=owners[0],pts=edgePoints(edge);if(pts.length<2)continue;
    const wallFaceIds=[...new Set(allOwners.filter(id=>!skinFaces.has(id)).flatMap(id=>logicalByFace.get(id)||[id]))].sort((a,b)=>a-b);
    const wallMeta=wallFaceIds.length?{wallFaceIds}:{};
    const groupId=planarGroups.faceToGroup.get(owner),panelMap=groupId?panelMaps.get(groupId):null,bendMap=bendByFace.get(owner);if(!panelMap&&!bendMap)continue;const mapped=pts.map(p=>panelMap?mapPoint(panelMap,p):mapBendPoint(bendMap,p));
    const info=ctx.edgeInfoById.get(eid)||{},ef=family(info.family);
    if(panelMap&&['circle','circular'].includes(ef)&&Number.isFinite(Number(info.radius))&&Array.isArray(info.localCenter)){
      const center=mapPoint(panelMap,info.localCenter.map(Number).slice(0,3)),radius=Number(info.radius),length=Number(info.length),desired=Number.isFinite(length)&&radius>EPS?length/radius:NaN;
      if(Number.isFinite(desired)&&Math.abs(desired-TAU)<=1e-3){primitives.push({kind:'circle',center,radius,edgeId:eid,...wallMeta});continue;}
      const exactPts=exactEdgePoints(ctx,edge),mappedExact=exactPts.map(p=>mapPoint(panelMap,p));
      const a0=mappedExact[0]||mapped[0],b0=mappedExact.at(-1)||mapped.at(-1);
      const start=Math.atan2(a0[1]-center[1],a0[0]-center[0]),end=Math.atan2(b0[1]-center[1],b0[0]-center[0]);
      const chosen=chooseCircularArcDirection(start,end,mapped.slice(1,-1),center,desired);
      primitives.push({kind:'arc',center,radius,startRad:chosen.a,endRad:chosen.b,edgeId:eid,...wallMeta});continue;
    }
    if(['line','linear'].includes(ef)||isStraight2D(mapped,tol)){
      const exactPts=exactEdgePoints(ctx,edge),exactMapped=exactPts.map(p=>panelMap?mapPoint(panelMap,p):mapBendPoint(bendMap,p));
      primitives.push({kind:'line',a:exactMapped[0]||mapped[0],b:exactMapped.at(-1)||mapped.at(-1),edgeId:eid,...wallMeta});continue;
    }
    primitives.push({kind:'polyline',points:mapped,edgeId:eid,...wallMeta});
  }
  return primitives;
}

function primitiveEndpointPair(primitive){
  if(primitive?.kind==='line')return[primitive.a,primitive.b];
  if(primitive?.kind==='polyline'&&primitive.points?.length>1)return[primitive.points[0],primitive.points.at(-1)];
  if(primitive?.kind==='arc')return[
    [primitive.center[0]+Math.cos(primitive.startRad)*primitive.radius,primitive.center[1]+Math.sin(primitive.startRad)*primitive.radius],
    [primitive.center[0]+Math.cos(primitive.endRad)*primitive.radius,primitive.center[1]+Math.sin(primitive.endRad)*primitive.radius]
  ];
  return null;
}
function boundaryPrimitivesClosed(primitives,tol){
  const degree=new Map(),key=p=>quantKey(p,tol),add=p=>degree.set(key(p),(degree.get(key(p))||0)+1);
  for(const primitive of primitives||[]){const pair=primitiveEndpointPair(primitive);if(pair){add(pair[0]);add(pair[1]);}}
  return degree.size===0||[...degree.values()].every(v=>v>=2&&v%2===0);
}

function makeBendLine(mapping){
  const globalLo=Math.max(mapping.pb.axisMin,mapping.cb.axisMin),globalHi=Math.min(mapping.pb.axisMax,mapping.cb.axisMax);
  let a=Number.isFinite(globalLo)?globalLo-mapping.pb.axisMid:mapping.pb.minOffset,b=Number.isFinite(globalHi)?globalHi-mapping.pb.axisMid:mapping.pb.maxOffset;
  if(!(b>a)){a=mapping.pb.minOffset;b=mapping.pb.maxOffset;}
  const midS=mapping.bendAllowance/2;
  return{a:V2.add(mapping.parentMid2,V2.add(V2.scale(mapping.axis2,a),V2.scale(mapping.outward,midS))),b:V2.add(mapping.parentMid2,V2.add(V2.scale(mapping.axis2,b),V2.scale(mapping.outward,midS))),angleDeg:mapping.angleDeg,insideRadius:mapping.innerRadius,k:mapping.k,allowance:mapping.bendAllowance,sourceFaceIds:mapping.cyl.faceIds.slice()};
}

function dxfNum(v){if(!Number.isFinite(v))return'0';const n=Math.abs(v)<1e-10?0:v;return String(Number(n.toFixed(8)));}
const DXF_UNIT_DEFS={
  in:{insunits:1,measurement:0,scaleFromMm:1/25.4},
  ft:{insunits:2,measurement:0,scaleFromMm:1/(25.4*12)},
  mm:{insunits:4,measurement:1,scaleFromMm:1},
  cm:{insunits:5,measurement:1,scaleFromMm:0.1},
  m:{insunits:6,measurement:1,scaleFromMm:0.001}
};
export function flatPatternToDxf(result,{partName='NavoFlo_Flat_Pattern',units='in'}={}){
  if(!result?.ok)throw new Error('No valid flat pattern.');
  const unitKey=String(units||'in').toLowerCase(),unitDef=DXF_UNIT_DEFS[unitKey];
  if(!unitDef)throw new Error(`Unsupported DXF unit: ${units}`);

  // V8.17.0: graphical entities are inserted into a complete R2000 skeleton.
  // The former compact AC1015 file had model/paper BLOCK_RECORD entries without
  // their required LAYOUT object relationships; strict AutoCAD DXFIN rejected it.
  const lines=[];const add=(c,v)=>{lines.push(String(c),String(v));},scale=unitDef.scaleFromMm,sv=v=>Number(v)*scale,sp=p=>[sv(p[0]),sv(p[1])];
  let nextHandle=0x1000;
  const handle=()=>((nextHandle++).toString(16).toUpperCase());
  const entityBase=(type,layer,subclass)=>{add(0,type);add(5,handle());add(330,R2000_MODELSPACE_HANDLE);add(100,'AcDbEntity');add(8,layer);add(100,subclass);};
  const lineEntity=(layer,a,b)=>{a=sp(a);b=sp(b);entityBase('LINE',layer,'AcDbLine');add(10,dxfNum(a[0]));add(20,dxfNum(a[1]));add(30,0);add(11,dxfNum(b[0]));add(21,dxfNum(b[1]));add(31,0);};
  const rawPrimitives=Array.isArray(result.boundaryPrimitives)&&result.boundaryPrimitives.length?result.boundaryPrimitives:null;
  // Guard the laser/CAM export against an open topological contour. If an imported
  // STEP produces a primitive chain that does not close, fall back to the welded
  // triangulated boundary for that export rather than emitting an open CUT loop.
  const primitiveTol=Math.max((Number(result.thickness)||1)*1e-5,1e-6);
  const primitives=rawPrimitives&&boundaryPrimitivesClosed(rawPrimitives,primitiveTol)?rawPrimitives:null;
  if(primitives){
    for(const primitive of primitives){
      if(primitive.kind==='line')lineEntity('CUT',primitive.a,primitive.b);
      else if(primitive.kind==='circle'){
        const center=sp(primitive.center);entityBase('CIRCLE','CUT','AcDbCircle');add(10,dxfNum(center[0]));add(20,dxfNum(center[1]));add(30,0);add(40,dxfNum(sv(primitive.radius)));
      }else if(primitive.kind==='arc'){
        const center=sp(primitive.center);add(0,'ARC');add(5,handle());add(330,R2000_MODELSPACE_HANDLE);add(100,'AcDbEntity');add(8,'CUT');add(100,'AcDbCircle');add(10,dxfNum(center[0]));add(20,dxfNum(center[1]));add(30,0);add(40,dxfNum(sv(primitive.radius)));add(100,'AcDbArc');add(50,dxfNum((primitive.startRad*180/Math.PI+360)%360));add(51,dxfNum((primitive.endRad*180/Math.PI+360)%360));
      }else if(primitive.kind==='polyline'){
        for(let i=0;i+1<primitive.points.length;i++)lineEntity('CUT',primitive.points[i],primitive.points[i+1]);
      }
    }
  }else for(const [a,b] of result.boundaryEdges)lineEntity('CUT',a,b);
  for(const bend of result.bendLines)lineEntity('BEND',bend.a,bend.b);

  return wrapR2000Dxf({entitiesText:lines.join('\n'),insunits:unitDef.insunits,measurement:unitDef.measurement});
}

function chooseAutomaticFixedPanel(planarGroups,candidateBends,ctx){
  const bendCounts=new Map();
  for(const bend of candidateBends||[])for(const boundary of bend.boundaries||[]){
    const id=boundary.groupId;bendCounts.set(id,(bendCounts.get(id)||0)+1);
  }
  const connected=planarGroups.groups.filter(g=>(bendCounts.get(g.id)||0)>0);
  const pool=connected.length?connected:planarGroups.groups;
  if(!pool.length)return null;
  const ranked=[...pool].sort((a,b)=>{
    const ca=bendCounts.get(a.id)||0,cb=bendCounts.get(b.id)||0;
    // Prefer a physically large flange first; bend count only breaks near ties.
    const aa=Number(a.stats?.area)||0,ab=Number(b.stats?.area)||0;
    const scale=Math.max(aa,ab,EPS);
    if(Math.abs(ab-aa)>scale*0.02)return ab-aa;
    return cb-ca;
  });
  const panel=ranked[0];
  if(!panel)return null;
  const faceId=[...(panel.faceIds||[])].sort((a,b)=>(Number(ctx.statsById.get(b)?.area)||0)-(Number(ctx.statsById.get(a)?.area)||0))[0];
  return Number.isFinite(Number(faceId))?{panel,faceId:Number(faceId),automatic:true}:null;
}

export function analyzeAndUnfold({geometry,faceInfo,edgeInfo=[],logicalGroups=[],fixedFaceId=null,thickness=null,fallbackInsideRadius=null,kResolver}){
  if(!geometry) return{ok:false,code:'geometry-missing',message:'STEP geometry is unavailable.'};
  const {diag,tol}=geometryScale(geometry),ctx=buildFaceContext(geometry,faceInfo,edgeInfo);
  const planarGroups=buildPlanarGroups(geometry,ctx,tol);
  const cylinders=buildCylinderGroups(geometry,ctx,logicalGroups,tol,planarGroups);

  const hasRequestedFixed=fixedFaceId!==null&&fixedFaceId!==undefined&&fixedFaceId!==''&&Number.isFinite(Number(fixedFaceId)),requestedFixed=hasRequestedFixed?Number(fixedFaceId):NaN;
  // Only automatic preflight may promote the exact prism proof. A manually
  // selected fixed face remains a true expert override.
  const exactFlatPrism=!hasRequestedFixed?detectExactFlatPrism(geometry,ctx,planarGroups,tol,diag):null;
  const structuralProfile=!hasRequestedFixed&&!exactFlatPrism?detectStructuralProfileExtrusion(geometry,ctx,tol,diag):null;
  if(structuralProfile){
    return{ok:false,code:'structural-profile',message:'A long constant-section profile/extrusion was detected; sheet-metal unfolding is intentionally suppressed.',profile:true,profileType:structuralProfile.kind,profile:structuralProfile,diagnostics:{structuralProfile}};
  }

  let rejectedNonBendCylinders=0;
  const candidateBends=exactFlatPrism?[]:cylinders.map(c=>{
    const unique=[];for(const b of c.boundaries){if(!unique.some(x=>x.groupId===b.groupId))unique.push(b);}
    if(unique.length<2)return null;
    const candidate={...c,boundaries:unique},pair=chooseBendBoundaryPair(candidate,planarGroups);
    if(!pair){rejectedNonBendCylinders++;return null;}
    candidate.boundaries=[pair.a,pair.b];candidate.pairGeometry=pair.geom;return candidate;
  }).filter(Boolean);

  let fixed=requestedFixed,fixedGroupId=null,fixedPanel=null,fixedWasAutomatic=false;
  if(hasRequestedFixed){
    const fixedInfo=ctx.infoById.get(fixed);
    if(!ctx.faceById.has(fixed))return{ok:false,code:'fixed-face-missing',message:'The selected fixed face is not part of this geometry.'};
    if(!isPlanar(fixedInfo?.family))return{ok:false,code:'fixed-face-not-planar',message:'The fixed face must be planar.'};
    fixedGroupId=planarGroups.faceToGroup.get(fixed);fixedPanel=planarGroups.byId.get(fixedGroupId);
  }else{
    if(exactFlatPrism){
      // Use one proven cap as the DXF plane. Picking the translated cap pair here
      // prevents a rounded side-wall fillet from becoming the automatic fixed face.
      fixedPanel=exactFlatPrism.capA;fixedGroupId=fixedPanel.id;
      fixed=[...(fixedPanel.faceIds||[])].sort((a,b)=>(Number(ctx.statsById.get(b)?.area)||0)-(Number(ctx.statsById.get(a)?.area)||0))[0];
      fixedWasAutomatic=true;
    }else{
      const automatic=chooseAutomaticFixedPanel(planarGroups,candidateBends,ctx);
      if(automatic){fixed=automatic.faceId;fixedPanel=automatic.panel;fixedGroupId=automatic.panel.id;fixedWasAutomatic=true;}
    }
  }
  if(!fixedPanel)return{ok:false,code:'fixed-panel-missing',message:'A usable planar sheet panel could not be selected automatically.'};

  // V8.17.3 — for a zero-bend/prismatic plate, trust the two dominant parallel
  // planar skins before any cylindrical radius pairing. Counterbores, concentric
  // holes and machined circular details can otherwise look like a thickness pair
  // even though the part is simply a flat plate ready for DXF.
  const planarThickness=detectPlanarThickness(planarGroups,tol);
  const cylindricalThickness=detectThickness(cylinders,tol);
  const exactFlatThickness=exactFlatPrism?{value:exactFlatPrism.value,count:2,samples:2,confidence:1,source:exactFlatPrism.source,groups:exactFlatPrism.groups}:null;
  const autoThickness=exactFlatThickness||((candidateBends.length===0&&planarThickness)?planarThickness:(cylindricalThickness||planarThickness));
  let resolvedThickness=Number(thickness);
  if(!Number.isFinite(resolvedThickness)||resolvedThickness<=0)resolvedThickness=Number(autoThickness?.value);
  if(!Number.isFinite(resolvedThickness)||resolvedThickness<=0)return{ok:false,code:'thickness-unresolved',message:'Sheet thickness could not be detected. Enter T and try again.',detectedThickness:autoThickness,fixedFaceId:fixed};

  const warnings=[];if(autoThickness&&Number.isFinite(Number(thickness))&&Number(thickness)>0){const delta=Math.abs(Number(thickness)-autoThickness.value);if(delta>Math.max(resolvedThickness*0.12,tol*20))warnings.push('Entered thickness differs from the cylindrical-face thickness estimate.');}
  const bendsByGroup=new Map();for(const bend of candidateBends){for(const b of bend.boundaries){if(!bendsByGroup.has(b.groupId))bendsByGroup.set(b.groupId,[]);bendsByGroup.get(b.groupId).push(bend);}}
  const rootMap=makeRootMap(ctx,fixedPanel,tol);if(!rootMap)return{ok:false,code:'fixed-face-map',message:'Unable to establish a coordinate system on the fixed face.'};

  const panelMaps=new Map([[fixedGroupId,rootMap]]),panelOrder=[fixedGroupId],usedBends=[],usedCylinderIds=new Set(),queue=[fixedGroupId],cycleLinks=[],cycleClosures=[];
  while(queue.length){
    const parentGroupId=queue.shift(),parentMap=panelMaps.get(parentGroupId);
    for(const cyl of bendsByGroup.get(parentGroupId)||[]){
      if(usedCylinderIds.has(cyl.id))continue;const other=cyl.boundaries.find(b=>b.groupId!==parentGroupId);if(!other)continue;const childGroupId=other.groupId;
      if(panelMaps.has(childGroupId)){
        // V8.17.1 — closure-bend reconstruction.
        // A hole crossing a bend can split that one physical bend into two or more
        // disconnected cylindrical patches. The surface graph then contains a
        // harmless cycle. V8.17.0 dropped the last patch as a spanning-tree seam,
        // which showed up as an artificial slit in the flat pattern. Rebuild the
        // patch and keep it whenever both unfold paths predict the same child map.
        const mapping=createBendMapping({cyl,parentGroupId,childGroupId,parentMap,ctx,planarGroups,thickness:resolvedThickness,kResolver,fallbackRadius:fallbackInsideRadius,tol,cylinders});
        const childPanel=planarGroups.byId.get(childGroupId),existingMap=panelMaps.get(childGroupId);
        const closureError=mapping.ok?panelMapAgreementError(ctx,childPanel,existingMap,mapping.childMap):Infinity;
        const closureTol=Math.max(tol*50,resolvedThickness*0.002,1e-5);
        if(mapping.ok&&Number.isFinite(closureError)&&closureError<=closureTol){
          mapping.cycleClosure=true;mapping.closureError=closureError;usedBends.push(mapping);
          cycleClosures.push({parentGroupId,childGroupId,cylinder:cyl.id,error:closureError,tolerance:closureTol});
          usedCylinderIds.add(cyl.id);continue;
        }
        cycleLinks.push({parentGroupId,childGroupId,cylinder:cyl.id,closureError:Number.isFinite(closureError)?closureError:null,closureTolerance:closureTol});usedCylinderIds.add(cyl.id);continue;
      }
      const mapping=createBendMapping({cyl,parentGroupId,childGroupId,parentMap,ctx,planarGroups,thickness:resolvedThickness,kResolver,fallbackRadius:fallbackInsideRadius,tol,cylinders});
      if(!mapping.ok){warnings.push(`Bend ${cyl.faceIds.join('/')} skipped: ${mapping.code}.`);cyl.lastFailure={code:mapping.code,diagnostics:mapping.diagnostics||null};usedCylinderIds.add(cyl.id);continue;}
      panelMaps.set(childGroupId,mapping.childMap);panelOrder.push(childGroupId);usedBends.push(mapping);usedCylinderIds.add(cyl.id);queue.push(childGroupId);
    }
  }
  if(cycleLinks.length)warnings.push('Closed/cyclic sheet topology contains an inconsistent closure; a spanning-tree seam was kept for safety.');
  if(!usedBends.length){
    const connectedBends=(bendsByGroup.get(fixedGroupId)||[]),connected=connectedBends.length,diagnostics={planarGroups:planarGroups.groups.length,fixedPanelFaces:fixedPanel.faceIds.slice(),cylinders:cylinders.length,candidateBends:candidateBends.length,rejectedNonBendCylinders,fixedPanelCandidateBends:connected,tolerance:tol,exactFlatPrism:exactFlatPrism?{source:exactFlatPrism.source,groups:exactFlatPrism.groups,thickness:exactFlatPrism.value,areaRatio:exactFlatPrism.areaRatio,boundaryEdges:exactFlatPrism.boundaryEdges,supportError:exactFlatPrism.supportError}:null,failures:connectedBends.map(c=>({faces:c.faceIds.slice(),radius:c.radius,radialNormalScore:c.radialNormalScore,failure:c.lastFailure||null}))};

    // V8.17.2 — zero-bend STEP support. A plain plate is already its own flat
    // pattern, so return the exact dominant planar skin instead of treating
    // "no bends" as an error. This gives the same one-click DXF workflow to
    // laser-cut plates and to formed sheet-metal parts.
    if(!connected&&candidateBends.length===0&&(exactFlatPrism||autoThickness?.source==='parallel-planar-skins')){
      const mapped=projectPanelTriangles(ctx,fixedPanel,rootMap),triangles=mapped,flatTol=Math.max(diag*1e-6,resolvedThickness*1e-5,1e-6);
      const boundaryEdges=computeBoundaryEdges(triangles,flatTol),boundaryPrimitives=boundaryPrimitivesForSkin(geometry,ctx,panelMaps,[],flatTol,planarGroups,logicalGroups),bounds=bounds2D(triangles);
      if(triangles.length&&boundaryEdges.length){
        const primitivesClosed=boundaryPrimitivesClosed(boundaryPrimitives,Math.max(resolvedThickness*1e-5,1e-6));
        if(!primitivesClosed)warnings.push('Exact CUT primitives contain an open chain; DXF export will use the welded mesh boundary as a safe fallback.');
        return{ok:true,version:'NavoUnfold MVP 2.0',flatPlate:true,fixedFaceId:fixed,fixedFaceAutomatic:fixedWasAutomatic,fixedPanelFaceIds:fixedPanel.faceIds.slice(),geometryId:String(geometry.id),thickness:resolvedThickness,detectedThickness:autoThickness,panelFaceIds:fixedPanel.faceIds.slice(),bendCount:0,panelCount:1,triangles,selectionFaces:[{id:'flat-panel-1',kind:'panel',sourceFaceIds:fixedPanel.faceIds.slice(),triangles:mapped}],boundaryEdges,boundaryPrimitives,boundaryPrimitivesClosed:primitivesClosed,bendLines:[],bounds,warnings,cycleLinks:[],cycleClosures:[],diagnostics:{...diagnostics,flatPlate:true}};
      }
    }

    const message=connected?'A cylindrical bend touches the fixed panel, but its geometry could not be resolved safely. Check T / inside radius / K-factor.':'No standard cylindrical bend connected to the fixed panel was detected.';
    return{ok:false,code:connected?'bend-resolution-failed':'no-bends',message,detectedThickness:autoThickness,warnings,diagnostics,fixedFaceId:fixed};
  }

  const selectionFaces=[],panelTriangles=[];
  for(const groupId of panelOrder){
    const panel=planarGroups.byId.get(groupId);if(!panel)continue;
    const mapped=projectPanelTriangles(ctx,panel,panelMaps.get(groupId));panelTriangles.push(...mapped);
    if(mapped.length)selectionFaces.push({id:`flat-panel-${selectionFaces.length+1}`,kind:'panel',sourceFaceIds:panel.faceIds.slice(),triangles:mapped});
  }
  const bendTriangles=[];
  for(const bend of usedBends){
    const mapped=projectBendTriangles(ctx,bend);bendTriangles.push(...mapped);
    if(mapped.length)selectionFaces.push({id:`flat-bend-${selectionFaces.length+1}`,kind:'bend',sourceFaceIds:bend.cyl.faceIds.slice(),triangles:mapped});
  }
  const triangles=[...panelTriangles,...bendTriangles],flatTol=Math.max(diag*1e-6,resolvedThickness*1e-5,1e-6),boundaryEdges=computeBoundaryEdges(triangles,flatTol),boundaryPrimitives=boundaryPrimitivesForSkin(geometry,ctx,panelMaps,usedBends,flatTol,planarGroups,logicalGroups),bendLines=usedBends.map(makeBendLine),bounds=bounds2D(triangles);
  if(!triangles.length||!boundaryEdges.length)return{ok:false,code:'flat-empty',message:'The flat pattern could not be reconstructed.',warnings};
  const primitivesClosed=boundaryPrimitivesClosed(boundaryPrimitives,Math.max(resolvedThickness*1e-5,1e-6));
  if(!primitivesClosed)warnings.push('Exact CUT primitives contain an open chain; DXF export will use the welded mesh boundary as a safe fallback.');
  const panelFaceIds=panelOrder.flatMap(id=>planarGroups.byId.get(id)?.faceIds||[]);
  return{ok:true,version:'NavoUnfold MVP 2.0',fixedFaceId:fixed,fixedFaceAutomatic:fixedWasAutomatic,fixedPanelFaceIds:fixedPanel.faceIds.slice(),geometryId:String(geometry.id),thickness:resolvedThickness,detectedThickness:autoThickness,panelFaceIds,bendCount:usedBends.length,panelCount:panelOrder.length,triangles,selectionFaces,boundaryEdges,boundaryPrimitives,boundaryPrimitivesClosed:primitivesClosed,bendLines,bounds,warnings,cycleLinks,cycleClosures,diagnostics:{planarGroups:planarGroups.groups.length,fixedPanelFaces:fixedPanel.faceIds.slice(),cylinders:cylinders.length,candidateBends:candidateBends.length,rejectedNonBendCylinders,tolerance:tol}};
}
