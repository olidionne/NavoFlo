(() => {
  const script=document.currentScript;
  const product=script?.dataset?.product||'';
  if(!product)return;
  const key='navoflo_device_id';
  let deviceId=localStorage.getItem(key);
  if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(key,deviceId);}
  const deviceName=localStorage.getItem('navoflo_device_name')||`${navigator.platform||'Device'} · ${navigator.userAgent.includes('Windows')?'Windows':navigator.userAgent.includes('Mac')?'macOS':'Browser'}`;
  let leaseToken='',timer=null;
  async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'License request failed');e.code=d.code;e.details=d.details;throw e;}return d;}
  async function acquire(force=false){try{const d=await post('/api/licensing/lease/acquire',{product,device_id:deviceId,device_name:deviceName,force});leaseToken=d.lease_token;schedule();return d;}catch(e){if(e.code==='LICENSE_IN_USE'&&!force){const name=e.details?.device_name||'un autre poste';if(confirm(`Cette licence est déjà utilisée sur ${name}. Transférer la session sur cet appareil?`))return acquire(true);}throw e;}}
  function schedule(){clearInterval(timer);timer=setInterval(async()=>{if(!leaseToken)return;try{await post('/api/licensing/lease/refresh',{lease_token:leaseToken});}catch{clearInterval(timer);leaseToken='';location.href='/account/licenses/?denied=1';}},60000);}
  async function release(){if(!leaseToken)return;const token=leaseToken;leaseToken='';clearInterval(timer);try{await post('/api/licensing/lease/release',{lease_token:token});}catch{}}
  window.NavoFloLease={acquire,release,deviceId};
  acquire().catch(e=>{alert(e.message);location.href='/account/licenses/?denied=1';});
  addEventListener('pagehide',()=>{if(leaseToken)navigator.sendBeacon?.('/api/licensing/lease/release',new Blob([JSON.stringify({lease_token:leaseToken})],{type:'application/json'}));});
})();
