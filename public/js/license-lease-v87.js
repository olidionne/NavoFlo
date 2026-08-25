(() => {
  const script = document.currentScript;
  const product = String(script?.dataset?.product || '').toLowerCase();
  const modulePath = String(script?.dataset?.module || '');
  if (!product) return;

  const fr = document.documentElement.lang.toLowerCase().startsWith('fr');
  const DEVICE_KEY = 'navoflo_device_id';
  const NAME_KEY = 'navoflo_device_name';
  const HEARTBEAT_MS = 20000;
  const BUILD = '8.7';
  const LOAD_WATCHDOG_MS = 15000;
  let leaseToken = '';
  let expiresAt = 0;
  let heartbeatTimer = null;
  let expiryTimer = null;
  let started = false;
  let locked = true;
  let acquirePromise = null;
  let acquireGeneration = 0;
  let loadingWatchdog = null;
  let loadingStartedAt = 0;
  let lastStage = 'boot';

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes);
    return [...bytes].map((b,i)=>(i===4||i===6||i===8||i===10?'-':'')+b.toString(16).padStart(2,'0')).join('');
  }

  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) { deviceId = uuid(); localStorage.setItem(DEVICE_KEY, deviceId); }

  function browserName() {
    const ua = navigator.userAgent;
    if (/Edg\//.test(ua)) return 'Edge';
    if (/Chrome\//.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
    return 'Navigateur';
  }
  function osName() {
    const ua=navigator.userAgent;
    if (/Windows/.test(ua)) return 'Windows';
    if (/Mac OS|Macintosh/.test(ua)) return 'macOS';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad/.test(ua)) return 'iOS';
    return navigator.platform || 'Appareil';
  }
  const generatedName = `${osName()} · ${browserName()} · ${deviceId.slice(-4).toUpperCase()}`;
  const deviceName = localStorage.getItem(NAME_KEY) || generatedName;

  const style=document.createElement('style');
  style.textContent=`
    #navoflo-license-gate{position:fixed;inset:0;z-index:2147483647;background:rgba(5,10,15,.94);display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eef6fa}
    #navoflo-license-gate[hidden]{display:none!important}
    #navoflo-license-gate .nlg-card{width:min(520px,100%);background:#101b23;border:1px solid #2c4351;border-radius:18px;padding:26px;box-shadow:0 28px 90px rgba(0,0,0,.46)}
    #navoflo-license-gate .nlg-kicker{font-size:11px;letter-spacing:.16em;font-weight:800;color:#34d399;margin-bottom:12px}
    #navoflo-license-gate h2{margin:0 0 10px;font-size:26px;line-height:1.15}#navoflo-license-gate p{color:#adc0cc;line-height:1.55;margin:8px 0}
    #navoflo-license-gate .nlg-device{margin:16px 0;padding:14px;border:1px solid #314957;border-radius:12px;background:#091219}.nlg-device strong{display:block;color:#fff;margin-top:4px}
    #navoflo-license-gate .nlg-actions{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px}
    #navoflo-license-gate button,#navoflo-license-gate a{border:1px solid #355061;border-radius:10px;padding:11px 15px;background:#14242f;color:#eaf4f8;font-weight:750;text-decoration:none;cursor:pointer}
    #navoflo-license-gate .primary{background:#35d19f;border-color:#35d19f;color:#05120e}#navoflo-license-gate .danger{background:#a52b38;border-color:#c04a56;color:white}
    #navoflo-license-gate .nlg-spinner{width:30px;height:30px;border:3px solid #26404d;border-top-color:#35d19f;border-radius:50%;animation:nlgspin .8s linear infinite;margin:0 auto 18px}@keyframes nlgspin{to{transform:rotate(360deg)}}
    body.navoflo-license-locked > *:not(#navoflo-license-gate){pointer-events:none!important;user-select:none!important}
  `;
  document.head.appendChild(style);

  let gate=document.createElement('div'); gate.id='navoflo-license-gate'; document.body.appendChild(gate);
  function accountUrl(){ return '/account/licenses/'; }
  function loginUrl(){ return (fr?'/login/':'/en/login/')+'?next='+encodeURIComponent(location.pathname+location.search); }
  function clearLoadingWatchdog(){ if(loadingWatchdog){ clearTimeout(loadingWatchdog); loadingWatchdog=null; } }
  function card(inner){ gate.innerHTML=`<div class="nlg-card">${inner}</div>`; gate.hidden=false; gate.style.display='flex'; gate.setAttribute('aria-hidden','false'); document.body.classList.add('navoflo-license-locked'); locked=true; }
  function fatalLoadingTimeout(){
    const elapsed=Math.max(0,Math.round((Date.now()-loadingStartedAt)/1000));
    card(`<div class="nlg-kicker">NAVOFLO · ${product.toUpperCase()} · V${BUILD}</div><h2>${fr?'Validation interrompue':'Validation stopped'}</h2><p>${fr?'La validation de licence n’a pas terminé dans le délai prévu.':'License validation did not finish within the expected time.'}</p><div class="nlg-device"><span>${fr?'Diagnostic':'Diagnostic'}</span><strong>${fr?'Étape':'Stage'}: ${lastStage}</strong><small>${elapsed}s · build ${BUILD}</small></div><div class="nlg-actions"><a href="${accountUrl()}">${fr?'Mon compte':'My account'}</a><button class="primary" data-retry>${fr?'Réessayer':'Retry'}</button></div>`);
    gate.querySelector('[data-retry]')?.addEventListener('click',()=>acquire(false));
  }
  function loading(message){
    clearLoadingWatchdog(); loadingStartedAt=Date.now(); lastStage='loading';
    card(`<div class="nlg-kicker">NAVOFLO · ${product.toUpperCase()} · V${BUILD}</div><div class="nlg-spinner"></div><h2>${fr?'Validation de la licence':'Checking license'}</h2><p>${message|| (fr?'NavoFlo vérifie votre licence et ce poste…':'NavoFlo is checking your license and this device…')}</p><p style="font-size:12px;opacity:.72">Build ${BUILD}</p>`);
    loadingWatchdog=setTimeout(()=>{ loadingWatchdog=null; fatalLoadingTimeout(); },LOAD_WATCHDOG_MS);
  }
  function unlock(){ clearLoadingWatchdog(); gate.hidden=true; gate.style.display='none'; gate.setAttribute('aria-hidden','true'); document.body.classList.remove('navoflo-license-locked'); locked=false; }

  async function post(path, body, timeoutMs=12000) {
    const controller=new AbortController();
    let timedOut=false;
    let timer;
    const timeout=new Promise((_,reject)=>{
      timer=setTimeout(()=>{
        timedOut=true;
        try{controller.abort();}catch{}
        const e=new Error(fr?'Le serveur de licences met trop de temps à répondre.':'The license server is taking too long to respond.');
        e.network=true; e.timeout=true; reject(e);
      },timeoutMs);
    });
    try {
      const requestPromise=(async()=>{
        lastStage='fetch:'+path;
        const r=await fetch(path,{
          method:'POST',
          headers:{'content-type':'application/json','accept':'application/json'},
          body:JSON.stringify(body),
          signal:controller.signal,
          cache:'no-store',
          credentials:'same-origin'
        });
        // Keep the watchdog alive until the COMPLETE response body has been read.
        lastStage='read-response:'+path;
        const text=await r.text();
        let d={};
        if(text){ try{d=JSON.parse(text);}catch{d={error:text.slice(0,500)};} }
        lastStage='parsed-response:'+path;
        return {r,d};
      })();
      const {r,d}=await Promise.race([requestPromise,timeout]);
      lastStage='response-complete:'+path;
      if(!r.ok){const e=new Error(d.error||'License request failed');e.code=d.code;e.details=d.details;e.status=r.status;throw e;}
      return d;
    } catch(cause) {
      if(cause?.network) throw cause;
      const aborted=timedOut||cause?.name==='AbortError';
      if(aborted){
        const e=new Error(fr?'Le serveur de licences met trop de temps à répondre.':'The license server is taking too long to respond.');
        e.network=true; e.timeout=true; e.cause=cause; throw e;
      }
      if(cause?.code||cause?.status) throw cause;
      const e=new Error(fr?'Connexion au serveur impossible.':'Unable to reach the server.');
      e.network=true; e.cause=cause; throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  function stopTimers(){ clearInterval(heartbeatTimer); clearInterval(expiryTimer); heartbeatTimer=null; expiryTimer=null; }
  function lockLease(message,{moved=false}={}){
    clearLoadingWatchdog(); stopTimers(); leaseToken='';
    const title=moved?(fr?'Licence déplacée vers un autre poste':'License moved to another device'):(fr?'Licence interrompue':'License interrupted');
    const action=moved?(fr?'Reprendre sur ce poste':'Use this device again'):(fr?'Réessayer':'Retry');
    card(`<div class="nlg-kicker">NAVOFLO · ${product.toUpperCase()}</div><h2>${title}</h2><p>${message|| (fr?'Cette session n’a plus de licence active.':'This session no longer has an active license.')}</p><div class="nlg-actions"><a href="${accountUrl()}">${fr?'Mon compte':'My account'}</a><button class="primary" data-retry>${action}</button></div>`);
    gate.querySelector('[data-retry]')?.addEventListener('click',()=>acquire(moved));
    window.dispatchEvent(new CustomEvent('navoflo:lease-lost',{detail:{product,moved}}));
  }

  async function heartbeat(){
    if(!leaseToken)return;
    if(Date.now()>=expiresAt){ lockLease(fr?'La connexion de licence a expiré. Reconnectez-vous pour continuer.':'The license connection expired. Reconnect to continue.'); return; }
    try{
      const d=await post('/api/licensing/lease/refresh',{lease_token:leaseToken});
      expiresAt=Date.parse(d.expires_at)||Date.now()+90000;
      window.dispatchEvent(new CustomEvent('navoflo:lease-refreshed',{detail:d}));
    }catch(e){
      if(e.network){ return; } // hard expiry timer will close the app if connectivity does not return.
      lockLease(fr?'Cette licence vient d’être transférée ou reprise sur un autre poste. Navo2D a été verrouillé sur ce poste.':'This license was just transferred or taken over on another device. Navo2D has been locked on this device.',{moved:e.code==='LEASE_INVALID'});
    }
  }

  function schedule(){
    stopTimers();
    heartbeatTimer=setInterval(heartbeat,HEARTBEAT_MS);
    expiryTimer=setInterval(()=>{if(leaseToken&&Date.now()>=expiresAt)lockLease(fr?'La connexion de licence a expiré.':'The license connection expired.');},1000);
  }

  async function startApp(){
    lastStage='start-app';
    unlock();
    if(started)return;
    started=true;
    window.NavoFloLease={product,deviceId,deviceName,get expiresAt(){return expiresAt;},release,refresh:heartbeat};
    window.dispatchEvent(new CustomEvent('navoflo:lease-acquired',{detail:{product,deviceId,deviceName,expires_at:new Date(expiresAt).toISOString()}}));
    if(modulePath){
      try{ lastStage='import-app'; await import(modulePath); lastStage='app-started'; }
      catch(e){ console.error(e); card(`<div class="nlg-kicker">NAVOFLO</div><h2>${fr?'Impossible de démarrer Navo2D':'Unable to start Navo2D'}</h2><p>${String(e?.message||e)}</p><div class="nlg-actions"><button class="primary" onclick="location.reload()">${fr?'Recharger':'Reload'}</button></div>`); }
    }
  }

  function showConflict(e){
    clearLoadingWatchdog(); lastStage='license-conflict';
    const name=e.details?.device_name || (fr?'un autre poste':'another device');
    const until=e.details?.expires_at ? new Date(e.details.expires_at).toLocaleTimeString(fr?'fr-CA':'en-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
    card(`<div class="nlg-kicker">NAVOFLO · ${product.toUpperCase()}</div><h2>${fr?'Licence déjà utilisée':'License already in use'}</h2><p>${fr?'Cette licence est actuellement active sur un autre poste. Une licence NavoFlo ne peut jamais être utilisée sur deux postes simultanément.':'This license is currently active on another device. A NavoFlo license cannot be used on two devices at the same time.'}</p><div class="nlg-device"><span>${fr?'Poste actif':'Active device'}</span><strong>${name}</strong>${until?`<small>${fr?'Lease actuelle jusqu’à':'Current lease until'} ${until}</small>`:''}</div><p>${fr?'En continuant, NavoFlo révoquera immédiatement la lease de l’autre poste. Celui-ci sera verrouillé à son prochain heartbeat.':'Continuing immediately revokes the other device lease. It will be locked at its next heartbeat.'}</p><div class="nlg-actions"><a href="${accountUrl()}">${fr?'Retour au compte':'Back to account'}</a><button class="primary" data-takeover>${fr?'Utiliser ce poste':'Use this device'}</button></div>`);
    gate.querySelector('[data-takeover]')?.addEventListener('click',()=>acquire(true));
  }

  async function acquire(force=false){
    // Never allow two acquire requests from this page to race and invalidate one another.
    if(acquirePromise) return acquirePromise;
    const generation=++acquireGeneration;
    loading(force?(fr?'Transfert de la session vers ce poste…':'Moving the session to this device…'):undefined);
    acquirePromise=(async()=>{
      try{
        lastStage='acquire-request';
        const d=await post('/api/licensing/lease/acquire',{product,device_id:deviceId,device_name:deviceName,force},12000);
        if(generation!==acquireGeneration)return;
        lastStage='acquire-response';
        if(!d?.lease_token) throw new Error(fr?'Le serveur n’a retourné aucun jeton de licence.':'The server did not return a license token.');
        leaseToken=d.lease_token; expiresAt=Date.parse(d.expires_at)||Date.now()+90000; lastStage='lease-acquired'; schedule(); await startApp();
      }catch(e){
        if(generation!==acquireGeneration)return;
        if(e.code==='AUTH_REQUIRED'){ location.href=loginUrl(); return; }
        if(e.code==='LICENSE_IN_USE'&&!force){ showConflict(e); return; }
        if(['FEATURE_NOT_LICENSED','LICENSE_REQUIRED','NO_ORGANIZATION'].includes(e.code)){
          card(`<div class="nlg-kicker">NAVOFLO · ${product.toUpperCase()}</div><h2>${fr?'Licence requise':'License required'}</h2><p>${fr?'Aucune licence donnant accès à cette application n’est actuellement attribuée à votre compte.':'No license granting access to this application is currently assigned to your account.'}</p><div class="nlg-actions"><a class="primary" href="${accountUrl()}">${fr?'Voir mes licences':'View my licenses'}</a></div>`); return;
        }
        clearLoadingWatchdog();
        card(`<div class="nlg-kicker">NAVOFLO · V${BUILD}</div><h2>${fr?'Impossible de valider la licence':'Unable to validate license'}</h2><p>${String(e.message||e)}</p><div class="nlg-actions"><a href="${accountUrl()}">${fr?'Mon compte':'My account'}</a><button class="primary" data-retry>${fr?'Réessayer':'Retry'}</button></div>`);
        gate.querySelector('[data-retry]')?.addEventListener('click',()=>acquire(false));
      } finally {
        if(generation===acquireGeneration) acquirePromise=null;
      }
    })();
    return acquirePromise;
  }

  async function release(){
    if(!leaseToken)return;
    const token=leaseToken; leaseToken=''; stopTimers();
    try{await post('/api/licensing/lease/release',{lease_token:token});}catch{}
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&leaseToken)heartbeat();});

  addEventListener('pagehide',()=>{
    if(!leaseToken)return;
    const token=leaseToken; leaseToken=''; stopTimers();
    try{navigator.sendBeacon?.('/api/licensing/lease/release',new Blob([JSON.stringify({lease_token:token})],{type:'application/json'}));}catch{}
  });
  addEventListener('keydown',e=>{if(locked){e.stopImmediatePropagation();}},true);

  window.NavoFloLeaseBuild=BUILD;
  acquire(false);
})();
