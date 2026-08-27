// NavoFlo V8.21.1 — local structural-shape matcher (AISC + Inventor metadata + geometric proof).
//
// The AISC table is loaded lazily only after Navo3D has already classified the
// STEP body as a long constant-section structural profile/extrusion. Matching is
// an identification layer only; the local STEP B-Rep remains the source of truth.
//
// V8.17.9 replaces the old volume/length-first fingerprint with the largest
// intact perpendicular section sampled from the real STEP mesh. This makes stock
// identification resilient to drilled holes, copes, slots and angled end cuts.

const DB_URL='/data/aisc-shapes-v16.json?v=16.0-nf8211';
let dbPromise=null;

function finite(v){if(v==null||v===''||v==='–')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function pairSorted(a,b){return [Number(a)||0,Number(b)||0].sort((x,y)=>y-x);}

function normalizeAiscLabel(value){
  return String(value||'').toUpperCase().replace(/×/g,'X').replace(/\s+/g,'').replace(/[–—]/g,'-');
}
export function aiscDesignationHint(name){
  const raw=String(name||'').toUpperCase().replace(/×/g,'X').replace(/[–—]/g,'-');
  // Structural designations exported by Inventor/Content Center commonly appear
  // inside occurrence names, e.g. "105101P02_AISC - W 36x170".  We deliberately
  // recognize only canonical families and require B-Rep agreement later.
  const m=raw.match(/(?:^|[^A-Z0-9])(W|M|S|HP|C|MC|WT|MT|ST)\s*([0-9]+(?:\.[0-9]+)?)\s*X\s*([0-9]+(?:\.[0-9]+)?)(?=$|[^0-9.])/i);
  if(m)return normalizeAiscLabel(`${m[1]}${m[2]}X${m[3]}`);
  const hss=raw.match(/(?:^|[^A-Z0-9])(HSS)\s*([0-9]+(?:[- ][0-9]+\/[0-9]+|\.[0-9]+)?)[ X]([0-9]+(?:[- ][0-9]+\/[0-9]+|\.[0-9]+)?)\s*X\s*([0-9]+(?:\/[0-9]+|\.[0-9]+)?)/i);
  if(hss)return normalizeAiscLabel(`${hss[1]}${hss[2]}X${hss[3]}X${hss[4]}`);
  const pipe=raw.match(/(?:^|[^A-Z0-9])(PIPE)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:STD|XS|XXS)?/i);
  if(pipe)return normalizeAiscLabel(`${pipe[1]}${pipe[2]}`);
  return null;
}

function reliableSectionFingerprint(profile){
  return Number(profile?.sectionAreaSampleCount)>=3&&Number.isFinite(Number(profile?.stockSectionArea))&&Number.isFinite(Number(profile?.sectionHoleCount));
}
function topologyCompatible(profile,type){
  if(!reliableSectionFingerprint(profile))return true;
  const holes=Number(profile.sectionHoleCount),components=Number(profile.sectionComponentCount);
  // A hollow HSS/PIPE section has a persistent internal void at every intact
  // transverse station.  A clean, single-loop solid section can therefore never
  // be HSS/PIPE even if its outside envelope happens to match the database exactly.
  if((type==='HSS'||type==='PIPE')&&holes<1)return false;
  // Built-up 2L requires two distinct material islands on an intact section.
  if(type==='2L'&&Number.isFinite(components)&&components<2)return false;
  return true;
}
function gcd(a,b){a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));while(b){const t=a%b;a=b;b=t;}return a||1;}
function fracText(value,maxDen=16){
  const n=Number(value);if(!Number.isFinite(n))return null;const whole=Math.floor(n+1e-9),frac=n-whole,num=Math.round(frac*maxDen);
  if(num===0)return String(whole);if(num===maxDen)return String(whole+1);const g=gcd(num,maxDen),a=num/g,b=maxDen/g;return whole?`${whole}-${a}/${b}`:`${a}/${b}`;
}
function imperialDimText(mm){
  const inch=Number(mm)/25.4;if(!Number.isFinite(inch)||inch<=0)return null;const rounded=Math.round(inch*16)/16;
  return Math.abs(inch-rounded)<=0.025?fracText(rounded,16):inch.toFixed(inch<10?3:2).replace(/0+$/,'').replace(/\.$/,'');
}
function nearestChannelThicknessInch(raw){
  if(!(raw>0))return null;const allowed=[1/16,3/32,1/8,5/32,3/16,7/32,1/4,5/16,3/8,1/2,5/8,3/4];
  let best=null;for(const t of allowed){const err=Math.abs(raw-t);if(!best||err<best.err)best={value:t,err};}return best&&best.err<=Math.max(0.035,raw*0.18)?best.value:null;
}
function solveOpenChannelThickness(majorIn,minorIn,areaIn2){
  // Idealized U section: A = t*H + 2*t*(B-t). Rolled corner radii add a small
  // positive area, so the inferred t is only used to choose a nearby stock fraction.
  const c=majorIn+2*minorIn,disc=c*c-8*areaIn2;if(!(disc>=0))return null;const t=(c-Math.sqrt(disc))/4;return t>0&&t<Math.min(majorIn,minorIn)*0.48?t:null;
}
function localOpenChannelMatch(profile){
  if(!reliableSectionFingerprint(profile))return null;
  if(Number(profile.sectionComponentCount)!==1||Number(profile.sectionHoleCount)!==0)return null;
  const offsets=[Number(profile.sectionCentroidOffsetU),Number(profile.sectionCentroidOffsetV)];if(!offsets.every(Number.isFinite))return null;
  const centered=Math.min(...offsets),eccentric=Math.max(...offsets);
  // U/C channel: symmetric about one section axis but materially offset toward
  // the web on the other. This separates it from centered W/HSS/PIPE and from L,
  // which is eccentric about both axes.
  if(centered>0.055||eccentric<0.105)return null;
  const cylinders=Number(profile.longitudinalCylinderCount)||0,planes=Number(profile.longitudinalPlaneCount)||0,traces=Number(profile.traceCount)||0;
  if(cylinders<2||planes<4||traces<6)return null;
  const dims=pairSorted(profile.spanU,profile.spanV),majorMm=dims[0],minorMm=dims[1],areaMm2=finite(profile.stockSectionArea);if(!(majorMm>0&&minorMm>0&&areaMm2>0))return null;
  const majorIn=majorMm/25.4,minorIn=minorMm/25.4,areaIn2=areaMm2/(25.4*25.4),rawT=solveOpenChannelThickness(majorIn,minorIn,areaIn2),tIn=nearestChannelThicknessInch(rawT);if(!(tIn>0))return null;
  const idealArea=tIn*(majorIn+2*minorIn-2*tIn),areaRatio=areaIn2/idealArea;if(!(areaRatio>=0.86&&areaRatio<=1.18))return null;
  const d1=imperialDimText(majorMm),d2=imperialDimText(minorMm),tt=fracText(tIn,16);if(!d1||!d2||!tt)return null;
  const weightKgM=areaMm2*0.00785,confidence=clamp(0.82+(0.055-centered)*1.4+Math.min(eccentric-0.105,0.12)*0.45-Math.min(Math.abs(areaRatio-1),0.18)*0.45);
  return{
    score:0,type:'U',sourceKind:'geometry',imperialEdi:`U${d1}X${d2}X${tt}`,imperialLabel:`U${d1}X${d2}X${tt}`,
    metricEdi:`U${majorMm.toFixed(1).replace(/\.0$/,'')}X${minorMm.toFixed(1).replace(/\.0$/,'')}X${(tIn*25.4).toFixed(1)}`,
    metricLabel:`U${majorMm.toFixed(1).replace(/\.0$/,'')}X${minorMm.toFixed(1).replace(/\.0$/,'')}X${(tIn*25.4).toFixed(1)}`,
    weightKgM,weightLbFt:weightKgM*0.6719689751,areaMm2,standardDimensionsMm:[majorMm,minorMm],measuredDimensionsMm:[majorMm,minorMm],dimensionErrorsMm:[0,0],maxDimensionErrorRatio:0,
    measuredAreaMm2:areaMm2,measuredStockAreaMm2:areaMm2,measuredAverageAreaMm2:finite(profile.averageSectionArea),areaRatio:1,
    dMm:majorMm,bfMm:minorMm,twMm:tIn*25.4,tfMm:tIn*25.4,tMm:tIn*25.4,tNomMm:tIn*25.4,tDesMm:null,
    sourceVersion:'NavoFlo geometric open-section matcher V8.20.1',level:confidence>=0.90?'high':'probable',confidence,gap:1,profileLengthMm:finite(profile.length),sectionComponentCount:1,sectionHoleCount:0,nextCandidates:[]
  };
}

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
  const type=String(value(row,db,'type')||'');if(!topologyCompatible(profile,type))return null;
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

  const dimensionPenalty=(relErr[0]+relErr[1])*6;
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
  const local=localOpenChannelMatch(profile);if(local)return local;
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


function rowDesignation(row,db){
  return [value(row,db,'imperial_edi'),value(row,db,'imperial_manual'),value(row,db,'AISC_Manual_Label'),value(row,db,'EDI_Std_Nomenclature')].map(normalizeAiscLabel).filter(Boolean);
}
export function matchAiscProfileWithNameData(profile,name,db){
  const hint=aiscDesignationHint(name);if(!hint||!profile||!db?.rows?.length||!db?.index)return null;
  const row=db.rows.find(r=>rowDesignation(r,db).includes(hint));if(!row)return null;
  const type=String(value(row,db,'type')||'');if(!topologyCompatible(profile,type))return null;
  const dims=candidateDimensions(row,db),actual=pairSorted(profile?.spanU,profile?.spanV);if(!dims||!(actual[0]>0&&actual[1]>0))return null;
  const standard=pairSorted(...dims),absErr=[Math.abs(actual[0]-standard[0]),Math.abs(actual[1]-standard[1])],relErr=[absErr[0]/standard[0],absErr[1]/standard[1]],maxDim=Math.max(...relErr);
  // Metadata is a prior, never a bypass.  The measured B-Rep envelope must still
  // agree with the named AISC shape.  6.5% is intentionally looser than the pure
  // geometry matcher because cope/end cuts and tessellation can reduce a sampled
  // section, while still being tight enough to reject an unrelated part name.
  if(maxDim>0.065&&Math.max(...absErr)>Math.max(8,Math.max(...standard)*0.055))return null;
  const dbArea=finite(value(row,db,'A')),sampledArea=finite(profile?.stockSectionArea),averageArea=finite(profile?.averageSectionArea),measuredArea=sampledArea||averageArea;
  const areaRatio=dbArea&&measuredArea?measuredArea/dbArea:null;if(Number.isFinite(areaRatio)&&(areaRatio<0.62||areaRatio>1.18))return null;
  const samples=Number(profile?.sectionAreaSampleCount)||0,side=Number(profile?.sideAreaRatio)||0,aspect=Number(profile?.aspect)||0,traces=Number(profile?.traceCount)||0;
  if(samples<3||side<0.48||aspect<1.35||traces<4)return null;
  const base=candidateFromRow(row,db,profile)||{};
  const dimQ=clamp(1-maxDim/0.065),areaQ=Number.isFinite(areaRatio)?clamp(1-Math.abs(areaRatio-1)/0.38):0.65,stable=clamp(Number(profile?.sectionStableFraction)||0.55);
  const confidence=clamp(0.86+dimQ*0.06+areaQ*0.035+stable*0.025);
  return{
    ...base,type,sourceKind:'assembly-name+geometry',designationHint:hint,
    imperialEdi:value(row,db,'imperial_edi')||base.imperialEdi||hint,imperialLabel:value(row,db,'imperial_manual')||value(row,db,'imperial_edi')||base.imperialLabel||hint,
    metricEdi:value(row,db,'EDI_Std_Nomenclature')||base.metricEdi||null,metricLabel:value(row,db,'AISC_Manual_Label')||value(row,db,'EDI_Std_Nomenclature')||base.metricLabel||null,
    standardDimensionsMm:standard,measuredDimensionsMm:actual,dimensionErrorsMm:absErr,maxDimensionErrorRatio:maxDim,
    measuredAreaMm2:measuredArea,measuredStockAreaMm2:sampledArea,measuredAverageAreaMm2:averageArea,areaRatio,
    level:confidence>=0.93?'high':'probable',confidence,gap:1,profileLengthMm:finite(profile?.length),sectionComponentCount:finite(profile?.sectionComponentCount),sectionHoleCount:finite(profile?.sectionHoleCount),
    sourceVersion:`${db.version||'AISC Shapes Database v16.0'} + STEP hierarchy metadata`
  };
}
export async function matchAiscProfileWithName(profile,name){const db=await loadAiscShapes();return matchAiscProfileWithNameData(profile,name,db);}

export async function matchAiscProfile(profile){const db=await loadAiscShapes();return matchAiscProfileData(profile,db);}
