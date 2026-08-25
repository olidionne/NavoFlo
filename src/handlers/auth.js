import {
  acceptInvitation,
  authJsonError,
  authStatus,
  bootstrapAccount,
  invitationInfo,
  login,
  logout
} from '../lib/auth.js';

async function safe(fn) {
  try { return await fn(); }
  catch (error) { return authJsonError(error); }
}

export async function getAuthStatus({ request, env }) { return safe(() => authStatus(request, env)); }
export async function postLogin({ request, env }) { return safe(() => login(request, env)); }
export async function postLogout({ request, env }) { return safe(() => logout(request, env)); }
export async function postBootstrap({ request, env }) { return safe(() => bootstrapAccount(request, env)); }
export async function getInvitation({ request, env }) { return safe(() => invitationInfo(request, env)); }
export async function postAcceptInvitation({ request, env }) { return safe(() => acceptInvitation(request, env)); }
