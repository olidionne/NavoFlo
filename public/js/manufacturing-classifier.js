/* NavoFlo V8.18.1 — manufacturing / stock-shape classifier.
 *
 * Geometry-only inference from exact STEP analytic faces/edges + the retained
 * tessellated solid.  V8.18.1 deliberately does NOT require a valid signed
 * triangle volume before recognizing stock.  Some STEP tessellations can have
 * per-face winding that makes a divergence-theorem volume cancel even though
 * the B-Rep itself is perfectly valid.  Stock recognition is therefore driven
 * first by exact analytic envelope evidence; volume is used only when it is
 * self-consistent enough to estimate material removal.
 *
 * Structural AISC/profile arbitration remains outside this module and has
 * priority in viewer.js.  This module is for generic stock (round/square/flat/
 * rectangular/hex) and probable secondary machining.
 */
const EPS=1e-9;
const V={
  dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
  add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
  scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],
  len:a=>Math.hypot(a[0],a[1],a[2]),
  unit(a){const l=this.len(a);return l>EPS?this.scale(a,1/l):null;}
};
function clamp(x,a=0,b=1){return Math.max(a,Math.min(b,x));}
function fam(v){return String(v||'').toLowerCase();}
function canonicalAxis(v){let n=V.unit(v);if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=V.scale(n,-1);return n;}
function pointsOf(geometry){const p=geometry?.positions||[],out=[];for(let i=0;i+2<p.length;i+=3){const q=[Number(p[i]),Number(p[i+1]),Number(p[i+2])];if(q.every(Number.isFinite))out.push(q);}return out;}
function extent(points,axis){let lo=Infinity,hi=-Infinity;for(const p of points){const d=V.dot(p,axis);lo=Math.min(lo,d);hi=Math.max(hi,d);}return Number.isFinite(lo)&&Number.isFinite(hi)?hi-lo:0;}
function axisLineDistance(ca,axis,cb){const d=V.sub(cb,ca),t=V.dot(d,axis);return V.len(V.sub(d,V.scale(axis,t)));}
function sameAxisLine(aAxis,aCenter,bAxis,bCenter,tol){if(!aAxis||!bAxis||!aCenter||!bCenter)return false;if(Math.abs(V.dot(aAxis,bAxis))<0.9995)return false;return axisLineDistance(aCenter,aAxis,bCenter)<=tol;}

// Signed mesh volume is useful when the tessellation is coherently oriented,
// but is optional.  Callers must treat null/unreasonable values as "unknown".
function signedMeshVolume(geometry){
  const p=geometry?.positions||[],idx=geometry?.indices||[];if(p.length<9||idx.length<3)return null;let six=0;
  for(let i=0;i+2<idx.length;i+=3){
    const ia=Number(idx[i])*3,ib=Number(idx[i+1])*3,ic=Number(idx[i+2])*3;if(ic+2>=p.length)continue;
    const ax=Number(p[ia]),ay=Number(p[ia+1]),az=Number(p[ia+2]),bx=Number(p[ib]),by=Number(p[ib+1]),bz=Number(p[ib+2]),cx=Number(p[ic]),cy=Number(p[ic+1]),cz=Number(p[ic+2]);
    if(![ax,ay,az,bx,by,bz,cx,cy,cz].every(Number.isFinite))continue;
    six+=ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx);
  }
  const v=Math.abs(six/6);return Number.isFinite(v)&&v>EPS?v:null;
}
function usableVolumeRatio(volume,stockVolume){if(!(volume>EPS&&stockVolume>EPS))return null;const r=volume/stockVolume;return Number.isFinite(r)&&r>0.01&&r<=1.08?r:null;}

function lineClusters(edgeInfo=[]){
  const clusters=[];
  for(const e of edgeInfo){
    if(!['line','linear'].includes(fam(e.family)))continue;
    const a=Array.isArray(e.localStartPoint)?e.localStartPoint.map(Number):null,b=Array.isArray(e.localEndPoint)?e.localEndPoint.map(Number):null;
    if(!a||!b||a.length<3||b.length<3||!a.slice(0,3).every(Number.isFinite)||!b.slice(0,3).every(Number.isFinite))continue;
    const d=V.sub(b,a),L=Number(e.length)||V.len(d),axis=canonicalAxis(d);if(!(L>EPS)||!axis)continue;
    let c=clusters.find(x=>Math.abs(V.dot(x.axis,axis))>=0.9995);if(!c){c={axis,members:[],score:0};clusters.push(c);}c.members.push({edge:e,length:L,a:a.slice(0,3),b:b.slice(0,3)});c.score+=L;
  }
  clusters.sort((a,b)=>b.score-a.score);return clusters;
}
function cylinders(faceInfo=[]){
  const out=[];
  for(const f of faceInfo){
    if(!['cylinder','cylindrical'].includes(fam(f.family)))continue;
    const axis=canonicalAxis(Array.isArray(f.axisDirection)?f.axisDirection.map(Number):null),r=Number(f.radius),center=Array.isArray(f.localCenter)?f.localCenter.map(Number).slice(0,3):null,area=Number(f.area)||0;
    if(!axis||!(r>EPS)||!center?.every(Number.isFinite))continue;out.push({face:f,axis,r,center,area});
  }
  return out;
}
function planeNormalClusters(faceInfo,axis){
  const clusters=[];
  for(const f of faceInfo){
    if(fam(f.family)!=='plane')continue;const n=canonicalAxis(Array.isArray(f.localNormal)?f.localNormal.map(Number):null);if(!n||Math.abs(V.dot(n,axis))>0.08)continue;
    const area=Number(f.area)||0;let c=clusters.find(x=>Math.abs(V.dot(x.n,n))>=0.995);if(!c){c={n,area:0,count:0};clusters.push(c);}c.area+=area;c.count++;
  }
  clusters.sort((a,b)=>b.area-a.area);return clusters;
}

function featureSummary(faceInfo,stockAxis,stockCenter=null,stockRadius=null){
  let cones=0,tori=0,cylindersCount=0,transverseCylinders=0,parallelOffAxisCylinders=0,coaxialOtherRadii=0,planes=0;
  const axisTol=Math.max(Number(stockRadius)||1,1)*1e-3;
  for(const f of faceInfo){
    const g=fam(f.family);
    if(g==='cone')cones++;
    else if(g==='torus')tori++;
    else if(g==='plane')planes++;
    else if(['cylinder','cylindrical'].includes(g)){
      cylindersCount++;
      const a=canonicalAxis(Array.isArray(f.axisDirection)?f.axisDirection.map(Number):null),c=Array.isArray(f.localCenter)?f.localCenter.map(Number).slice(0,3):null;
      if(a&&stockAxis){
        const align=Math.abs(V.dot(a,stockAxis));
        if(align<0.98)transverseCylinders++;
        else if(c&&stockCenter&&axisLineDistance(stockCenter,stockAxis,c)>axisTol)parallelOffAxisCylinders++;
        else if(Number.isFinite(stockRadius)&&Math.abs(Number(f.radius)-stockRadius)>Math.max(stockRadius*0.01,1e-4))coaxialOtherRadii++;
      }
    }
  }
  const hints=[];
  if(coaxialOtherRadii>0)hints.push('turning');
  if(transverseCylinders>0||parallelOffAxisCylinders>0)hints.push('drilling');
  if(cones>0)hints.push('chamfering');
  if(tori>0)hints.push('fillets');
  return{cones,tori,cylinders:cylindersCount,transverseCylinders,parallelOffAxisCylinders,coaxialOtherRadii,planes,hints};
}

function roundCandidate(geometry,faceInfo,points,volume){
  const cyls=cylinders(faceInfo);let best=null;
  for(const outer of cyls){
    const axis=outer.axis,R=outer.r,center=outer.center,L=extent(points,axis);if(!(L>EPS&&R>EPS))continue;
    let maxRad=0;for(const p of points){const rel=V.sub(p,center),t=V.dot(rel,axis),rad=V.len(V.sub(rel,V.scale(axis,t)));maxRad=Math.max(maxRad,rad);}
    const envelopeError=Math.abs(maxRad-R)/R;if(envelopeError>0.08)continue;

    const axisTol=Math.max(R*1e-4,1e-5),radiusTol=Math.max(R*1e-4,1e-5);
    const outerFragments=cyls.filter(c=>sameAxisLine(axis,center,c.axis,c.center,axisTol)&&Math.abs(c.r-R)<=radiusTol);
    const lateralArea=2*Math.PI*R*L,coverage=lateralArea>EPS?outerFragments.reduce((s,c)=>s+Math.max(c.area,0),0)/lateralArea:0;
    // A real raw round envelope normally leaves at least some cylindrical OD.
    // Very short turned disks can still have modest coverage because both ends
    // are heavily chamfered, so keep the threshold intentionally low.
    if(coverage<0.01&&L/(2*R)>0.35)continue;

    const stockVolume=Math.PI*R*R*L,volumeRatio=usableVolumeRatio(volume,stockVolume),removal=volumeRatio==null?null:clamp(1-volumeRatio,0,1);
    const features=featureSummary(faceInfo,axis,center,R);
    const featureMachining=features.cones>0||features.tori>0||features.transverseCylinders>0||features.parallelOffAxisCylinders>0||features.coaxialOtherRadii>0||features.planes>2;
    const machined=featureMachining||(Number.isFinite(removal)&&removal>0.003);
    const confidence=clamp(0.90+Math.min(coverage,1)*0.08-envelopeError*2.2-(coverage<0.15?0.03:0));
    const c={stockType:'round-bar',axis,axisCenter:center,lengthMm:L,diameterMm:2*R,stockVolume,volumeRatio,materialRemoval:removal,machined,features,confidence,aspect:L/(2*R),envelopeError,stockSurfaceCoverage:coverage,volumeReliable:volumeRatio!=null};
    if(!best||score(c)>score(best))best=c;
  }
  return best;
}

function rectangularCandidate(geometry,faceInfo,edgeInfo,points,volume){
  const line=lineClusters(edgeInfo)[0];if(!line||line.members.length<2)return null;const axis=line.axis,L=extent(points,axis);if(!(L>EPS))return null;
  const normals=planeNormalClusters(faceInfo,axis);if(normals.length<2)return null;const u=normals[0].n,vEntry=normals.slice(1).find(c=>Math.abs(V.dot(u,c.n))<0.12);if(!vEntry)return null;const v=vEntry.n,w=extent(points,u),h=extent(points,v);if(!(w>EPS&&h>EPS))return null;
  const stockVolume=L*w*h,volumeRatio=usableVolumeRatio(volume,stockVolume),removal=volumeRatio==null?null:clamp(1-volumeRatio,0,1);
  const major=Math.max(w,h),minor=Math.min(w,h),crossRatio=major/minor,aspect=L/major;let stockType='rectangular-bar';if(crossRatio<=1.08)stockType='square-bar';else if(crossRatio>=2.5)stockType='flat-bar';
  const features=featureSummary(faceInfo,axis,null,null),expectedPlaneCount=6,featureMachining=features.cylinders>0||features.cones>0||features.tori>0||features.planes>expectedPlaneCount,machined=featureMachining||(Number.isFinite(removal)&&removal>0.003);
  // Do not reject solely because mesh volume is unavailable or pessimistic.
  // Envelope + exact orthogonal planar families are sufficient to identify the
  // probable bar stock; structural profiles are filtered by viewer arbitration.
  let confidence=0.84+Math.min(aspect,5)*0.012+Math.min(line.members.length,8)*0.005;
  if(volumeRatio!=null){if(volumeRatio<0.05)confidence-=0.15;else confidence+=Math.min(volumeRatio,1)*0.04;}
  confidence=clamp(confidence);
  return{stockType,axis,lengthMm:L,widthMm:major,thicknessMm:minor,stockVolume,volumeRatio,materialRemoval:removal,machined,features,confidence,aspect,normalFamilyCount:normals.length,volumeReliable:volumeRatio!=null};
}

function hexCandidate(geometry,faceInfo,edgeInfo,points,volume){
  const line=lineClusters(edgeInfo)[0];if(!line||line.members.length<4)return null;const axis=line.axis,L=extent(points,axis),normals=planeNormalClusters(faceInfo,axis);if(!(L>EPS)||normals.length<3)return null;
  const dirs=[];for(const c of normals){if(dirs.every(d=>Math.abs(V.dot(d,c.n))<0.995))dirs.push(c.n);if(dirs.length===3)break;}if(dirs.length!==3)return null;
  const widths=dirs.map(n=>extent(points,n)),mean=widths.reduce((a,b)=>a+b,0)/3;if(!(mean>EPS))return null;const spread=(Math.max(...widths)-Math.min(...widths))/mean;if(spread>0.08)return null;
  const angles=[];for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)angles.push(Math.acos(clamp(Math.abs(V.dot(dirs[i],dirs[j])),-1,1))*180/Math.PI);if(!angles.every(a=>a>50&&a<70))return null;
  const area=Math.sqrt(3)/2*mean*mean,stockVolume=area*L,volumeRatio=usableVolumeRatio(volume,stockVolume),removal=volumeRatio==null?null:clamp(1-volumeRatio,0,1),features=featureSummary(faceInfo,axis,null,null),machined=features.cylinders>0||features.cones>0||features.tori>0||features.planes>8||(Number.isFinite(removal)&&removal>0.003);
  return{stockType:'hex-bar',axis,lengthMm:L,acrossFlatsMm:mean,stockVolume,volumeRatio,materialRemoval:removal,machined,features,confidence:clamp(0.90-spread*1.8+Math.min(L/mean,6)*0.006),aspect:L/mean,volumeReliable:volumeRatio!=null};
}
function score(c){if(!c)return-Infinity;let s=Number(c.confidence)||0;if(c.stockType==='round-bar')s+=0.06;if(c.volumeReliable)s+=0.01;return s;}

export function classifyManufacturingGeometry({geometry,faceInfo=[],edgeInfo=[]}={}){
  const points=pointsOf(geometry);if(points.length<4)return null;const volume=signedMeshVolume(geometry);
  const candidates=[roundCandidate(geometry,faceInfo,points,volume),hexCandidate(geometry,faceInfo,edgeInfo,points,volume),rectangularCandidate(geometry,faceInfo,edgeInfo,points,volume)].filter(Boolean);
  if(!candidates.length)return null;candidates.sort((a,b)=>score(b)-score(a));const best=candidates[0];
  const evidence=[];if(best.features?.hints?.length)evidence.push(...best.features.hints);if(Number.isFinite(best.materialRemoval)&&best.materialRemoval>0.003)evidence.push('material-removal');
  return{...best,kind:'stock-shape',process:best.machined?'machining':'stock-profile',evidence:[...new Set(evidence)],volumeMm3:volume,diagnostics:{candidateCount:candidates.length,volumeReliable:Boolean(best.volumeReliable),stockSurfaceCoverage:Number.isFinite(best.stockSurfaceCoverage)?best.stockSurfaceCoverage:null,envelopeError:Number.isFinite(best.envelopeError)?best.envelopeError:null}};
}
