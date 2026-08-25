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
  inviteLicensingMember,
  refreshLease,
  releaseLease,
  transferLicensingMember,
  updateLicensingMemberLicense
} from './handlers/licensing.js';
import {
  getAuthStatus,
  getInvitation,
  postAcceptInvitation,
  postBootstrap,
  postLogin,
  postLogout
} from './handlers/auth.js';
import { featureAuthorized } from './lib/licensing.js';

const API = Object.freeze({
  '/api/stripe/create-checkout': { POST:createCheckout },
  '/api/stripe/session': { GET:getSession },
  '/api/stripe/portal': { POST:createPortal },
  '/api/stripe/webhook': { POST:handleWebhook },
  '/api/auth/me': { GET:getAuthStatus },
  '/api/auth/login': { POST:postLogin },
  '/api/auth/logout': { POST:postLogout },
  '/api/auth/bootstrap': { POST:postBootstrap },
  '/api/auth/invitation': { GET:getInvitation },
  '/api/auth/accept-invitation': { POST:postAcceptInvitation },
  '/api/licensing/me': { GET:getLicensingMe },
  '/api/licensing/members': { POST:createLicensingMember },
  '/api/licensing/fast-track-seat': { POST:fastTrackLicensingSeat },
  '/api/licensing/portal': { POST:createAccountPortal },
  '/api/licensing/lease/acquire': { POST:acquireLease },
  '/api/licensing/lease/refresh': { POST:refreshLease },
  '/api/licensing/lease/release': { POST:releaseLease }
});

function methodNotAllowed(allowed){ return json({error:'Method not allowed.'},405,{Allow:allowed.join(', ')}); }
function featureForPath(pathname){
  if(pathname==='/navo2d'||pathname.startsWith('/navo2d/'))return 'navo2d';
  if(pathname==='/navo3d'||pathname.startsWith('/navo3d/'))return 'navo3d';
  if(pathname==='/en/navo2d'||pathname.startsWith('/en/navo2d/'))return 'navo2d';
  if(pathname==='/en/navo3d'||pathname.startsWith('/en/navo3d/'))return 'navo3d';
  return null;
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url); const route=API[url.pathname];
    if(route){ const handler=route[request.method]; if(!handler)return methodNotAllowed(Object.keys(route)); return handler({request,env,ctx}); }

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
      if(feature&&!(await featureAuthorized(request,env,feature))){
        const target=url.pathname.startsWith('/en/')?'/en/login/?next='+encodeURIComponent(url.pathname):'/login/?next='+encodeURIComponent(url.pathname);
        return Response.redirect(new URL(target,url.origin),302);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
