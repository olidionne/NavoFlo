import { authJsonError } from '../lib/auth.js';
import { getUserPreferences, putUserPreferences } from '../lib/preferences.js';

async function safe(fn) {
  try { return await fn(); }
  catch (error) { return authJsonError(error); }
}

export async function getPreferences({ request, env }) { return safe(() => getUserPreferences(request, env)); }
export async function putPreferences({ request, env }) { return safe(() => putUserPreferences(request, env)); }
