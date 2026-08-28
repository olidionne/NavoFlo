// NavoFlo V8.21.2 — deterministic manufacturing hypothesis gate.
//
// Sheet-metal, structural-stock and machining recognition are independent
// hypotheses.  A lightweight sheet-metal pass is allowed to be fast, but it is
// not allowed to become authoritative when the same B-Rep contains a strong
// rotational-stock signature.  This gate decides when Navo3D must obtain the
// full exact manufacturing descriptors before accepting a sheet hypothesis.

const EPS=1e-9;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const vec=v=>Array.isArray(v)&&v.length>=3?v.slice(0,3).map(Number):null;
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const len=a=>Math.hypot(a[0],a[1],a[2]);
function unit(a){const l=len(a||[]);return l>EPS?scale(a,1/l):null;}
function canonicalAxis(v){let n=unit(vec(v));if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=scale(n,-1);return n;}
function lineDistance(centerA,axis,centerB){const d=sub(centerB,centerA),p=scale(axis,dot(d,axis));return len(sub(d,p));}
function family(v){return String(v||'').toLowerCase();}

export function rotationalMachiningSignature(faceInfo=[]){
  const records=[];
  for(const f of faceInfo||[]){
    const fam=family(f?.family);if(!['cylinder','cylindrical','cone','conical','torus','toroidal'].includes(fam))continue;
    const axis=canonicalAxis(f?.axisDirection),center=vec(f?.localCenter);if(!axis||!center?.every(Number.isFinite))continue;
    records.push({id:Number(f.id),family:fam,axis,center,radius:Number(f?.radius),area:Number(f?.area)||0});
  }
  if(records.length<4)return{recognized:false,confidence:0,analyticCount:records.length,dominantCount:0,distinctRadii:0,coneCount:0,torusCount:0};
  const radii=records.map(r=>r.radius).filter(v=>Number.isFinite(v)&&v>0),scaleMm=Math.max(...radii,1),axisTol=Math.max(scaleMm*0.008,0.08),groups=[];
  for(const r of records){
    let g=groups.find(x=>Math.abs(dot(x.axis,r.axis))>=0.999&&lineDistance(x.center,x.axis,r.center)<=axisTol);
    if(!g){g={axis:r.axis,center:r.center,members:[]};groups.push(g);}g.members.push(r);
  }
  groups.sort((a,b)=>b.members.length-a.members.length);const best=groups[0];if(!best)return{recognized:false,confidence:0,analyticCount:records.length,dominantCount:0,distinctRadii:0,coneCount:0,torusCount:0};
  const radialStep=Math.max(scaleMm*0.004,0.04),unique=[];
  for(const r of best.members.map(m=>m.radius).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b)){if(!unique.length||Math.abs(unique.at(-1)-r)>radialStep)unique.push(r);}
  const coneCount=best.members.filter(m=>['cone','conical'].includes(m.family)).length,torusCount=best.members.filter(m=>['torus','toroidal'].includes(m.family)).length,cylinderCount=best.members.filter(m=>['cylinder','cylindrical'].includes(m.family)).length;
  const dominantFraction=best.members.length/records.length;
  // A normal press-brake bend contributes roughly one inner + one outer
  // cylinder on one axis.  A turned shaft contributes several coaxial radii and
  // commonly cones/tori/shoulders on that SAME axis.  Perforated sheet holes do
  // not pass because their axes are parallel but not the same axis line.
  const complexRadii=unique.length>=3;
  const rotationalDetail=coneCount+torusCount>=2;
  const recognized=best.members.length>=5&&dominantFraction>=0.58&&cylinderCount>=3&&(complexRadii||rotationalDetail);
  const confidence=recognized?clamp(0.72+Math.min((best.members.length-5)*0.018,0.12)+Math.min((unique.length-3)*0.025,0.08)+Math.min((coneCount+torusCount)*0.012,0.07)+Math.max(0,dominantFraction-0.58)*0.12):0;
  return{recognized,confidence,analyticCount:records.length,dominantCount:best.members.length,dominantFraction,cylinderCount,coneCount,torusCount,distinctRadii:unique.length,axis:best.axis,axisCenter:best.center,axisToleranceMm:axisTol};
}

export function requiresIndependentManufacturingReview({faceInfo=[],sheetResult=null,structuralNameHint=null,fastenerHint=null}={}){
  if(Boolean(structuralNameHint)||Boolean(fastenerHint?.recognized))return{required:true,reason:structuralNameHint?'structural-metadata':'fastener-metadata',rotational:null};
  if(!(sheetResult?.ok&&Number(sheetResult?.bendCount)>0))return{required:true,reason:'sheet-not-proven',rotational:null};
  if(sheetResult?.diagnostics?.structuralProfile)return{required:true,reason:'constant-section-profile-candidate',rotational:null};
  const rotational=rotationalMachiningSignature(faceInfo);
  if(rotational.recognized)return{required:true,reason:'coaxial-rotational-complexity',rotational};
  return{required:false,reason:'simple-sheet-hypothesis',rotational};
}

export function hasRoundStockMachiningAuthority(knowledge){
  if(!knowledge||knowledge?.stock?.stockType!=='round-bar')return false;
  const stock=knowledge.stock||{},confidence=Math.max(Number(stock.confidence)||0,Number(knowledge.confidence)||0),aspect=Number(stock.aspect)||0,turning=Boolean(knowledge?.processes?.turning);
  const turns=(knowledge.featureInstances||[]).filter(f=>String(f?.process||'')==='turning').length;
  const envelopeError=Number(stock.envelopeError),coverage=Number(stock.stockSurfaceCoverage);
  return turning&&turns>=2&&aspect>=0.75&&confidence>=0.76&&(!Number.isFinite(envelopeError)||envelopeError<=0.06)&&(!Number.isFinite(coverage)||coverage>=0.003);
}

export const MANUFACTURING_HYPOTHESIS_GATE_VERSION='8.21.2';
