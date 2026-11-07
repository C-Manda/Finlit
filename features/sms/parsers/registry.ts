import type { SmsMessage, ParsedSms } from '../types';
import {parseMtn} from './mtn';
import {parseAirtel} from './airtel';
import {parseZamtel} from './zamtel';
import { result } from './shared';
export function parseSms(message:SmsMessage):ParsedSms|null {
 if(message.body.length>4096||!Number.isFinite(Date.parse(message.receivedAt))||/\bOTP\b|one[- ]time|verification code|\bPIN\b|win a prize|promotion|special offer/i.test(message.body))return null;
 const matches=[parseMtn,parseAirtel,parseZamtel].map(p=>p(message)).filter((p):p is ParsedSms=>p!==null);
 // Conflicting brands/structures are not a verified format.
 if(matches.length!==1){
  const provider=/airtel/i.test(message.sender+' '+message.body)?'airtel':/zamtel/i.test(message.sender+' '+message.body)?'zamtel':/mtn|yello|financial transaction/i.test(message.sender+' '+message.body)?'mtn':null;
  if(!provider||!/\bZMW\b|\bK[0-9]/i.test(message.body)||!/received|sent|withdrawn|payment|transaction|balance|bal is/i.test(message.body))return null;
  return result(message,provider,'unknown',null,null,null);
 }
 return matches[0];
}
