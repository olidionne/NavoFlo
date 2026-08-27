/* NavoFlo V8.20.0 — Raw Stock Knowledge Helper
 *
 * This helper adds manufacturing-domain plausibility on top of geometry.
 * It intentionally does NOT replace B-Rep recognition.  It answers a narrower
 * question: "is this geometric stock hypothesis plausible as a commercial raw
 * product, or is it much more likely to be plate/sheet?"
 *
 * Reference rules used as manufacturing priors:
 * - ASTM A663/A663M-23 merchant-quality flats: <= 6 in wide generally, and
 *   >6..8 in under the stated thickness/area limits.  We use the 8 in width as
 *   a strong *merchant flat-bar* boundary, not as a universal legal definition
 *   of every flat product sold by every mill.
 * - AISC EDI naming convention: FB<t>x<w>, RB<diameter>, HB<across-flats>.
 *
 * The helper is deliberately conservative around the 8..12 in transition.
 * Geometry/capabilities remain independent: a rectangle can still export DXF
 * even when its stock family is downgraded from flat-bar to plate.
 */

const INCH=25.4;
const EPS=1e-9;
const COMMON_IMPERIAL_THICKNESS_IN=[
  1/32,1/16,3/32,1/8,5/32,3/16,7/32,1/4,5/16,3/8,7/16,1/2,
  9/16,5/8,11/16,3/4,7/8,1,1.125,1.25,1.5,1.75,2,2.25,2.5,3,3.5,4
];
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,v));}
function finite(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function near(a,b,tol){return Math.abs(a-b)<=tol;}
function nearestStandardThickness(mm){
  const inch=Number(mm)/INCH;if(!(inch>0))return null;
  let best=null;for(const t of COMMON_IMPERIAL_THICKNESS_IN){const err=Math.abs(inch-t);if(!best||err<best.errorIn)best={valueIn:t,valueMm:t*INCH,errorIn:err};}
  if(!best)return null;best.relativeError=best.errorIn/Math.max(inch,EPS);best.near=best.errorIn<=Math.max(0.004,inch*0.012);return best;
}

// Convert a decimal inch value to a compact AISC-like fractional token.
export function formatImperialFraction(value,{denominator=64}={}){
  const n=finite(value);if(n==null)return null;const sign=n<0?'-':'';const a=Math.abs(n),whole=Math.floor(a+1e-12),num0=Math.round((a-whole)*denominator);
  let num=num0,den=denominator,w=whole;if(num>=den){w++;num-=den;}if(num===0)return `${sign}${w}`;
  const gcd=(x,y)=>{x=Math.abs(x);y=Math.abs(y);while(y){const r=x%y;x=y;y=r;}return x||1;};const g=gcd(num,den);num/=g;den/=g;
  return `${sign}${w?`${w}-`:''}${num}/${den}`;
}

export function aiscEdiBarLabel(stock){
  if(!stock)return null;
  if(stock.stockType==='flat-bar'&&Number(stock.widthMm)>0&&Number(stock.thicknessMm)>0)return `FB${formatImperialFraction(stock.thicknessMm/INCH)}X${formatImperialFraction(stock.widthMm/INCH)}`;
  if(stock.stockType==='round-bar'&&Number(stock.diameterMm)>0)return `RB${formatImperialFraction(stock.diameterMm/INCH)}`;
  if(stock.stockType==='hex-bar'&&Number(stock.acrossFlatsMm)>0)return `HB${formatImperialFraction(stock.acrossFlatsMm/INCH)}`;
  return null;
}

export function assessRectangularRawStock({widthMm,thicknessMm,lengthMm}={}){
  const W=finite(widthMm),T=finite(thicknessMm),L=finite(lengthMm);if(!(W>EPS&&T>EPS))return null;
  const width=Math.max(W,T),thickness=Math.min(W,T),widthIn=width/INCH,thicknessIn=thickness/INCH,lengthIn=L>0?L/INCH:null;
  const crossRatio=width/thickness,standardT=nearestStandardThickness(thickness);

  // Merchant-quality flat bar range from ASTM A663/A663M.  Thin cold-finished
  // flats can exist below the A663 thickness threshold, so width is the more
  // useful prior for our classification and thickness is only supporting data.
  const withinMerchantWidth=widthIn<=8+1e-6;
  const clearlyPlateWidth=widthIn>12+1e-6;
  const transitionWidth=widthIn>8&&widthIn<=12+1e-6;
  const extremeSlenderCross=crossRatio>=80;
  const broadPlateCross=crossRatio>=45&&widthIn>8;

  let flatBarScore=0.78,plateScore=0.22;
  const reasons=[];
  if(withinMerchantWidth){flatBarScore+=0.15;plateScore-=0.08;reasons.push('astm-a663-flat-width');}
  if(transitionWidth){flatBarScore-=0.30;plateScore+=0.28;reasons.push('flat-plate-transition-width');}
  if(clearlyPlateWidth){flatBarScore-=0.62;plateScore+=0.64;reasons.push('width-far-beyond-merchant-flat');}
  if(extremeSlenderCross){flatBarScore-=0.18;plateScore+=0.20;reasons.push('plate-like-width-thickness-ratio');}
  else if(broadPlateCross){flatBarScore-=0.10;plateScore+=0.12;reasons.push('broad-flat-cross-section');}
  if(standardT?.near){reasons.push('standard-imperial-thickness');}
  if(lengthIn!=null&&lengthIn<widthIn*0.9&&widthIn>8){flatBarScore-=0.10;plateScore+=0.12;reasons.push('plate-like-plan-proportions');}
  flatBarScore=clamp(flatBarScore);plateScore=clamp(plateScore);

  let recommendedFamily='flat-bar',confidence=flatBarScore;
  if(clearlyPlateWidth||plateScore>flatBarScore+0.12){recommendedFamily='plate';confidence=plateScore;}
  else if(Math.abs(flatBarScore-plateScore)<=0.12){recommendedFamily='ambiguous-flat';confidence=Math.max(flatBarScore,plateScore);}

  return{
    recommendedFamily,confidence,flatBarScore,plateScore,
    widthMm:width,thicknessMm:thickness,lengthMm:L,
    widthIn,thicknessIn,lengthIn,crossRatio,
    merchantFlatWidthMaxIn:8,
    standardThickness:standardT,
    reasons:[...new Set(reasons)],
    source:'ASTM A663/A663M-23 + AISC EDI naming prior'
  };
}

export function applyRawStockKnowledge(candidate){
  if(!candidate)return candidate;
  const out={...candidate};
  if(['flat-bar','rectangular-bar','square-bar'].includes(out.stockType)&&Number(out.widthMm)>0&&Number(out.thicknessMm)>0){
    const knowledge=assessRectangularRawStock(out);out.stockKnowledge=knowledge;
    // Only flat/rectangular stock can be reinterpreted as plate.  Never convert
    // a true square bar just because a large square happens to exceed 8 in.
    const rectangularFlat=out.stockType==='flat-bar'||(out.stockType==='rectangular-bar'&&Number(out.widthMm)/Math.max(Number(out.thicknessMm),EPS)>=2.5);
    if(rectangularFlat&&knowledge?.recommendedFamily==='plate'){
      out.originalStockType=out.stockType;out.stockType='plate-blank';out.source='raw-stock-knowledge-plate';
      out.confidence=clamp(Math.max(Number(out.confidence)||0,Number(knowledge.confidence)||0));
      out.commercialStockReclassified=true;
    }else if(knowledge?.recommendedFamily==='ambiguous-flat'){
      out.stockAmbiguous=true;out.confidence=clamp((Number(out.confidence)||0)*0.94);
    }
  }
  out.ediLabel=aiscEdiBarLabel(out);
  return out;
}

export const RAW_STOCK_KNOWLEDGE_VERSION='2026-08-27/A663-AISC-EDI-v1';
