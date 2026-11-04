import type { SmsMessage } from '../types';
import { amount, NUMBER, result } from './shared';
export function parseZamtel(m:SmsMessage){
 const b=m.body;
 if(!/\bZamtel\b/i.test(b+' '+m.sender)&&!/Dear .+you have received ZMW.+under Txn ID:.+Your account balance is now ZMW/is.test(b))return null;
 const ref=b.match(/Txn ID:\s*([A-Za-z0-9]+)/i)?.[1]??null;
 const balance=amount(b,`account balance is now ZMW\\s*(${NUMBER})`);
 if(/\bfailed\b|unsuccessful|declined/i.test(b))return result(m,'zamtel','failed',null,balance,ref);
 if(/you have received ZMW.+under Txn ID:/is.test(b))return result(m,'zamtel','received',amount(b,`received ZMW\\s*(${NUMBER})`),balance,ref);
 if(/transaction of ZMW.+for ZAMTEL USSD.+processed successfully/is.test(b))return result(m,'zamtel','unknown',amount(b,`transaction of ZMW\\s*(${NUMBER})`),balance,ref,amount(b,`Fee:\\s*ZMW\\s*(${NUMBER})`));
 return result(m,'zamtel','unknown',null,balance,ref);
}
