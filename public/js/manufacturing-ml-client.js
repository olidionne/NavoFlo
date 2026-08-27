/* NavoFlo V8.20.0 — Optional machining-feature ML bridge.
 *
 * Local OpenCascade/MRE remains authoritative. This client asks the optional
 * NavoFeatureEngine (AAGNet) for an instance-segmentation second opinion only
 * when the deterministic engine marks a part for ML review.
 */
const STATUS_TTL_MS=5*60*1000;
const MAX_STEP_BYTES=20*1024*1024;
let statusCache=null,statusAt=0,statusPromise=null;
let queue=Promise.resolve();
const reviewCache=new Map();

function isStepFile(file){const n=String(file?.name||'').toLowerCase();return n.endsWith('.step')||n.endsWith('.stp');}
async function fetchStatus(){
  const now=Date.now();if(statusCache&&now-statusAt<STATUS_TTL_MS)return statusCache;
  if(statusPromise)return statusPromise;
  statusPromise=(async()=>{
    try{
      const r=await fetch('/api/mfr/status',{credentials:'same-origin',headers:{accept:'application/json'}});
      if(!r.ok)return{enabled:false};
      const data=await r.json();statusCache={enabled:Boolean(data?.enabled),engine:data?.engine||null,version:data?.version||null};statusAt=Date.now();return statusCache;
    }catch{return{enabled:false};}
    finally{statusPromise=null;}
  })();
  return statusPromise;
}
export async function manufacturingMlStatus(){return fetchStatus();}

async function analyzeNow(file,knowledge){
  if(!file||!isStepFile(file)||Number(file.size)>MAX_STEP_BYTES)return null;
  const status=await fetchStatus();if(!status.enabled)return null;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{
    const r=await fetch('/api/mfr/analyze',{
      method:'POST',credentials:'same-origin',body:file,signal:controller.signal,
      headers:{
        'content-type':'application/step',
        'x-navoflo-file-name':encodeURIComponent(String(file.name||'model.step')),
        'x-navoflo-local-classification':String(knowledge?.classification||'').slice(0,80)
      }
    });
    if(!r.ok)return null;
    const data=await r.json();
    if(!data?.ok)return null;
    return data;
  }catch(error){
    if(error?.name!=='AbortError')console.warn('[NavoFlo MFR ML bridge]',error);
    return null;
  }finally{clearTimeout(timer);}
}

export function requestManufacturingMlReview(file,knowledge,{force=false}={}){
  if(!force&&!knowledge?.diagnostics?.needsMlReview)return Promise.resolve(null);
  const key=`${String(file?.name||'')}|${Number(file?.size)||0}|${Number(file?.lastModified)||0}`;
  if(!force&&reviewCache.has(key))return reviewCache.get(key);
  // Serialize local requests. Opening a batch of STEP files must not create a
  // burst of heavyweight PyTorch/PythonOCC inference jobs.
  const task=queue.then(()=>analyzeNow(file,knowledge),()=>analyzeNow(file,knowledge));
  queue=task.catch(()=>null);reviewCache.set(key,task);
  task.then(result=>{if(!result)reviewCache.delete(key);},()=>reviewCache.delete(key));
  return task;
}

export const MANUFACTURING_ML_CLIENT_VERSION='8.20.0';
