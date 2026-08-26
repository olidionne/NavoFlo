// NavoFlo V8.17.9 — local AISC structural-shape matcher.
//
// The AISC table is loaded lazily only after Navo3D has already classified the
// STEP body as a long constant-section structural profile/extrusion. Matching is
// an identification layer only; the local STEP B-Rep remains the source of truth.
//
// V8.17.9 replaces the old volume/length-first fingerprint with the largest
// intact perpendicular section sampled from the real STEP mesh. This makes stock
// identification resilient to drilled holes, copes, slots and angled end cuts.

const DB_URL='/data/aisc-shapes-v16.json?v=16.0-nf8179';
let dbPromise=null;

function finite(v){if(v==null||v===''||v==='–')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function pairSorted(a,b){return [Number(a)||0,Number(b)||0].sort((x,y)=>y-x);}

export async function loadAiscShapes(){
  if(!dbPromise){
    dbPromise=fetch(DB_URL,{cache:'force-cache'}).then(async r=>{
      if(!r.ok)throw new Error(`AISC database ${r.status}`);
      const data=await r.json(),fields=Array.isArray(data?.fields)?data.fields:[],index=Object.fromEntries(fields.map((f,i)=>[String(f),i]));
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
    if(ht&&b)return [ht,b];if(od)return [od,od];
  }
  if(type==='PIPE'){const od=finite(value(row,db,'OD'));if(od)return [od,od];}
  if(['W','M','S','HP','C','MC','WT','MT','ST'].includes(type)){
    const d=finite(value(row,db,'d')),bf=finite(value(row,db,'bf'));if(d&&bf)return [d,bf];
  }
  if(['L','2L'].includes(type)){const d=finite(value(row,db,'d')),b=finite(value(row,db,'b'));if(d&&b)return [d,b];}
  return null;
}

function sectionFamilyPenalty(profile,type,dims){
  const components=Number(profile?.sectionComponentCount),holes=Number(profile?.sectionHoleCount);let p=0;
  if(Number.isFinite(components)&&Number.isFinite(holes)){
    // A single W/L/C/T section is one connected material island without a void.
    // HSS/PIPE has a nested void. Built-up 2L normally has two material islands.
    if(components>=2){if(type==='2L')p-=0.28;else p+=0.42;}
    else if(type==='2L')p+=0.30;
    if(holes>=1){if(type==='HSS'||type==='PIPE')p-=0.18;else p+=0.48;}
    else if(type==='HSS'||type==='PIPE')p+=0.34;
  }

  const cyl=Number(profile?.longitudinalCylinderCount)||0,traces=Number(profile?.traceCount)||0,planes=Number(profile?.longitudinalPlaneCount)||0;
  const [major,minor]=pairSorted(...dims),ratio=minor>0?major/minor:1;
  if(cyl===3&&traces<=10){if(type==='L')p-=0.12;else if(type==='2L')p+=0.12;else if(type==='HSS'||type==='PIPE')p+=0.18;}
  if(cyl>=4&&traces>=11&&ratio>1.15){if(type==='HSS')p-=0.08;else if(type==='L'||type==='2L')p+=0.15;}
  if(planes<=2&&cyl>=1){if(type==='PIPE')p-=0.10;else if(type==='HSS')p-=0.04;else p+=0.10;}
  return p;
}

function candidateFromRow(row,db,profile){
  const dims=candidateDimensions(row,db);if(!dims)return null;
  const actual=pairSorted(profile?.spanU,profile?.spanV),standard=pairSorted(...dims);
  if(!(actual[0]>0&&actual[1]>0&&standard[0]>0&&standard[1]>0))return null;

  const absErr=[Math.abs(actual[0]-standard[0]),Math.abs(actual[1]-standard[1])],relErr=[absErr[0]/standard[0],absErr[1]/standard[1]];
  const maxDim=Math.max(...standard),hardMm=Math.max(4,maxDim*0.04);
  if(Math.max(...absErr)>hardMm&&Math.max(...relErr)>0.035)return null;

  const dbArea=finite(value(row,db,'A'));
  const sampledArea=finite(profile?.stockSectionArea),averageArea=finite(profile?.averageSectionArea),measuredArea=sampledArea||averageArea;
  let areaRatio=null,areaPenalty=0.13;
  if(dbArea&&measuredArea){
    areaRatio=measuredArea/dbArea;
    // A sampled intact section should be close to the stock section. When only
    // the average-area fallback exists, machining is allowed to reduce it much
    // farther. A section materially larger than AISC cannot be the candidate.
    const sampled=Boolean(sampledArea);
    if(areaRatio>(sampled?1.10:1.18))return null;
    if(sampled)areaPenalty=Math.abs(areaRatio-1)*1.35;
    else areaPenalty=areaRatio<=1?(1-areaRatio)*0.60:(areaRatio-1)*2.0;
  }

  const type=String(value(row,db,'type')||''),dimensionPenalty=(relErr[0]+relErr[1])*6;
  const score=dimensionPenalty+areaPenalty+sectionFamilyPenalty(profile,type,dims);
  const weightKgM=finite(value(row,db,'W'));
  return{
    score,type,
    imperialEdi:value(row,db,'imperial_edi')||null,
    imperialLabel:value(row,db,'imperial_manual')||value(row,db,'imperial_edi')||null,
    metricEdi:value(row,db,'EDI_Std_Nomenclature')||null,
    metricLabel:value(row,db,'AISC_Manual_Label')||value(row,db,'EDI_Std_Nomenclature')||null,
    weightKgM,weightLbFt:Number.isFinite(weightKgM)?weightKgM*0.6719689751:null,
    areaMm2:dbArea,
    standardDimensionsMm:standard,measuredDimensionsMm:actual,dimensionErrorsMm:absErr,maxDimensionErrorRatio:Math.max(...relErr),
    measuredAreaMm2:measuredArea,measuredStockAreaMm2:sampledArea,measuredAverageAreaMm2:averageArea,areaRatio,
    dMm:finite(value(row,db,'d')),bfMm:finite(value(row,db,'bf')),twMm:finite(value(row,db,'tw')),tfMm:finite(value(row,db,'tf')),
    heightMm:finite(value(row,db,'Ht')),widthMm:finite(value(row,db,'B')),leg1Mm:finite(value(row,db,'d')),leg2Mm:finite(value(row,db,'b')),
    outerDiameterMm:finite(value(row,db,'OD')),insideDiameterMm:finite(value(row,db,'ID')),
    tNomMm:finite(value(row,db,'tnom')),tDesMm:finite(value(row,db,'tdes')),tMm:finite(value(row,db,'t')),
    kDesMm:finite(value(row,db,'kdes')),kDetMm:finite(value(row,db,'kdet')),
    ix:finite(value(row,db,'Ix')),iy:finite(value(row,db,'Iy')),rx:finite(value(row,db,'rx')),ry:finite(value(row,db,'ry')),
    sourceVersion:db.version||'AISC Shapes Database v16.0'
  };
}

export function matchAiscProfileData(profile,db){
  if(!profile||!db?.rows?.length||!db?.index)return null;
  const candidates=[];for(const row of db.rows){const c=candidateFromRow(row,db,profile);if(c)candidates.push(c);}candidates.sort((a,b)=>a.score-b.score);
  const best=candidates[0];if(!best)return null;const second=candidates[1]||null,gap=second?second.score-best.score:1;
  const dim=best.maxDimensionErrorRatio,area=best.areaRatio,sampled=Number.isFinite(best.measuredStockAreaMm2);let level='tentative';
  if(dim<=0.015&&(!Number.isFinite(area)||(area>=0.93&&area<=1.07))&&gap>=0.030)level='high';
  else if(dim<=0.030&&(!Number.isFinite(area)||(area>=0.78&&area<=1.12))&&gap>=0.015)level='probable';
  // An intact section fingerprint matching AISC area within 2.5% is exceptionally
  // strong even when nominal envelope dimensions create a close database neighbour.
  if(sampled&&dim<=0.018&&Number.isFinite(area)&&Math.abs(area-1)<=0.025&&gap>=0.012)level='high';
  const dimQuality=clamp(1-dim/0.04),areaQuality=Number.isFinite(area)?clamp(1-Math.abs(area-1)/0.22):0.55,gapQuality=clamp(gap/0.18),sampleQuality=sampled?1:0.55;
  const confidence=clamp(dimQuality*0.42+areaQuality*0.31+gapQuality*0.17+sampleQuality*0.10);
  return{...best,level,confidence,gap,profileLengthMm:finite(profile?.length),sectionComponentCount:finite(profile?.sectionComponentCount),sectionHoleCount:finite(profile?.sectionHoleCount),nextCandidates:candidates.slice(1,4).map(c=>({type:c.type,imperialLabel:c.imperialLabel,metricLabel:c.metricLabel,score:c.score}))};
}

export async function matchAiscProfile(profile){const db=await loadAiscShapes();return matchAiscProfileData(profile,db);}
