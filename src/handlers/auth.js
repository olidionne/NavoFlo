import {
  acceptInvitation,
  accountActivationInfo,
  accountSessions,
  activateAccount,
  authJsonError,
  authStatus,
  invitationInfo,
  login,
  logout,
  passwordResetInfo,
  requestAccountActivation,
  requestPasswordReset,
  resetPassword,
  revokeAccountSession,
  revokeOtherAccountSessions
} from '../lib/auth.js';

async function safe(fn) {
  try { return await fn(); }
  catch (error) { return authJsonError(error); }
}

export async function getAuthStatus({ request, env }) { return safe(() => authStatus(request, env)); }
export async function postLogin({ request, env }) { return safe(() => login(request, env)); }
export async function postLogout({ request, env }) { return safe(() => logout(request, env)); }
export async function postForgotPassword({ request, env }) { return safe(() => requestPasswordReset(request, env)); }
export async function getPasswordReset({ request, env }) { return safe(() => passwordResetInfo(request, env)); }
export async function postResetPassword({ request, env }) { return safe(() => resetPassword(request, env)); }
export async function getAccountActivation({ request, env }) { return safe(() => accountActivationInfo(request, env)); }
export async function postAccountActivation({ request, env }) { return safe(() => activateAccount(request, env)); }
export async function postResendAccountActivation({ request, env }) { return safe(() => requestAccountActivation(request, env)); }
export async function getInvitation({ request, env }) { return safe(() => invitationInfo(request, env)); }
export async function postAcceptInvitation({ request, env }) { return safe(() => acceptInvitation(request, env)); }

export async function getAuthSessions({ request, env }) { return safe(() => accountSessions(request, env)); }
export async function postRevokeAuthSession({ request, env, sessionId }) { return safe(() => revokeAccountSession(request, env, sessionId)); }
export async function postRevokeOtherAuthSessions({ request, env }) { return safe(() => revokeOtherAccountSessions(request, env)); }
