(() => {
  const fr=document.documentElement.lang.toLowerCase().startsWith('fr');
  const message=document.querySelector('[data-auth-message]');
  const show=(text,ok=false)=>{if(!message)return;message.innerHTML=text?`<div class="auth-alert ${ok?'auth-success':''}">${text}</div>`:'';};
  async function api(path,options={}){const r=await fetch(path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Request failed');e.code=d.code;throw e;}return d;}
  const next=()=>new URLSearchParams(location.search).get('next')||'/account/licenses/';

  const login=document.querySelector('[data-auth-login]');
  if(login){
    api('/api/auth/me').then(s=>{if(s.authenticated){location.href=next();return;}if(s.bootstrap_available){login.querySelector('[data-bootstrap]').hidden=false;const a=login.querySelector('[data-bootstrap] a');if(a)a.href=(fr?'/auth/setup/':'/en/auth/setup/')+'?next='+encodeURIComponent(next());}}).catch(()=>{});
    login.querySelector('[data-login-form]').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;show('');const f=new FormData(e.currentTarget);try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});location.href=next();}catch(err){show(err.message);b.disabled=false;}});
  }

  const setup=document.querySelector('[data-auth-setup]');
  if(setup){
    setup.querySelector('[data-setup-form]').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget),p=String(f.get('password')||''),c=String(f.get('confirm')||'');if(p!==c){show(fr?'Les mots de passe ne correspondent pas.':'Passwords do not match.');return;}const b=e.submitter;b.disabled=true;try{await api('/api/auth/bootstrap',{method:'POST',body:JSON.stringify({password:p})});show(fr?'Compte activé. Redirection…':'Account activated. Redirecting…',true);location.href=next();}catch(err){show(err.message);b.disabled=false;}});
  }


  const forgot=document.querySelector('[data-auth-forgot]');
  if(forgot){
    forgot.querySelector('[data-forgot-form]').addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,b=e.submitter;b.disabled=true;show('');const f=new FormData(form);
      try{
        await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:f.get('email')})});
        show(fr?'Si un compte actif correspond à ce courriel, un lien de réinitialisation vient d’être envoyé. Vérifiez aussi vos indésirables.':'If an active account matches that email, a reset link has been sent. Please also check your spam folder.',true);
        form.reset();b.disabled=false;
      }catch(err){show(err.message);b.disabled=false;}
    });
  }

  const reset=document.querySelector('[data-auth-reset]');
  if(reset){
    const token=new URLSearchParams(location.search).get('token')||'',form=reset.querySelector('[data-reset-form]');
    if(token)history.replaceState(null,'',location.pathname);
    if(!token){show(fr?'Ce lien de réinitialisation est invalide ou incomplet.':'This password reset link is invalid or incomplete.');form.hidden=true;}
    else{
      api('/api/auth/reset-password?token='+encodeURIComponent(token)).then(()=>{form.hidden=false;}).catch(err=>{show(err.message);form.hidden=true;});
      form.addEventListener('submit',async e=>{
        e.preventDefault();const f=new FormData(form),p=String(f.get('password')||''),c=String(f.get('confirm')||'');
        if(p!==c){show(fr?'Les mots de passe ne correspondent pas.':'Passwords do not match.');return;}
        const b=e.submitter;b.disabled=true;show('');
        try{
          await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token,password:p})});
          show(fr?'Mot de passe modifié. Toutes vos anciennes sessions NavoFlo ont été déconnectées. Redirection…':'Password changed. All of your previous NavoFlo sessions have been signed out. Redirecting…',true);
          setTimeout(()=>{location.href=fr?'/login/':'/en/login/';},900);
        }catch(err){show(err.message);b.disabled=false;}
      });
    }
  }

  const invite=document.querySelector('[data-invite-accept]');
  if(invite){
    const token=new URLSearchParams(location.search).get('token')||'',desc=invite.querySelector('[data-invite-description]'),form=invite.querySelector('[data-invite-form]');
    api('/api/auth/invitation?token='+encodeURIComponent(token)).then(info=>{desc.innerHTML=fr?`Vous êtes invité à rejoindre <span class="auth-invite-org">${info.organization_name||'NavoFlo'}</span> avec ${info.email}.`:`You are invited to join <span class="auth-invite-org">${info.organization_name||'NavoFlo'}</span> as ${info.email}.`;const name=form.elements.display_name;if(name&&info.display_name)name.value=info.display_name;if(info.has_account){form.querySelectorAll('input[type=password]').forEach(x=>x.required=false);form.querySelectorAll('label').forEach(l=>{if(l.querySelector('input[type=password]'))l.hidden=true;});form.querySelector('button').textContent=fr?'Accepter avec mon compte existant':'Accept with my existing account';show(fr?'Si vous n’êtes pas déjà connecté à ce compte, connectez-vous d’abord puis rouvrez ce lien.':'If you are not already signed in to this account, sign in first and reopen this link.');}form.hidden=false;}).catch(err=>{desc.textContent='';show(err.message);});
    form.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(form),p=String(f.get('password')||''),c=String(f.get('confirm')||'');if(p!==c){show(fr?'Les mots de passe ne correspondent pas.':'Passwords do not match.');return;}const b=e.submitter;b.disabled=true;try{await api('/api/auth/accept-invitation',{method:'POST',body:JSON.stringify({token,password:p,display_name:f.get('display_name')})});location.href='/account/licenses/';}catch(err){show(err.message);b.disabled=false;}});
  }
})();
