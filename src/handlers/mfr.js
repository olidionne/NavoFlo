import { json } from '../lib/stripe.js';
import { sessionUser } from '../lib/auth.js';
import { featureAuthorized } from '../lib/licensing.js';
import { enforceRateLimit } from '../lib/security.js';

const MAX_MFR_BODY=20*1024*1024;
function enabled(env){return Boolean(String(env?.NAVOFLO_MFR_URL||'').trim());}
function serviceUrl(env,path){return new URL(path,String(env.NAVOFLO_MFR_URL).replace(/\/+$/,'')+'/').toString();}
async function requireMfrUser(request,env){
  const user=await sessionUser(request,env,{touch:true});
  if(!user)return{error:json({error:'Authentication required.',code:'AUTH_REQUIRED'},401)};
  if(user.status!=='active')return{error:json({error:'Account inactive.',code:'ACCOUNT_INACTIVE'},403)};
  if(!(await featureAuthorized(request,env,'navo3d')))return{error:json({error:'Navo3D license required.',code:'LICENSE_REQUIRED'},403)};
  return{user};
}
export async function getMfrStatus({request,env}){
  const auth=await requireMfrUser(request,env);if(auth.error)return auth.error;
  return json({enabled:enabled(env),engine:enabled(env)?'AAGNet+NavoCriticalArbitrator':null,version:'8.20.0'},200,{'cache-control':'private, max-age=60'});
}
export async function postMfrAnalyze({request,env}){
  const auth=await requireMfrUser(request,env);if(auth.error)return auth.error;
  if(!enabled(env))return json({error:'Manufacturing ML service is not configured.',code:'MFR_DISABLED'},503);
  await enforceRateLimit(request,env,'mfr-analysis',{identity:String(auth.user.id||auth.user.email||''),limit:30,windowSeconds:900,blockSeconds:900});
  const rawLength=Number(request.headers.get('content-length'));
  if(Number.isFinite(rawLength)&&rawLength>MAX_MFR_BODY)return json({error:'STEP file is too large for ML review.',code:'REQUEST_TOO_LARGE'},413);
  const contentType=String(request.headers.get('content-type')||'application/step').toLowerCase();
  if(!contentType.includes('step')&&!contentType.includes('octet-stream'))return json({error:'Expected a STEP file.',code:'MFR_BAD_CONTENT_TYPE'},415);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
  try{
    const headers=new Headers({'content-type':'application/step','accept':'application/json'});
    const name=request.headers.get('x-navoflo-file-name');if(name)headers.set('x-file-name',name);
    const token=String(env?.NAVOFLO_MFR_TOKEN||'').trim();if(token)headers.set('authorization',`Bearer ${token}`);
    const upstream=await fetch(serviceUrl(env,'analyze'),{method:'POST',headers,body:request.body,signal:controller.signal});
    const text=await upstream.text();
    const responseHeaders={'content-type':upstream.headers.get('content-type')||'application/json; charset=utf-8','cache-control':'no-store'};
    return new Response(text,{status:upstream.status,headers:responseHeaders});
  }catch(error){
    const timeout=error?.name==='AbortError';
    return json({error:timeout?'Manufacturing ML analysis timed out.':'Manufacturing ML service unavailable.',code:timeout?'MFR_TIMEOUT':'MFR_UNAVAILABLE'},timeout?504:503);
  }finally{clearTimeout(timer);}
}
export { MAX_MFR_BODY };
