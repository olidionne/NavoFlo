/* NavoFlo V8.21.1 — conservative deterministic fastener recognizer.
 *
 * No AI and no external service.  The recognizer combines assembly metadata
 * (Inventor/STEP occurrence names) with exact OCCT B-Rep primitives.  A name
 * may provide a strong prior, but geometry is required whenever the name is
 * generic.  The purpose is manufacturing arbitration: standard bolting must
 * not be mistaken for sheet metal, plate DXF stock, or a machined production
 * part.
 */
const EPS=1e-8;
const V={dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],scale:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],len:a=>Math.hypot(a[0],a[1],a[2]),unit(a){const l=this.len(a);return l>EPS?this.scale(a,1/l):null;}};
function clamp(v,a=0,b=1){return Math.max(a,Math.min(b,Number(v)||0));}
function fam(v){return String(v||'').toLowerCase();}
function vec(v){return Array.isArray(v)&&v.length>=3?v.slice(0,3).map(Number):null;}
function axis(v){let n=V.unit(vec(v)||[]);if(!n)return null;let k=0;for(let i=1;i<3;i++)if(Math.abs(n[i])>Math.abs(n[k]))k=i;if(n[k]<0)n=V.scale(n,-1);return n;}
function pointsOf(g){const p=g?.positions||[],out=[];for(let i=0;i+2<p.length;i+=3){const q=[Number(p[i]),Number(p[i+1]),Number(p[i+2])];if(q.every(Number.isFinite))out.push(q);}return out;}
function pointCentroid(points){if(!points.length)return null;const c=[0,0,0];for(const p of points){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];}return c.map(v=>v/points.length);}
function bboxSpans(points){if(!points.length)return[];const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}return hi.map((v,i)=>v-lo[i]).sort((a,b)=>a-b);}
function plateLikeBody(points){const d=bboxSpans(points);return d.length===3&&d[0]>EPS&&d[1]>EPS&&d[0]/d[1]<=0.30&&d[2]/d[1]>=1.18;}
function axisCenterOffsetRatio(points,axis,center,scale){const c=pointCentroid(points);if(!c||!axis||!center||!(scale>EPS))return Infinity;return lineDistance(center,axis,c)/scale;}
function projection(points,a){let lo=Infinity,hi=-Infinity;for(const p of points){const d=V.dot(p,a);lo=Math.min(lo,d);hi=Math.max(hi,d);}return Number.isFinite(lo)&&Number.isFinite(hi)?{lo,hi,span:hi-lo}:null;}
function radialEnvelope(points,a,c){let r=0;for(const p of points){const d=V.sub(p,c),t=V.dot(d,a),q=V.sub(d,V.scale(a,t));r=Math.max(r,V.len(q));}return r;}
function lineDistance(ca,a,cb){const d=V.sub(cb,ca),t=V.dot(d,a);return V.len(V.sub(d,V.scale(a,t)));}

const NON_HARDWARE_NAME_RE=/\b(gusset|gousset|plate|plaque|bracket|support|beam|poutre|channel|angle|stiffener|raidisseur|clip|tab|lug)\b/i;

const NAME_RULES=[
  {type:'washer',re:/\b(washer|rondelle|f436|din\s*12[567]|iso\s*70(89|93))\b/i},
  {type:'nut',re:/\b(nut|écrou|ecrou|a563|din\s*93[45]|iso\s*403[23456])\b/i},
  {type:'stud',re:/\b(stud|tige\s*filet|threaded\s*rod|all[- ]?thread)\b/i},
  {type:'screw',re:/\b(screw|vis\b|shcs|fhcs|bhcs|socket\s*head|machine\s*screw|self[- ]?tap)\b/i},
  {type:'bolt',re:/\b(bolt|boulon|hhcs|hex\s*bolt|a325|a490|f3125|din\s*93[013]|iso\s*401[4678])\b/i}
];
export function fastenerNameHint(name){const s=String(name||'').replace(/[_.-]+/g,' ');if(NON_HARDWARE_NAME_RE.test(s))return null;for(const r of NAME_RULES)if(r.re.test(s))return{type:r.type,confidence:.985,source:'assembly-name'};return null;}

function cylinderRecords(faceInfo=[]){return faceInfo.filter(f=>['cylinder','cylindrical'].includes(fam(f.family))).map(f=>({f,id:Number(f.id),a:axis(f.axisDirection),c:vec(f.localCenter),r:Number(f.radius),span:Number(f.axisSpan),hole:f.hole||null,area:Number(f.area)||0})).filter(x=>x.a&&x.c&&x.r>EPS);}
function longitudinalPlaneOrientationCount(faceInfo,a){const dirs=[];for(const f of faceInfo){if(fam(f.family)!=='plane')continue;const n=axis(f.localNormal);if(!n||Math.abs(V.dot(n,a))>0.12)continue;if(dirs.every(d=>Math.abs(V.dot(d,n))<0.985))dirs.push(n);}return dirs.length;}
function coaxial(a,c,b,d,scale){return Math.abs(V.dot(a,b))>.998&&lineDistance(c,a,d)<=Math.max(scale*.015,.03);}

export function detectFastenerComponent({name='',geometry,faceInfo=[]}={}){
  const hint=fastenerNameHint(name),points=pointsOf(geometry),cyls=cylinderRecords(faceInfo),plateLike=plateLikeBody(points);
  if(!points.length)return hint?{recognized:true,...hint,evidence:['name-prior'],name:String(name||'')}:null;
  let bestAxis=null,bestCenter=null,shank=null;
  for(const c of cyls){
    if(c.hole)continue;
    const range=projection(points,c.a);if(!range?.span)continue;
    const score=(Number.isFinite(c.span)?c.span:0)+c.area/Math.max(c.r,EPS);
    if(!shank||score>shank.score)shank={...c,score,range};
  }
  if(shank){bestAxis=shank.a;bestCenter=shank.c;}
  const throughHoles=cyls.filter(c=>c.hole?.isThrough===true),blindHoles=cyls.filter(c=>c.hole?.isThrough===false);

  // Washer: short coaxial annulus with two plane skins. This is intentionally
  // stringent so a custom large ring plate is not silently called hardware.
  for(const h of throughHoles){
    const outer=cyls.filter(c=>!c.hole&&coaxial(h.a,h.c,c.a,c.c,Math.max(c.r,h.r))).sort((a,b)=>b.r-a.r)[0];
    if(!outer||outer.r<h.r*1.35)continue;const range=projection(points,h.a);if(!range?.span)continue;
    const planes=faceInfo.filter(f=>fam(f.family)==='plane'&&Math.abs(V.dot(axis(f.localNormal)||[0,0,0],h.a))>.985).length;
    const ratio=range.span/(outer.r*2);
    if(ratio<=.22&&planes>=2&&faceInfo.length<=18){const conf=clamp(.91+(ratio<.10?.04:0)+(hint?.type==='washer'?.05:0));return{recognized:true,type:'washer',confidence:conf,source:hint?'name+brep':'brep-annulus',diameterMm:outer.r*2,lengthMm:range.span,evidence:['coaxial-through-hole','short-annulus','two-skins'],name:String(name||'')};}
  }

  // Nut: short body, central through hole and >=3 unique longitudinal plane
  // orientations (six opposing hex faces collapse to three axes).
  for(const h of throughHoles){
    const range=projection(points,h.a);if(!range?.span)continue;const outerR=radialEnvelope(points,h.a,h.c),orient=longitudinalPlaneOrientationCount(faceInfo,h.a),ratio=range.span/Math.max(outerR*2,EPS),centerOffset=axisCenterOffsetRatio(points,h.a,h.c,outerR);
    // Geometry-only nut recognition is intentionally canonical: centered axial
    // hole + regular hex family (three unique longitudinal plane orientations)
    // + compact proportions.  A gusset/plate with a hole must NEVER become a nut.
    const canonicalHex=orient===3&&centerOffset<=0.075&&!plateLike&&faceInfo.length<=40;
    const hintedNut=hint?.type==='nut'&&orient>=3&&centerOffset<=0.18;
    if(outerR>h.r*1.55&&ratio<.80&&(canonicalHex||hintedNut)){const conf=clamp(.93+(canonicalHex?.035:0)+(hintedNut?.035:0));return{recognized:true,type:'nut',confidence:conf,source:hint?'name+brep':'brep-regular-hex-through',diameterMm:outerR*2,lengthMm:range.span,evidence:['central-through-hole','regular-polygonal-body','short-body'],name:String(name||'')};}
  }

  if(shank){
    const range=shank.range,outerR=radialEnvelope(points,shank.a,shank.c),diam=shank.r*2,headRatio=outerR/Math.max(shank.r,EPS),slender=range.span/Math.max(diam,EPS),orient=longitudinalPlaneOrientationCount(faceInfo,shank.a),centerOffset=axisCenterOffsetRatio(points,shank.a,shank.c,Math.max(outerR,shank.r)),axialCoverage=Number.isFinite(shank.span)&&range.span>EPS?shank.span/range.span:0;
    // A standard bolt/screw has a long, CENTERED cylindrical shank plus a locally
    // larger head.  Edge radii on a gusset/bracket are cylindrical too, but they
    // have poor axial coverage and sit far from the body centroid.
    if(hint?.type==='stud'&&slender>=2.0&&centerOffset<=0.15)return{recognized:true,type:'stud',confidence:.985,source:'name+brep',diameterMm:diam,lengthMm:range.span,evidence:['cylindrical-shank','slender-body','name-prior'],name:String(name||'')};
    const hasHead=headRatio>=1.20&&headRatio<=2.8&&(orient>=2||faceInfo.filter(f=>fam(f.family)==='plane').length>=4);
    const hinted=hint&&['bolt','screw'].includes(hint.type);
    const canonicalShank=!plateLike&&centerOffset<=0.10&&axialCoverage>=0.35&&orient>=2&&orient<=4;
    if(hasHead&&slender>=1.15&&(canonicalShank||hinted)){
      const type=hinted?hint.type:(blindHoles.length?'screw':'bolt'),conf=clamp(.93+(canonicalShank?.035:0)+(hinted?.035:0));
      return{recognized:true,type,confidence:conf,source:hint?'name+brep':'brep-centered-headed-shank',diameterMm:diam,lengthMm:range.span,evidence:['cylindrical-shank','head-envelope','centered-axis',orient>=3?'polygonal-head':'headed-body'],name:String(name||'')};
    }
  }

  // A very strong Inventor/Content Center name is enough to protect a standard
  // component from manufacturing classification even when modeled threads make
  // its B-Rep too complex for the simple geometric signatures above.
  if(hint)return{recognized:true,...hint,evidence:['name-prior'],name:String(name||'')};
  return null;
}

export const FASTENER_RECOGNIZER_VERSION='8.21.1';
