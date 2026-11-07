import {learningApi} from '../../services/learning';
import {smsNative} from './native';
import {parseSms} from './parsers/registry';
import type {LocalCandidate,SmsImport} from './types';
let activeOwner:string|null=null;
let task:Promise<void>|null=null;
export async function setSmsOwner(owner:string|null){activeOwner=owner;await smsNative?.setOwner(owner);}
export async function localCandidates(owner:string):Promise<LocalCandidate[]> {
 if(!smsNative)return [];
 const rows=await smsNative.candidates(owner),items:LocalCandidate[]=[];
 for(const row of rows){
  if(activeOwner!==owner)return [];
  if(row.payload){try {items.push(JSON.parse(row.payload) as LocalCandidate);continue;}catch{/* Reparse damaged review metadata from the retained SMS. */}}
  const parsed=parseSms(row);
  if(!parsed)continue;
  const message={id:row.id,sender:row.sender,body:row.body,receivedAt:row.receivedAt,subscriptionId:row.subscriptionId,fingerprint:row.fingerprint}; // Raw text remains in Android's app-private database.
  const candidate={message,parsed};await smsNative.saveCandidate(owner,row.id,JSON.stringify(candidate));items.push(candidate);
 }
 return items;
}
export async function submitCandidate(candidate:LocalCandidate,approval:Record<string,unknown>):Promise<SmsImport>{
 const p=candidate.parsed;
 const staged=await learningApi<SmsImport>('sms_stage',{
  wallet:approval.wallet,walletConfirmed:true,baseline:approval.baseline,provider:p.provider,kind:p.kind,
  amountMinor:p.amountMinor,feeMinor:p.feeMinor,balanceMinor:p.balanceMinor,reference:p.reference,
  fingerprint:candidate.message.fingerprint,occurredAt:p.occurredAt,receivedAt:p.receivedAt,timestampSource:p.timestampSource,parserVersion:p.parserVersion,
 });
 return staged.status==='requires_review'?learningApi<SmsImport>('sms_resolve',{...approval,id:staged.id}):staged;
}
export async function approveCandidate(owner:string,candidate:LocalCandidate,approval:Record<string,unknown>){
 if(!smsNative){await submitCandidate(candidate,approval);return;}
 if(activeOwner!==owner)throw new Error('Account changed. Reopen SMS tracking.');
 await smsNative.saveCandidate(owner,candidate.message.id,JSON.stringify({...candidate,approval,error:undefined}));
 await syncApproved(owner);
}
export async function syncApproved(owner:string):Promise<void>{
 if(!smsNative||activeOwner!==owner)return;
 const previous=task;
 const work=async()=>{
  if(activeOwner!==owner)return;
  const settings=await smsNative!.settings(owner),permissions=await smsNative!.permissionStatus();
  if(!settings.enabled||!permissions.granted)return;
  const candidates=await localCandidates(owner);
  for(const item of candidates){
   if(activeOwner!==owner)return;
   if(!item.approval)continue;
   if(!(await smsNative!.settings(owner)).enabled||!(await smsNative!.permissionStatus()).granted||activeOwner!==owner)return;
   try{
    await submitCandidate(item,item.approval);
    if(activeOwner!==owner)return;
    await smsNative!.acknowledge(owner,item.message.id);
   }catch(error){
    if(activeOwner!==owner)return;
    await smsNative!.saveCandidate(owner,item.message.id,JSON.stringify({...item,error:error instanceof Error?error.message:'Sync failed; retry when connected.'}));
    // No polling or receiver networking. Retry on foreground, online event or user action.
    break;
   }
  }
 };
 const next=(previous??Promise.resolve()).catch(()=>undefined).then(work);
 task=next;try{await next;}finally{if(task===next)task=null;}
}
