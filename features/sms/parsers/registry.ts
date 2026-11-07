import type { SmsMessage, ParsedSms } from '../types';
import {parseMtn} from './mtn';
import {parseAirtel} from './airtel';
import {parseZamtel} from './zamtel';
import { result } from './shared';
export function parseSms(message:SmsMessage):ParsedSms|null {
 if(message.body.length>4096||!Number.isFinite(Date.parse(message.receivedAt))||/\bOTP\b|one[- ]time|verification code|\bPIN\b|win a prize|promotion|special offer/i.test(message.body))return null;
 const matches=[parseMtn,parseAirtel,parseZamtel].map(p=>p(message)).filter((p):p is ParsedSms=>p!==null);
 const senderProvider=/mtn|yello/i.test(message.sender)?'mtn':/airtel/i.test(message.sender)?'airtel':/zamtel/i.test(message.sender)?'zamtel':null;
 if(matches.length>1&&senderProvider){
  const preferred=matches.filter(p=>p.provider===senderProvider);
  if(preferred.length===1)return preferred[0];
 }
 // Conflicting brands/structures are not a verified format.
 if(matches.length!==1){
   const provider=/airtel/i.test(message.sender+' '+message.body)?'airtel':/zamtel/i.test(message.sender+' '+message.body)?'zamtel':/mtn|yello|financial transaction/i.test(message.sender+' '+message.body)?'mtn':'unknown';
   if(!/\bZMW\b|\bK\s*[0-9.]/i.test(message.body)||!/received|sent|withdrawn|payment|transaction|balance|bal is|bundle|data|airtime|purchased|subscription|top[- ]?up|loan/i.test(message.body))return null;
  return result(message,provider,'unknown',null,null,null);
 }
 return matches[0];
}
