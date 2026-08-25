import { json } from '../lib/stripe.js';
import {
  acquireAppLease,
  addMember,
  createLicensingPortal,
  licensingJsonError,
  purchaseSeatForMember,
  refreshAppLease,
  releaseAppLease,
  removeMember,
  requireLicensingContext,
  resendMemberInvitation,
  setMemberLicense,
  transferMemberLicense,
  userDevices,
  disconnectUserDevice
} from '../lib/licensing.js';

async function run(fn){ try{return await fn();}catch(error){return licensingJsonError(error);} }
export async function getLicensingMe({request,env}){ return run(async()=>json(await requireLicensingContext(request,env))); }
export async function createLicensingMember({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env);return json(await addMember(request,env,c,await request.json()));}); }
export async function fastTrackLicensingSeat({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env);return json(await purchaseSeatForMember(request,env,c,await request.json()));}); }
export async function updateLicensingMemberLicense({request,env,userId}){ return run(async()=>{const c=await requireLicensingContext(request,env);const b=await request.json();return json(await setMemberLicense(env,c,userId,Boolean(b.active)));}); }
export async function deleteLicensingMember({request,env,userId}){ return run(async()=>{const c=await requireLicensingContext(request,env);return json(await removeMember(env,c,userId));}); }
export async function inviteLicensingMember({request,env,userId}){ return run(async()=>{const c=await requireLicensingContext(request,env);return json(await resendMemberInvitation(request,env,c,userId));}); }
export async function transferLicensingMember({request,env,userId}){ return run(async()=>{const c=await requireLicensingContext(request,env);const b=await request.json();return json(await transferMemberLicense(env,c,userId,b.target_user_id));}); }
export async function createAccountPortal({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});return json({url:await createLicensingPortal(request,env,c)});}); }
export async function acquireLease({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});return json(await acquireAppLease(request,env,c,await request.json()));}); }
export async function refreshLease({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});return json(await refreshAppLease(request,env,c,await request.json()));}); }
export async function releaseLease({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});return json(await releaseAppLease(env,c,await request.json()));}); }

export async function getLicensingDevices({request,env}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});const current=new URL(request.url).searchParams.get('current_device_id')||'';return json(await userDevices(env,c,current),200,{'cache-control':'no-store'});}); }
export async function disconnectLicensingDevice({request,env,deviceId}){ return run(async()=>{const c=await requireLicensingContext(request,env,{includeMembers:false});return json(await disconnectUserDevice(env,c,deviceId),200,{'cache-control':'no-store'});}); }
