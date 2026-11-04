import type { SmsMessage, ParsedSms } from '../types';
import {parseMtn} from './mtn';
import {parseAirtel} from './airtel';
import {parseZamtel} from './zamtel';
export function parseSms(message:SmsMessage):ParsedSms|null {
 if(message.body.length>4096||!Number.isFinite(Date.parse(message.receivedAt))||/\bOTP\b|one[- ]time|verification code|\bPIN\b|win a prize|promotion|special offer/i.test(message.body))return null;
 const matches=[parseMtn,parseAirtel,parseZamtel].map(p=>p(message)).filter((p):p is ParsedSms=>p!==null);
 // Conflicting brands/structures are not a verified format.
 if(matches.length!==1)return null;
 return matches[0];
}
