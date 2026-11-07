import type { SmsMessage } from '../types';
import { amount, NUMBER, result } from './shared';
export function parseAirtel(m:SmsMessage){
 const b=m.body;
 if(!/\bAirtel\b/i.test(b+' '+m.sender)&&!/(?:TID|Txn\.?\s*ID)\s*:\s*(?:MP|CO|PP)/i.test(b))return null;
 const ref=b.match(/(?:TID|Txn\.?\s*ID)\s*:\s*((?:MP|CO|PP)[A-Z0-9]+(?:\.[A-Z0-9]+){1,2})/i)?.[1]??null;
 const balance=amount(b,`(?:available balance|Your bal is|Bal is|Airtel Money bal is)\\s*(?:is\\s*)?(?:K|ZMW)\\s*(${NUMBER})`);
 if(/\bfailed\b|unsuccessful|declined/i.test(b))return result(m,'airtel','failed',null,balance,ref);
 if(/(?:You have sent Money to|Money sent to)/i.test(b))return result(m,'airtel','sent',amount(b,`Amount\\s*(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
 if(/Payment of ZMW.+Till Number BUYAIRTEL ZESCO ZESCO/i.test(b))return result(m,'airtel','bill_payment',amount(b,`Payment of\\s*(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
 if(/Payment of\s*(?:K|ZMW)/i.test(b))return result(m,'airtel','merchant_payment',amount(b,`Payment of\\s*(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
 if(/(?:You have withdrawn|withdrawal).*?(?:K|ZMW)/i.test(b))return result(m,'airtel','withdrawal',amount(b,`(?:withdrawn|withdrawal).*?(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
 if(/(?:received|credited).*?(?:K|ZMW)/i.test(b))return result(m,'airtel','received',amount(b,`(?:received|credited).*?(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
 return result(m,'airtel','unknown',amount(b,`Amount\\s*(?:K|ZMW)\\s*(${NUMBER})`),balance,ref);
}
