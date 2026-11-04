import type { SmsMessage } from '../types';
import { amount, NUMBER, result } from './shared';
export function parseAirtel(m:SmsMessage){
 const b=m.body;
 if(!/\bAirtel\b/i.test(b+' '+m.sender)&&!/(?:TID|Txn\. ID)\s*:\s*(?:MP|CO)\d{6}\./i.test(b))return null;
 const ref=b.match(/(?:TID|Txn\.\s*ID)\s*:\s*((?:MP|CO)\d{6}\.\d{4}\.[A-Z0-9]+)/i)?.[1].replace(/\.$/,'')??null;
 const balance=amount(b,`(?:available balance is|Your bal is|bal is)\\s*(?:K|ZMW)\\s*(${NUMBER})`);
 if(/\bfailed\b|unsuccessful|declined/i.test(b))return result(m,'airtel','failed',null,balance,ref);
 if(/(?:You have sent Money to|Money sent to).+Amount\s*K/i.test(b))return result(m,'airtel','sent',amount(b,`Amount\\s*K\\s*(${NUMBER})`),balance,ref);
 if(/Payment of ZMW.+Till Number BUYAIRTEL ZESCO ZESCO/i.test(b))return result(m,'airtel','bill_payment',amount(b,`Payment of ZMW\\s*(${NUMBER})`),balance,ref);
 if(/You have withdrawn ZMW.+from/i.test(b))return result(m,'airtel','withdrawal',amount(b,`withdrawn ZMW\\s*(${NUMBER})`),balance,ref);
 return result(m,'airtel','unknown',null,balance,ref);
}
