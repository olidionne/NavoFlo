/* NavoFlo V8.23.1 — Canonical Manufacturing Arbitrator
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
  'turned-chamfer-taper','turned-shoulder','turning-axis-proof','axial-bore','offset-bore','cross-hole','thread','oring-groove'
]);
const TURNING_TYPES=new Set(['turned-step','turned-groove','turned-groove-fillet','turned-chamfer-taper','turned-shoulder','turning-axis-proof']);
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

function suppressGenericFragmentsExplainedByThroughCuts(features,{plateContext=false}={}){
  if(!plateContext)return features;
  const through=(features||[]).filter(f=>THROUGH_CUT_TYPES.has(normalizeType(f.type))&&f?.parameters?.topologyProven!==false);
  if(!through.length)return features;
  const weak=new Set(['cross-hole','pocket-floor','one-sided-recess','offset-bore']);
  return(features||[]).filter(f=>{
    const type=normalizeType(f.type);if(!weak.has(type))return true;
    const A=new Set((f.faceIds||[]).map(Number));if(!A.size)return true;
    for(const t of through){const B=new Set((t.faceIds||[]).map(Number));let n=0;for(const id of A)if(B.has(id))n++;if(n/A.size>=0.50||n>=Math.min(2,A.size))return false;}
    return true;
  });
}

function hasHardMachiningProof(feature,{plateContext=false}={}){
  const type=normalizeType(feature?.type),p=feature?.parameters||{};
  if(!type||THROUGH_CUT_TYPES.has(type))return false;
  if(!plateContext)return DEFINITE_MACHINING_TYPES.has(type)||['turning','drilling','milling'].includes(String(feature?.process||''));
  // On plate/sheet stock, a machining label is high-impact: only exact OCCT
  // descriptors or topology that proves a one-sided cavity may promote it.
  // ML, surface-family guesses and area deltas remain advisory.
  if(p.ml===true||p.analyticFloor===true)return false;
  // V8.22: a virtual negative-volume feature bounded by STRICTLY CONCAVE AAG
  // transitions is manufacturing proof. This is stronger than surface-family
  // heuristics and remains valid even when the STEP exporter omitted a compound
  // hole descriptor.
  if(p.concavityProven===true&&p.negativeVolume===true&&p.topologyProven===true)return true;
  // Relational axis morphology (e.g. an off-axis cylinder+cone countersink or a
  // coaxial annular groove on a round puck) is also a hard geometric proof. It
  // does not depend on the sign of one numerically fragile curved-edge dihedral.
  if(p.axisPatternProven===true&&p.topologyProven===true&&['counterbore','countersink','annular-groove','groove-fillet','oring-groove'].includes(type))return true;
  if(p.gpAx1Proof===true&&Number(p.gpAx1CollinearFraction)>0.80&&String(feature?.process||'')==='turning')return true;
  if(p.exactCompoundHole===true)return true;
  if(p.exactHole===true){
    if(type==='cross-hole')return true;
    if(type==='blind-hole'||type==='blind-axial-bore')return p.through!==true;
    if(type==='counterbore'||type==='countersink')return true;
  }
  if(p.topologyProven===true){
    // V8.24b — edge-chamfer removed from the plate hard-machining list: a bevel
    // on a proven flat-plate perimeter is a laser/plasma cut condition, not a
    // milled chamfer (502-00-08). countersink-chamfer (drilled) stays machining.
    if(['pocket-floor','blind-pocket','blind-slot','one-sided-recess','annular-groove','groove-fillet','countersink-chamfer','oring-groove'].includes(type))return true;
    if(['counterbore','countersink','blind-hole','cross-hole'].includes(type))return true;
  }
  // Backward-compatible deterministic escape hatch for legacy recognizers that
  // already emitted a near-certain local feature before proof flags existed.
  // Advisory ML can never use this path.
  if(p.ml!==true&&Number(feature?.confidence)>=0.985&&['counterbore','countersink','blind-hole','blind-axial-bore','annular-groove'].includes(type))return true;
  return false;
}

export function requiresSecondaryMachining(feature,{plateContext=false}={}){
  const type=normalizeType(feature?.type);if(!type)return false;
  if(THROUGH_CUT_TYPES.has(type))return false;
  // V8.24b — a through-hole in a proven flat plate is part of the 2D laser/plasma
  // cut profile, never machining. The recognizer sometimes labels a normal
  // through-hole as "cross-hole" when the exported plate normal is a few degrees
  // off; on plate stock that hole is still a cut (502-01-06 / 502-01-10 / ST01-0009).
  // A genuinely blind cross-hole keeps its own blind-hole proof and is unaffected.
  if(type==='cross-hole'&&plateContext&&feature?.parameters?.through!==false)return false;
  if(type==='cross-hole'&&plateContext&&feature?.parameters?.throughCutEquivalent)return false;
  if(type==='pocket-floor'&&plateContext&&feature?.parameters?.throughCutEquivalent)return false;
  return hasHardMachiningProof(feature,{plateContext});
}

export function arbitrateManufacturingKnowledge(knowledge,{sheetResult=null,mlPrediction=null,machiningEvidence=null}={}){
  if(!knowledge)return knowledge;
  const out={...knowledge};
  const plateContext=Boolean(out?.capabilities?.directFlatDxf||sheetResult?.flatPlate||out?.stock?.stockType==='plate-blank'||(out?.stock?.stockType==='round-bar'&&Number(out?.stock?.aspect)<0.45));
  const structuralAuthority=Boolean(out?.capabilities?.structuralProfile||out?.stock?.stockType==='structural-profile');
  const localFeatures=[...(out.featureInstances||[])];
  const mergedRaw=mergeFeaturePredictions(localFeatures,mlPrediction,{plateContext});
  const merged=suppressGenericFragmentsExplainedByThroughCuts(mergedRaw,{plateContext});
  let definite=merged.filter(f=>requiresSecondaryMachining(f,{plateContext}));
  // Root fillets of W/C/L/U structural stock are legitimate concave geometry.
  // They are not negative manufacturing volumes by themselves. Under proven
  // structural authority, retain only exact drilled/compound-hole features as
  // secondary machining; gp_Ax1/concavity-only stock-shape proofs become advisory.
  if(structuralAuthority)definite=definite.filter(f=>Boolean(f?.parameters?.exactHole||f?.parameters?.exactCompoundHole));
  const definiteSet=new Set(definite);
  const ambiguous=merged.filter(f=>!definiteSet.has(f)&&DEFINITE_MACHINING_TYPES.has(normalizeType(f.type)));
  // Preserve hypotheses for diagnostics/ML review, but mark them advisory so the
  // UI and manufacturing decision cannot present an unproven pocket as fact.
  const features=merged.map(f=>definiteSet.has(f)||THROUGH_CUT_TYPES.has(normalizeType(f.type))?f:{...f,parameters:{...(f.parameters||{}),advisoryOnly:true}});
  const throughCuts=features.filter(f=>THROUGH_CUT_TYPES.has(normalizeType(f.type)));
  let turning=definite.some(f=>TURNING_TYPES.has(normalizeType(f.type))||f.process==='turning');
  let drilling=definite.some(f=>DRILLING_TYPES.has(normalizeType(f.type))||f.process==='drilling');
  let milling=definite.some(f=>MILLING_TYPES.has(normalizeType(f.type))||f.process==='milling');
  const constantThickness=Boolean(sheetResult?.ok&&Number(sheetResult?.thickness)>0&&(sheetResult?.flatPlate||Number(sheetResult?.bendCount)>0));
  const concavityProofs=definite.filter(f=>f?.parameters?.concavityProven===true&&f?.parameters?.negativeVolume===true);
  const turningProof=definite.find(f=>f?.parameters?.gpAx1Proof===true&&Number(f?.parameters?.gpAx1CollinearFraction)>0.80);
  // Canonical fallback requested for V8.22: if sheet thickness is NOT proven
  // constant and a strict concave negative-volume proof exists, "solid / unknown"
  // is no longer an acceptable terminal state. Structural stock remains the one
  // authority that can contain concave root fillets as part of the raw section.
  let forcedByConcavity=false;
  if(!structuralAuthority&&!constantThickness&&concavityProofs.length){
    forcedByConcavity=true;
    if(turningProof||machiningEvidence?.turning?.recognized)turning=true;
    else if(concavityProofs.some(f=>f.process==='drilling'))drilling=true;
    else milling=true;
  }
  const machining=turning||drilling||milling;
  const cutting=Boolean(out?.processes?.cutting||out?.capabilities?.directFlatDxf||throughCuts.length);
  out.featureInstances=features;
  out.processes={...(out.processes||{}),cutting,turning,drilling,milling,machining,possibleMachining:!machining&&ambiguous.length>0};
  out.machined=machining;
  out.process=turning?'turning':machining?'machining':'stock-profile';
  out.canonicalDecision=structuralAuthority?'structural-profile':turning?'turning':machining&&(out?.stock?.stockType==='plate-blank'||out?.capabilities?.directFlatDxf)?'plate-machining':machining?'machining':out?.process||'stock-profile';
  out.features={...(out.features||{}),recognizedInstances:features.length,secondaryMachining:machining,definiteMachiningInstances:definite.length,ambiguousMachiningInstances:ambiguous.length,throughCutInstances:throughCuts.length};
  out.diagnostics={...(out.diagnostics||{}),criticalArbitrator:true,mlUsed:Boolean(mlPrediction?.ok),mlEngine:mlPrediction?.engine||null,definiteMachiningCount:definite.length,ambiguousMachiningCount:ambiguous.length,throughCutCount:throughCuts.length,proofPolicy:'strict-concavity-negative-volume-before-ml',constantThickness,strictConcavityProofCount:concavityProofs.length,forcedByConcavity,turningGpAx1Fraction:Number(machiningEvidence?.turning?.collinearFraction)||null,canonicalDecision:out.canonicalDecision};

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

export const CRITICAL_ARBITRATOR_VERSION='8.23.1';
