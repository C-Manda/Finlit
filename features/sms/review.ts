import type {BudgetData,Entry,MoneyLocation} from '../../content/budget-rules';
import {cents,localDate} from '../../content/budget-rules';
import type {ParsedSms,SmsImport} from './types';
export const providerName=(p:string)=>({mtn:'MTN MoMo',airtel:'Airtel Money',zamtel:'Zamtel Money'}[p]??p);
export function suggestedWallets(parsed:ParsedSms,locations:MoneyLocation[]) {
 return locations.filter(l=>l.active&&l.location_type==='mobile_money'&&new RegExp(parsed.provider,'i').test(l.provider));
}
export function possibleMatches(parsed:ParsedSms,wallet:string,entries:Entry[]) {
 return entries.filter(e=>!e.deleted_at&&cents(e.amount)===parsed.amountMinor&&e.occurred_on===localDate(new Date(parsed.occurredAt))&&(e.location_id===wallet||e.destination_location_id===wallet||!e.location_id));
}
export function latestObservation(imports:SmsImport[],location:string) {
 return imports.filter(i=>i.location_id===location&&i.balance_after!==null&&i.transaction_type!=='failed'&&i.status!=='ignored')
 .sort((a,b)=>Date.parse(b.transaction_occurred_at)-Date.parse(a.transaction_occurred_at)||Date.parse(b.sms_received_at)-Date.parse(a.sms_received_at))[0]??null;
}
// The ledger is day-granular; never claim a precise historical balance when intra-day
// order is unknown. Only compare a confirmed latest observation with the current total.
export function reconciliation(data:BudgetData,imports:SmsImport[],location:MoneyLocation){
 const observation=latestObservation(imports,location.id);if(!observation||observation.balance_after===null)return null;
 const time=Date.parse(observation.transaction_occurred_at), day=localDate(new Date(time));
 const unknownOrder=data.entries.some(e=>!e.deleted_at&&(e.location_id===location.id||e.destination_location_id===location.id)&&
  (e.occurred_at?Date.parse(e.occurred_at)>time:e.occurred_on>=day));
 const laterCorrection=(data.adjustments??[]).some(a=>a.location_id===location.id&&Date.parse(a.created_at)>time);
 return {observation,differenceMinor:cents(location.balance)-cents(observation.balance_after),comparable:!unknownOrder&&!laterCorrection&&day>=location.opening_date};
}
