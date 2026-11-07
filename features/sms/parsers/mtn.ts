import type { SmsMessage } from '../types';
import { amount, NUMBER, result } from './shared';
export function parseMtn(m:SmsMessage){
 const b=m.body;
 if(!/\bMTN\b|\bYello\b|Financial Transaction Id:/i.test(b+' '+m.sender))return null;
 const ref=b.match(/(?:Financial Transaction Id|Txn\.?\s*Id):\s*([A-Za-z0-9.-]+)/i)?.[1].replace(/\.$/,'')??null;
 const balance=amount(b,`(?:account balance is|new balance:?|balance is)\\s*(?:ZMW\\s*)?(${NUMBER})\\s*(?:ZMW)?`);
 if(/\bfailed\b|unsuccessful|declined/i.test(b))return result(m,'mtn','failed',null,balance,ref);
 if(/NaSova loan|loan.*credited|credited with.*loan/i.test(b))return result(m,'mtn','loan',amount(b,`(?:loan|credited with).*?(?:ZMW|K)\\s*(${NUMBER})`),balance,ref);
 if(/Your Mobile Money account balance is ZMW|balance notification|account balance is/i.test(b))return result(m,'mtn','balance_check',null,balance,null);
 if(/Payment of\s*ZMW/i.test(b)&&/data bundle|successfully purchased|\bdata\b/i.test(b))return result(m,'mtn','data_purchase',amount(b,`Payment of\\s*ZMW\\s*(${NUMBER})`),balance,ref);
 if(/Payment of\s*ZMW/i.test(b)&&/airtime|top[- ]?up/i.test(b))return result(m,'mtn','airtime_purchase',amount(b,`Payment of\\s*ZMW\\s*(${NUMBER})`),balance,ref);
 if(/received.*?(?:Airtel NFS|AIRTEL NFS)/i.test(b))return result(m,'mtn','bank_transfer',amount(b,`received.*?ZMW\\s*(${NUMBER})`),balance,ref,null,'in');
 if(/Payment.*?AIRTEL NFS/i.test(b))return result(m,'mtn','bank_transfer',amount(b,`Payment.*?ZMW\\s*(${NUMBER})`),balance,ref,null,'out');
 if(/You have received ZMW.+on your mobile money account at/i.test(b))return result(m,'mtn','received',amount(b,`received ZMW\\s*(${NUMBER})`),balance,ref,null,'in');
 if(/You have withdrawn.+(?:ZMW|from your mobile money account)/i.test(b))return result(m,'mtn','withdrawal',amount(b,`withdrawn\\s*(?:ZMW\\s*)?(${NUMBER})\\s*(?:ZMW)?`),balance,ref,null,'out');
 if(!/received|withdrawn|payment|balance|transaction|loan|airtime|data|bundle|purchase|sent/i.test(b))return null;
 return result(m,'mtn','unknown',null,balance,ref);
}
