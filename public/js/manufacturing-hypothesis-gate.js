import { detectTurningByGpAx1 } from './manufacturing-machining-evidence.js?v=8.23.1';

// NavoFlo V8.23.1 — deterministic manufacturing hypothesis gate.
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
  const r=detectTurningByGpAx1(faceInfo);
  return{recognized:Boolean(r.recognized),confidence:Number(r.confidence)||0,analyticCount:Number(r.revolutionFaceCount)||0,dominantCount:Number(r.dominantFaceCount)||0,dominantFraction:Number(r.collinearFraction)||0,cylinderCount:Number(r.cylinderCount)||0,coneCount:Number(r.coneCount)||0,torusCount:Number(r.torusCount)||0,distinctRadii:Number(r.distinctRadii)||0,axis:r.axis||null,axisCenter:r.axisCenter||null,axisToleranceMm:Number(r.axisToleranceMm)||null};
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
  const turnFeatures=(knowledge.featureInstances||[]).filter(f=>String(f?.process||'')==='turning'&&!f?.parameters?.advisoryOnly),turns=turnFeatures.length;
  const gpAx1=turnFeatures.find(f=>f?.parameters?.gpAx1Proof===true&&Number(f?.parameters?.gpAx1CollinearFraction)>0.80&&Number(f?.confidence)>=0.88);
  const envelopeError=Number(stock.envelopeError),coverage=Number(stock.stockSurfaceCoverage);
  return turning&&(turns>=2||Boolean(gpAx1))&&aspect>=0.75&&confidence>=0.76&&(!Number.isFinite(envelopeError)||envelopeError<=0.06)&&(!Number.isFinite(coverage)||coverage>=0.003);
}

export const MANUFACTURING_HYPOTHESIS_GATE_VERSION='8.23.1';
