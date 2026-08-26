// NavoFlo V8.17.8 — local AISC structural-shape matcher.
//
// The AISC table is loaded lazily only after Navo3D has already proven that a
// STEP body is a long constant-section profile/extrusion. Matching is therefore
// an identification layer, not a replacement for geometric classification.
// The local STEP geometry remains the source of truth.

const DB_URL='/data/aisc-shapes-v16.json?v=16.0-nf8178';
let dbPromise=null;

function finite(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function pairSorted(a,b){return [Number(a)||0,Number(b)||0].sort((x,y)=>y-x);}

export async function loadAiscShapes(){
  if(!dbPromise){
    dbPromise=fetch(DB_URL,{cache:'force-cache'}).then(async r=>{
      if(!r.ok)throw new Error(`AISC database ${r.status}`);
      const data=await r.json();
      const fields=Array.isArray(data?.fields)?data.fields:[];
      const index=Object.fromEntries(fields.map((f,i)=>[String(f),i]));
      return{...data,index};
    }).catch(error=>{dbPromise=null;throw error;});
  }
  return dbPromise;
}

function value(row,db,name){const i=db.index?.[name];return Number.isInteger(i)?row[i]:null;}
function candidateDimensions(row,db){
  const type=String(value(row,db,'type')||'');
  if(type==='HSS'){
    const ht=finite(value(row,db,'Ht')),b=finite(value(row,db,'B')),od=finite(value(row,db,'OD'));
    if(ht&&b)return [ht,b];
    if(od)return [od,od];
  }
  if(type==='PIPE'){
    const od=finite(value(row,db,'OD'));if(od)return [od,od];
  }
  if(['W','M','S','HP','C','MC','WT','MT','ST'].includes(type)){
    const d=finite(value(row,db,'d')),bf=finite(value(row,db,'bf'));if(d&&bf)return [d,bf];
  }
  if(['L','2L'].includes(type)){
    const d=finite(value(row,db,'d')),b=finite(value(row,db,'b'));if(d&&b)return [d,b];
  }
  return null;
}

function topologyPenalty(profile,type,dims){
  const cyl=Number(profile?.longitudinalCylinderCount)||0;
  const traces=Number(profile?.traceCount)||0;
  const planes=Number(profile?.longitudinalPlaneCount)||0;
  const [major,minor]=pairSorted(...dims),ratio=minor>0?major/minor:1;
  let p=0;

  // The supplied stock-angle regressions have three longitudinal blend/fillet
  // cylinders and a compact trace graph. This is strong evidence for a single L.
  if(cyl===3&&traces<=10){
    if(type==='L')p-=0.12;
    else if(type==='2L')p+=0.12;
    else if(type==='HSS'||type==='PIPE')p+=0.18;
  }

  // Rectangular HSS commonly carries more longitudinal corner surfaces than a
  // single angle. Only use this as a mild tie-breaker; dimensions remain primary.
  if(cyl>=4&&traces>=11&&ratio>1.15){
    if(type==='HSS')p-=0.08;
    else if(type==='L'||type==='2L')p+=0.15;
  }

  // A truly round tube/pipe has very little planar longitudinal skin. Keep this
  // conservative because drilled or trimmed models can add planar faces.
  if(planes<=2&&cyl>=1){
    if(type==='PIPE')p-=0.08;
    else if(type==='HSS')p-=0.04;
    else p+=0.10;
  }
  return p;
}

function candidateFromRow(row,db,profile){
  const dims=candidateDimensions(row,db);if(!dims)return null;
  const actual=pairSorted(profile?.spanU,profile?.spanV),standard=pairSorted(...dims);
  if(!(actual[0]>0&&actual[1]>0&&standard[0]>0&&standard[1]>0))return null;

  const absErr=[Math.abs(actual[0]-standard[0]),Math.abs(actual[1]-standard[1])];
  const relErr=[absErr[0]/standard[0],absErr[1]/standard[1]];
  const maxDim=Math.max(...standard),hardMm=Math.max(4,maxDim*0.04);
  if(Math.max(...absErr)>hardMm&&Math.max(...relErr)>0.035)return null;

  const dbArea=finite(value(row,db,'A'));
  const measuredArea=finite(profile?.averageSectionArea);
  let areaRatio=null,areaPenalty=0.12;
  if(dbArea&&measuredArea){
    areaRatio=measuredArea/dbArea;
    // Holes, slots and copes reduce volume/length. Conversely, a measured area
    // far larger than the stock section cannot be explained by machining.
    if(areaRatio>1.18)return null;
    areaPenalty=areaRatio<=1?(1-areaRatio)*0.60:(areaRatio-1)*2.0;
  }

  const type=String(value(row,db,'type')||'');
  const dimensionPenalty=(relErr[0]+relErr[1])*6;
  const score=dimensionPenalty+areaPenalty+topologyPenalty(profile,type,dims);
  return{
    score,type,
    imperialEdi:value(row,db,'imperial_edi')||null,
    imperialLabel:value(row,db,'imperial_manual')||value(row,db,'imperial_edi')||null,
    metricEdi:value(row,db,'EDI_Std_Nomenclature')||null,
    metricLabel:value(row,db,'AISC_Manual_Label')||value(row,db,'EDI_Std_Nomenclature')||null,
    weightKgM:finite(value(row,db,'W')),
    areaMm2:dbArea,
    standardDimensionsMm:standard,
    measuredDimensionsMm:actual,
    dimensionErrorsMm:absErr,
    maxDimensionErrorRatio:Math.max(...relErr),
    measuredAreaMm2:measuredArea,
    areaRatio,
    tNomMm:finite(value(row,db,'tnom')),
    tDesMm:finite(value(row,db,'tdes')),
    twMm:finite(value(row,db,'tw')),
    tfMm:finite(value(row,db,'tf')),
    tMm:finite(value(row,db,'t')),
    sourceVersion:db.version||'AISC Shapes Database v16.0'
  };
}

export function matchAiscProfileData(profile,db){
  if(!profile||!db?.rows?.length||!db?.index)return null;
  const candidates=[];
  for(const row of db.rows){const c=candidateFromRow(row,db,profile);if(c)candidates.push(c);}
  candidates.sort((a,b)=>a.score-b.score);
  const best=candidates[0];if(!best)return null;
  const second=candidates[1]||null,gap=second?second.score-best.score:1;
  const dim=best.maxDimensionErrorRatio,area=best.areaRatio;
  let level='tentative';
  if(dim<=0.012&&(!Number.isFinite(area)||(area>=0.82&&area<=1.10))&&gap>=0.035)level='high';
  else if(dim<=0.025&&(!Number.isFinite(area)||(area>=0.65&&area<=1.14))&&gap>=0.018)level='probable';
  const dimQuality=clamp(1-dim/0.04),areaQuality=Number.isFinite(area)?clamp(1-Math.abs(Math.min(area,1)-1)/0.35):0.65;
  const gapQuality=clamp(gap/0.15);
  const confidence=clamp(dimQuality*0.58+areaQuality*0.24+gapQuality*0.18);
  return{...best,level,confidence,gap,nextCandidates:candidates.slice(1,4).map(c=>({type:c.type,imperialLabel:c.imperialLabel,metricLabel:c.metricLabel,score:c.score}))};
}

export async function matchAiscProfile(profile){
  const db=await loadAiscShapes();return matchAiscProfileData(profile,db);
}
