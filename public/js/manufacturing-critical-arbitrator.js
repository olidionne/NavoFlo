/* NavoFlo V8.20.0 — Critical Manufacturing Arbitrator
 *
 * The recognizers produce geometric feature hypotheses.  This module answers a
 * different question: does a recognized feature actually REQUIRE secondary
 * machining for the current stock/capability context?
 *
 * A through-slot in a laser-cut plate is not "machining" merely because its
 * B-Rep contains two cylinders + two planes.  A blind hole, counterbore,
 * countersink, annular groove, pocket floor or turning step is different: it
 * cannot be created by a normal 2D profile cut through a constant-thickness
 * plate and therefore proves secondary machining.
 */

const THROUGH_CUT_TYPES=new Set([
  'through-hole','through-slot','through-profile','through-pocket','through-passage','through-step','through-polygon'
]);
const DEFINITE_MACHINING_TYPES=new Set([
  'blind-hole','blind-axial-bore','counterbore','countersink','annular-groove','groove-fillet','pocket-floor','blind-pocket',
  'blind-slot','one-sided-recess','edge-chamfer','countersink-chamfer','turned-step','turned-groove','turned-groove-fillet',
  'turned-chamfer-taper','turned-shoulder','axial-bore','offset-bore','cross-hole','thread','oring-groove'
]);
const TURNING_TYPES=new Set(['turned-step','turned-groove','turned-groove-fillet','turned-chamfer-taper','turned-shoulder']);
const DRILLING_TYPES=new Set(['blind-hole','blind-axial-bore','counterbore','countersink','countersink-chamfer','axial-bore','offset-bore','cross-hole','thread']);
const MILLING_TYPES=new Set(['annular-groove','groove-fillet','pocket-floor','blind-pocket','blind-slot','one-sided-recess','edge-chamfer','oring-groove']);

function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));}
function keyFaces(faceIds=[]){return [...new Set(faceIds.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b).join(',');}
function normalizeType(raw){
  const s=String(raw||'').trim().toLowerCase().replace(/[\s_]+/g,'-');
  const map={
    'through-hole':'through-hole','blind-hole':'blind-hole','counterbore':'counterbore','countersink':'countersink','chamfer':'edge-chamfer',
    'rectangular-through-slot':'through-slot','circular-through-slot':'through-slot','triangular-through-slot':'through-slot','through-slot':'through-slot',
    'triangular-passage':'through-passage','rectangular-passage':'through-passage','6sides-passage':'through-passage',
    'rectangular-through-step':'through-step','2sides-through-step':'through-step','slanted-through-step':'through-step',
    'triangular-pocket':'blind-pocket','rectangular-pocket':'blind-pocket','6sides-pocket':'blind-pocket','circular-end-pocket':'blind-pocket',
    'rectangular-blind-slot':'blind-slot','v-circular-end-blind-slot':'blind-slot','h-circular-end-blind-slot':'blind-slot',
    'triangular-blind-step':'blind-pocket','circular-blind-step':'blind-pocket','rectangular-blind-step':'blind-pocket',
    'oring':'oring-groove','groove':'annular-groove','stock':'stock'
  };
  return map[s]||s;
}
function normalizeMlFeature(f){
  const type=normalizeType(f?.type||f?.name||f?.className||f?.label);
  const faces=f?.faceIds||f?.faces||[];
  const confidence=clamp(f?.confidence??f?.score??0.5);
  let process='unknown';
  if(THROUGH_CUT_TYPES.has(type))process='cutting';
  else if(TURNING_TYPES.has(type))process='turning';
  else if(DRILLING_TYPES.has(type))process='drilling';
  else if(MILLING_TYPES.has(type))process='milling';
  return{type,process,faceIds:[...new Set((faces||[]).map(Number).filter(Number.isFinite))],confidence,parameters:{ml:true,source:String(f?.source||'feature-ml'),faceIdDomain:String(f?.faceIdDomain||'unknown')}};
}
function overlapRatio(a=[],b=[]){
  const A=new Set(a.map(Number)),B=new Set(b.map(Number));if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return n/Math.min(A.size,B.size);
}

export function mergeFeaturePredictions(deterministic=[],mlPrediction=null,{plateContext=false}={}){
  const out=(deterministic||[]).map(f=>({...f,faceIds:[...new Set((f.faceIds||[]).map(Number).filter(Number.isFinite))]}));
  const mlFeatures=(mlPrediction?.features||mlPrediction?.featureInstances||[]).map(normalizeMlFeature).filter(f=>f.type&&f.type!=='stock');
  for(const mf of mlFeatures){
    const advisory=mf.parameters?.faceIdDomain!=='occt-js-exact';
    const same=out.find(df=>normalizeType(df.type)===mf.type&&(!advisory&&(keyFaces(df.faceIds)===keyFaces(mf.faceIds)||overlapRatio(df.faceIds,mf.faceIds)>=0.72)));
    if(same){same.confidence=Math.max(Number(same.confidence)||0,mf.confidence);same.parameters={...(same.parameters||{}),mlConfirmed:true,mlConfidence:mf.confidence};continue;}
    // Exact face mapping can safely suppress overlapping fragments. AAGNet's
    // PythonOCC face order is advisory in V8.20, so never use those numeric IDs
    // to erase exact OCCT-js evidence.
    if(!advisory&&THROUGH_CUT_TYPES.has(mf.type)&&mf.confidence>=0.72){
      for(let i=out.length-1;i>=0;i--){
        const df=out[i],ratio=overlapRatio(df.faceIds,mf.faceIds);
        if(ratio>=0.65&&['through-hole','cross-hole','pocket-floor','one-sided-recess'].includes(normalizeType(df.type)))out.splice(i,1);
      }
    }
    out.push(mf);
  }
  if(plateContext){
    const strongMlThrough=mlFeatures.some(f=>THROUGH_CUT_TYPES.has(f.type)&&f.confidence>=0.86);
    const strongMlMachining=mlFeatures.some(f=>DEFINITE_MACHINING_TYPES.has(f.type)&&f.confidence>=0.70);
    const hardLocal=out.some(f=>!f.parameters?.ml&&['blind-hole','blind-axial-bore','counterbore','countersink','annular-groove','groove-fillet','oring-groove'].includes(normalizeType(f.type))&&Number(f.confidence)>=0.90);
    // Critical second opinion for a classic B-Rep failure mode: an obround
    // through-slot can be decomposed into two cylinders + two planar walls and
    // misread locally as drilling/pockets. Only downgrade those WEAK generic
    // hypotheses when ML sees a strong through-cut and there is no hard local
    // or ML evidence of blind/groove/counterbore machining.
    if(strongMlThrough&&!strongMlMachining&&!hardLocal){
      for(let i=out.length-1;i>=0;i--){
        const f=out[i],t=normalizeType(f.type);
        if(!f.parameters?.ml&&['cross-hole','pocket-floor','one-sided-recess'].includes(t)&&Number(f.confidence)<0.96)out.splice(i,1);
      }
    }
  }
  const seen=new Set();return out.filter(f=>{const k=`${normalizeType(f.type)}:${keyFaces(f.faceIds)}`;if(seen.has(k))return false;seen.add(k);return true;});
}

export function requiresSecondaryMachining(feature,{plateContext=false}={}){
  const type=normalizeType(feature?.type);if(!type)return false;
  if(THROUGH_CUT_TYPES.has(type))return false;
  if(type==='cross-hole'&&plateContext&&feature?.parameters?.throughCutEquivalent)return false;
  if(type==='pocket-floor'&&plateContext&&feature?.parameters?.throughCutEquivalent)return false;
  return DEFINITE_MACHINING_TYPES.has(type)||['turning','drilling','milling'].includes(String(feature?.process||''));
}

export function arbitrateManufacturingKnowledge(knowledge,{sheetResult=null,mlPrediction=null}={}){
  if(!knowledge)return knowledge;
  const out={...knowledge};
  const plateContext=Boolean(out?.capabilities?.directFlatDxf||sheetResult?.flatPlate||out?.stock?.stockType==='plate-blank'||(out?.stock?.stockType==='round-bar'&&Number(out?.stock?.aspect)<0.45));
  const localFeatures=[...(out.featureInstances||[])];
  // Hard analytic floor. If the exact STEP worker reports surface families that
  // cannot be produced by a normal 2D profile cut, do not allow higher-level
  // component grouping to accidentally erase that evidence. These synthetic
  // features carry no face IDs on purpose: they are a process proof, not a
  // selection/highlight claim.
  if(plateContext){
    const sig=out?.diagnostics?.surfaceSignals||{};
    const has=t=>localFeatures.some(f=>normalizeType(f.type)===t);
    if(Number(sig.torus)>0&&!has('annular-groove'))localFeatures.push({type:'annular-groove',process:'milling',faceIds:[],confidence:.965,parameters:{analyticFloor:true,count:Number(sig.torus)}});
    if(Number(sig.compoundHoles)>0&&!has('counterbore')&&!has('countersink'))localFeatures.push({type:'counterbore',process:'drilling',faceIds:[],confidence:.955,parameters:{analyticFloor:true,count:Number(sig.compoundHoles)}});
    if((Number(sig.blindCylinders)>0||Number(sig.partialCylinders)>0)&&!has('blind-hole'))localFeatures.push({type:'blind-hole',process:'drilling',faceIds:[],confidence:.95,parameters:{analyticFloor:true,count:Math.max(Number(sig.blindCylinders)||0,Number(sig.partialCylinders)||0)}});
    if(Number(sig.cone)>0&&!has('countersink')&&!has('countersink-chamfer'))localFeatures.push({type:'countersink-chamfer',process:'drilling',faceIds:[],confidence:.90,parameters:{analyticFloor:true,count:Number(sig.cone)}});
  }
  const features=mergeFeaturePredictions(localFeatures,mlPrediction,{plateContext});
  const definite=features.filter(f=>requiresSecondaryMachining(f,{plateContext}));
  const throughCuts=features.filter(f=>THROUGH_CUT_TYPES.has(normalizeType(f.type)));
  const turning=definite.some(f=>TURNING_TYPES.has(normalizeType(f.type))||f.process==='turning');
  const drilling=definite.some(f=>DRILLING_TYPES.has(normalizeType(f.type))||f.process==='drilling');
  const milling=definite.some(f=>MILLING_TYPES.has(normalizeType(f.type))||f.process==='milling');
  const machining=turning||drilling||milling;
  const cutting=Boolean(out?.processes?.cutting||out?.capabilities?.directFlatDxf||throughCuts.length);
  out.featureInstances=features;
  out.processes={...(out.processes||{}),cutting,turning,drilling,milling,machining};
  out.machined=machining;
  out.process=machining?'machining':'stock-profile';
  out.features={...(out.features||{}),recognizedInstances:features.length,secondaryMachining:machining,definiteMachiningInstances:definite.length,throughCutInstances:throughCuts.length};
  out.diagnostics={...(out.diagnostics||{}),criticalArbitrator:true,mlUsed:Boolean(mlPrediction?.ok),mlEngine:mlPrediction?.engine||null,definiteMachiningCount:definite.length,throughCutCount:throughCuts.length};

  const evidence=new Set(out.evidence||[]);
  // Rebuild manufacturing evidence from the final feature set, otherwise stale
  // low-level hypotheses can keep "pocket" in the UI after a through-slot was
  // correctly grouped by topology/ML.
  for(const token of ['turning','drilling','blind-hole','counterbore','groove','pocket','recess'])evidence.delete(token);
  for(const f of definite){
    const t=normalizeType(f.type);
    if(TURNING_TYPES.has(t))evidence.add('turning');
    if(DRILLING_TYPES.has(t))evidence.add(t==='blind-hole'||t==='blind-axial-bore'?'blind-hole':t==='counterbore'||t==='countersink'?'counterbore':'drilling');
    if(['annular-groove','groove-fillet','turned-groove','turned-groove-fillet','oring-groove'].includes(t))evidence.add('groove');
    if(['pocket-floor','blind-pocket','blind-slot','one-sided-recess'].includes(t))evidence.add('pocket');
  }
  if(throughCuts.length)evidence.add('through-cut');
  out.evidence=[...evidence];
  return out;
}

export const CRITICAL_ARBITRATOR_VERSION='8.20.0';
