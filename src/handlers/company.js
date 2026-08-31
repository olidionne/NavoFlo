import {
  companyJsonError,
  getCapabilities, putCapabilities,
  getBendParams, putBendParam, deleteBendParam,
  getTooling, putTooling, deleteTooling,
  getCompanySettings
} from '../lib/company.js';

const run = async (fn) => { try { return await fn(); } catch (e) { return companyJsonError(e); } };

export const getCompanyCapabilities  = ({ request, env }) => run(() => getCapabilities(request, env));
export const putCompanyCapabilities  = ({ request, env }) => run(() => putCapabilities(request, env));
export const getCompanyBendParams    = ({ request, env }) => run(() => getBendParams(request, env));
export const putCompanyBendParam     = ({ request, env }) => run(() => putBendParam(request, env));
export const deleteCompanyBendParam  = ({ request, env, paramId }) => run(() => deleteBendParam(request, env, paramId));
export const getCompanyTooling       = ({ request, env }) => run(() => getTooling(request, env));
export const putCompanyTooling       = ({ request, env }) => run(() => putTooling(request, env));
export const deleteCompanyTooling    = ({ request, env, toolId }) => run(() => deleteTooling(request, env, toolId));
export const getCompanySettingsAll   = ({ request, env }) => run(() => getCompanySettings(request, env));
