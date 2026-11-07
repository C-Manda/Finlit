import type { SmsMessage } from '../types';
import { amount, NUMBER, result } from './shared';
export function parseMtn(m:SmsMessage){
 const b=m.body;
 if(!/\bMTN\b|\bYello\b|Financial Transaction Id:/i.test(b))return null;
 const ref=b.match(/Financial Transaction Id:\s*([A-Za-z0-9.-]+)/i)?.[1].replace(/\.$/,'')??null;
 const balance=amount(b,`(?:account balance is ZMW|new balance:)\\s*(${NUMBER})`);
 if(/\bfailed\b|unsuccessful|declined/i.test(b))return result(m,'mtn','failed',null,balance,ref);
 if(/Your Mobile Money account balance is ZMW|balance notification|account balance is/i.test(b))return result(m,'mtn','balance_check',null,balance,null);
 if(/You have received ZMW.+on your mobile money account at/i.test(b))return result(m,'mtn','received',amount(b,`received ZMW\\s*(${NUMBER})`),balance,ref);
 if(/You have withdrawn.+ZMW from your mobile money account/i.test(b))return result(m,'mtn','withdrawal',amount(b,`withdrawn\\s*(${NUMBER})\\s*ZMW`),balance,ref);
 return result(m,'mtn','unknown',null,balance,ref);
}
