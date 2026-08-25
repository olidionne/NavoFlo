const DB_NAME='navoflo-cad-session-v1';
const DB_VERSION=1;
const STORE='workspaces';
const SESSION_KEY='navofloCadSessionId';

function sessionId(){
  let id=sessionStorage.getItem(SESSION_KEY);
  if(!id){
    id=crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(SESSION_KEY,id);
  }
  return id;
}

function openDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function withStore(mode,fn){
  const db=await openDb();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
      let result;
      try{result=fn(store);}catch(error){reject(error);return;}
      tx.oncomplete=()=>resolve(result?.result);
      tx.onerror=()=>reject(tx.error||result?.error);
      tx.onabort=()=>reject(tx.error||new Error('IndexedDB transaction aborted'));
    });
  }finally{db.close();}
}

export async function saveCadWorkspace(moduleName,data){
  if(!('indexedDB'in window))return false;
  const key=`${sessionId()}:${moduleName}`;
  try{await withStore('readwrite',store=>store.put({key,data,updatedAt:Date.now()}));return true;}
  catch(error){console.warn('[NavoFlo CAD session save]',moduleName,error);return false;}
}

export async function loadCadWorkspace(moduleName){
  if(!('indexedDB'in window))return null;
  const key=`${sessionId()}:${moduleName}`;
  try{
    const db=await openDb();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get(key);
      request.onsuccess=()=>resolve(request.result?.data??null);
      request.onerror=()=>reject(request.error);
      tx.oncomplete=()=>db.close();
      tx.onabort=()=>{db.close();reject(tx.error);};
    });
  }catch(error){console.warn('[NavoFlo CAD session load]',moduleName,error);return null;}
}

export async function clearCadWorkspace(moduleName){
  if(!('indexedDB'in window))return;
  const key=`${sessionId()}:${moduleName}`;
  try{await withStore('readwrite',store=>store.delete(key));}catch(error){console.warn('[NavoFlo CAD session clear]',moduleName,error);}
}

export function bindSuitePersistence(saveFn){
  for(const link of document.querySelectorAll('.suite-switch a')){
    if(link.classList.contains('active'))continue;
    link.addEventListener('click',async event=>{
      if(event.defaultPrevented||event.button>0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      try{await saveFn();}catch(error){console.warn('[NavoFlo CAD navigation persist]',error);}
      location.href=link.href;
    });
  }
}
