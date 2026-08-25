import { json } from './lib/stripe.js';
import { createCheckout } from './handlers/create-checkout.js';
import { getSession } from './handlers/session.js';
import { createPortal } from './handlers/portal.js';
import { handleWebhook } from './handlers/webhook.js';
import {
  acquireLease,
  createAccountPortal,
  createLicensingMember,
  deleteLicensingMember,
  fastTrackLicensingSeat,
  getLicensingMe,
  getLicensingDevices,
  disconnectLicensingDevice,
  inviteLicensingMember,
  refreshLease,
  releaseLease,
  transferLicensingMember,
  updateLicensingMemberLicense
} from './handlers/licensing.js';
import {
  getAccountActivation,
  getAuthStatus,
  getAuthSessions,
  postAccountActivation,
  postRevokeAuthSession,
  postRevokeOtherAuthSessions,
  postResendAccountActivation,
  getInvitation,
  getPasswordReset,
  postAcceptInvitation,
  postForgotPassword,
  postLogin,
  postLogout,
  postResetPassword
} from './handlers/auth.js';
import { licensingContext } from './lib/licensing.js';
import { sessionUser } from './lib/auth.js';
import { getOrganizationAudit } from './handlers/audit.js';
import { getPreferences, putPreferences } from './handlers/preferences.js';
import { apiBodyTooLarge, assertTrustedMutation, hardenResponse, maybeScheduleSecurityMaintenance, runSecurityMaintenance, securityJsonError } from './lib/security.js';

const API = Object.freeze({
  '/api/stripe/create-checkout': { POST:createCheckout },
  '/api/stripe/session': { GET:getSession },
  '/api/stripe/portal': { POST:createPortal },
  '/api/stripe/webhook': { POST:handleWebhook },
  '/api/auth/me': { GET:getAuthStatus },
  '/api/auth/sessions': { GET:getAuthSessions },
  '/api/auth/sessions/revoke-others': { POST:postRevokeOtherAuthSessions },
  '/api/auth/login': { POST:postLogin },
  '/api/auth/logout': { POST:postLogout },
  '/api/auth/forgot-password': { POST:postForgotPassword },
  '/api/auth/reset-password': { GET:getPasswordReset, POST:postResetPassword },
  '/api/auth/activation': { GET:getAccountActivation, POST:postAccountActivation },
  '/api/auth/resend-activation': { POST:postResendAccountActivation },
  '/api/auth/invitation': { GET:getInvitation },
  '/api/auth/accept-invitation': { POST:postAcceptInvitation },
  '/api/audit': { GET:getOrganizationAudit },
  '/api/preferences': { GET:getPreferences, PUT:putPreferences },
  '/api/licensing/me': { GET:getLicensingMe },
  '/api/licensing/devices': { GET:getLicensingDevices },
  '/api/licensing/members': { POST:createLicensingMember },
  '/api/licensing/fast-track-seat': { POST:fastTrackLicensingSeat },
  '/api/licensing/portal': { POST:createAccountPortal },
  '/api/licensing/lease/acquire': { POST:acquireLease },
  '/api/licensing/lease/refresh': { POST:refreshLease },
  '/api/licensing/lease/release': { POST:releaseLease }
});

function methodNotAllowed(allowed){ return json({error:'Method not allowed.'},405,{Allow:allowed.join(', ')}); }

class Navo3DLeaseInjector {
  element(element){
    element.prepend('<script src="/js/license-lease-v89.js?v=8.14" data-product="navo3d" data-injected="worker-v8.14"></script>',{html:true});
  }
}
function isNavo3DPath(pathname){
  return pathname==='/navo3d'||pathname.startsWith('/navo3d/')||pathname==='/en/navo3d'||pathname.startsWith('/en/navo3d/');
}
async function serveAssetWithLeaseGate(request,env,url){
  const response=await env.ASSETS.fetch(request);
  const type=String(response.headers.get('content-type')||'').toLowerCase();
  if(response.ok&&isNavo3DPath(url.pathname)&&type.includes('text/html')){
    return new HTMLRewriter().on('body',new Navo3DLeaseInjector()).transform(response);
  }
  return response;
}

function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function licenseRequiredResponse(url,feature,context){
  const en=url.pathname.startsWith('/en/');
  const app=feature==='navo3d'?'Navo3D':'Navo2D';
  const account=en?'/en/account/licenses/':'/account/licenses/';
  const pricing=en?'/en/pricing/':'/pricing/';
  const title=en?'License required':'Licence requise';
  const body=en
    ? `Your NavoFlo account is signed in, but no active license granting access to ${app} is currently assigned to you.`
    : `Votre compte NavoFlo est bien connecté, mais aucune licence active donnant accès à ${app} ne vous est actuellement attribuée.`;
  const detail=context?.subscription?.active
    ? (en?'Ask your administrator to transfer a floating User license to your account, or add another license.':'Demandez à votre administrateur de vous transférer une licence User flottante ou d’ajouter une licence supplémentaire.')
    : (en?'This organization does not currently have an active compatible subscription.':'Cette organisation ne possède actuellement aucun abonnement compatible actif.');
  const html=`<!doctype html><html lang="${en?'en':'fr-CA'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — NavoFlo</title><style>html,body{margin:0;min-height:100%;background:#081118;color:#eef6fa;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{min-height:100vh;display:grid;place-items:center;padding:24px;box-sizing:border-box}.card{width:min(560px,100%);background:#101b23;border:1px solid #2c4351;border-radius:18px;padding:28px;box-sizing:border-box;box-shadow:0 28px 90px rgba(0,0,0,.35)}.k{font-size:11px;letter-spacing:.16em;font-weight:800;color:#34d399;margin-bottom:14px}h1{font-size:30px;margin:0 0 12px}p{color:#adc0cc;line-height:1.6}.app{color:#fff;font-weight:750}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}.actions a{padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:750;border:1px solid #355061;color:#eaf4f8;background:#14242f}.actions a.primary{background:#35d19f;border-color:#35d19f;color:#05120e}</style></head><body><main class="card"><div class="k">NAVOFLO · ${escapeHtml(app)}</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><p>${escapeHtml(detail)}</p><div class="actions"><a class="primary" href="${account}">${en?'My licenses':'Mes licences'}</a><a href="${pricing}">${en?'View plans':'Voir les forfaits'}</a></div></main></body></html>`;
  return new Response(html,{status:403,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

function featureForPath(pathname){
  if(pathname==='/navo2d'||pathname.startsWith('/navo2d/'))return 'navo2d';
  if(pathname==='/navo3d'||pathname.startsWith('/navo3d/'))return 'navo3d';
  if(pathname==='/en/navo2d'||pathname.startsWith('/en/navo2d/'))return 'navo2d';
  if(pathname==='/en/navo3d'||pathname.startsWith('/en/navo3d/'))return 'navo3d';
  return null;
}

async function routeRequest(request,env,ctx){
  const url=new URL(request.url); const route=API[url.pathname];
  if(route){ const handler=route[request.method]; if(!handler)return methodNotAllowed(Object.keys(route)); return handler({request,env,ctx}); }

  const authSessionMatch=url.pathname.match(/^\/api\/auth\/sessions\/(\d+)\/revoke$/);
  if(authSessionMatch){
    if(request.method!=='POST')return methodNotAllowed(['POST']);
    return postRevokeAuthSession({request,env,ctx,sessionId:authSessionMatch[1]});
  }

  const deviceMatch=url.pathname.match(/^\/api\/licensing\/devices\/(\d+)\/disconnect$/);
  if(deviceMatch){
    if(request.method!=='POST')return methodNotAllowed(['POST']);
    return disconnectLicensingDevice({request,env,ctx,deviceId:deviceMatch[1]});
  }

  const memberMatch=url.pathname.match(/^\/api\/licensing\/members\/(\d+)(\/(license|invite|transfer))?$/);
  if(memberMatch){
    const userId=memberMatch[1], action=memberMatch[3]||'';
    if(action==='license'){ if(request.method!=='POST')return methodNotAllowed(['POST']); return updateLicensingMemberLicense({request,env,ctx,userId}); }
    if(action==='invite'){ if(request.method!=='POST')return methodNotAllowed(['POST']); return inviteLicensingMember({request,env,ctx,userId}); }
    if(action==='transfer'){ if(request.method!=='POST')return methodNotAllowed(['POST']); return transferLicensingMember({request,env,ctx,userId}); }
    if(request.method!=='DELETE')return methodNotAllowed(['DELETE']);
    return deleteLicensingMember({request,env,ctx,userId});
  }

  if(url.pathname.startsWith('/api/'))return json({error:'API route not found.'},404);

  if(String(env?.NAVOFLO_ENFORCE_LICENSES||'').toLowerCase()==='true'){
    const feature=featureForPath(url.pathname);
    if(feature){
      const user=await sessionUser(request,env,{touch:false});
      if(!user){
        const target=url.pathname.startsWith('/en/')?'/en/login/?next='+encodeURIComponent(url.pathname+url.search):'/login/?next='+encodeURIComponent(url.pathname+url.search);
        return Response.redirect(new URL(target,url.origin),302);
      }
      const context=await licensingContext(env,user.email,{includeMembers:false,touchLogin:true});
      const authorized=Boolean(user.status==='active'&&context?.user?.licensed&&context?.entitlements?.[feature]);
      if(!authorized)return licenseRequiredResponse(url,feature,context);
    }
  }
  return serveAssetWithLeaseGate(request,env,url);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    try{
      if(url.pathname.startsWith('/api/')){
        maybeScheduleSecurityMaintenance(env,ctx);
        if(url.pathname!=='/api/stripe/webhook'){
          assertTrustedMutation(request);
          if(apiBodyTooLarge(request))return hardenResponse(json({error:'API request body is too large.',code:'REQUEST_TOO_LARGE'},413),request);
        }
      }
      return hardenResponse(await routeRequest(request,env,ctx),request);
    }catch(error){
      if(error?.code==='UNTRUSTED_ORIGIN'||error?.code==='CROSS_SITE_BLOCKED'||error?.code==='RATE_LIMITED'){
        return hardenResponse(securityJsonError(error),request);
      }
      throw error;
    }
  },
  async scheduled(_controller,env,ctx){
    ctx.waitUntil(runSecurityMaintenance(env));
  }
};
