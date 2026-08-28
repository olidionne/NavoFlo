/* NavoFlo V8.23.1 — canonical analysis policy.
 *
 * This module contains the process-neutral rules that decide HOW MUCH exact
 * B-Rep data a part needs and whether an enrichment pass may replace an already
 * proven manufacturing geometry hypothesis. Keeping this policy outside the UI
 * prevents viewer orchestration from silently changing classification semantics.
 */

export const FULL_CLASSIFICATION_FACE_LIMIT=260;
export const FULL_CLASSIFICATION_EDGE_LIMIT=950;

export function shouldUseFullClassificationDescriptors(geometry){
  const faces=Number(geometry?.faces?.length)||0;
  const edges=Number(geometry?.edges?.length)||0;
  return faces<=FULL_CLASSIFICATION_FACE_LIMIT&&edges<=FULL_CLASSIFICATION_EDGE_LIMIT;
}

export function strongGeometryHypothesis(result){
  if(!result)return false;
  if(result.code==='rolled-plate'||result.code==='structural-profile')return true;
  return Boolean(result.ok&&Number(result.bendCount)>0);
}

export function geometryHypothesisRank(result){
  if(!result)return 0;
  // A physical two-skin bend shell (Rext-Rint=T on a common gp_Ax1 and tangent
  // to two panels) is stronger than a generic constant-section/profile match.
  // This is what separates a fabricated press-brake U/tray from a geometrically
  // similar U catalog section without relying on filenames.
  if(result.ok&&Number(result.bendCount)>0&&result?.diagnostics?.pairedBendEvidence?.ok)return 112;
  if(result.code==='structural-profile')return 100;
  if(result.code==='rolled-plate')return 108;
  if(result.ok&&Number(result.bendCount)>0)return 95;
  if(result.ok&&result.flatPlate)return 70;
  if(result.ok)return 60;
  if(result.code==='machined-round-stock')return 92;
  return 10;
}

export function choosePreservedGeometryHypothesis(primary,enriched){
  if(!primary)return enriched;
  if(!enriched)return primary;
  const a=geometryHypothesisRank(primary),b=geometryHypothesisRank(enriched);

  // Strong exact manufacturing geometry cannot be erased by a generic failure.
  if(strongGeometryHypothesis(primary)&&!strongGeometryHypothesis(enriched)&&!enriched.ok)return primary;
  if(strongGeometryHypothesis(enriched)&&!strongGeometryHypothesis(primary))return enriched;

  // If both are strong, the enriched/full exact pass wins. If both are ordinary,
  // use the more informative/successful result, never a lower-ranked fallback.
  if(strongGeometryHypothesis(primary)&&strongGeometryHypothesis(enriched))return enriched;
  return b>=a?enriched:primary;
}

export const MANUFACTURING_ANALYSIS_POLICY_VERSION='8.23.1';
