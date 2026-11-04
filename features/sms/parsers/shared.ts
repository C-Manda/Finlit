import type { ParsedSms, Provider, SmsKind, SmsMessage } from '../types';
export const NUMBER = '(?:[0-9][0-9,]*(?:\\.[0-9]+)?|\\.[0-9]+)';
export function minorUnits(raw:string):number|null {
 if(!/^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?|\.\d{1,2})$/.test(raw))return null;
 const [whole,fraction='']=raw.replace(/,/g,'').split('.');
 const value=Number(whole||0)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(value)&&value<=99999999999?value:null;
}
export function amount(body:string,pattern:string):number|null {
 const match=body.match(new RegExp(pattern,'i'));return match?minorUnits(match[1]):null;
}
export function timestamp(body:string):string|null {
 const iso=body.match(/\b(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})\b/);
 const local=body.match(/\b(\d{2})-(\d{2})-(\d{4})(?:\s+at)?\s+(\d{2}):(\d{2}):(\d{2})\b/);
 const m=iso??local;if(!m)return null;
 const parts=iso?[m[1],m[2],m[3],m[4],m[5],m[6]]:[m[3],m[2],m[1],m[4],m[5],m[6]];
 const wall=parts.slice(0,3).join('-')+'T'+parts.slice(3).join(':');
 const d=new Date(wall+'+02:00');
 if(!Number.isFinite(d.getTime())||new Date(d.getTime()+7200000).toISOString().slice(0,19)!==wall)return null;
 return d.toISOString();
}
export function result(message:SmsMessage,provider:Provider,kind:SmsKind,amountMinor:number|null,balanceMinor:number|null,reference:string|null,feeMinor:number|null=null):ParsedSms {
 const reported=timestamp(message.body), warnings:string[]=[];
 if(!new RegExp(provider,'i').test(message.sender))warnings.push('Sender is not a recognised provider label. Verify this message independently.');
 if(feeMinor===null)warnings.push('Fee was not stated. Confirm the actual fee, including zero, before posting.');
 if(!reference)warnings.push('No provider reference. Check existing records carefully.');
 if(!reported)warnings.push('Using SMS receipt time; a delayed message may need a corrected transaction time.');
 if(kind==='unknown')warnings.push('Purpose is not known. Choose the accounting treatment yourself.');
 if(amountMinor===null&&kind!=='balance_check'&&kind!=='failed')warnings.push('No reliable transaction amount; do not post this message.');
 return {provider,kind,amountMinor,feeMinor,balanceMinor,reference,occurredAt:reported??message.receivedAt,receivedAt:message.receivedAt,timestampSource:reported?'provider':'receipt',parserVersion:'finlit-sms-1',status:kind==='failed'?'failed':kind==='balance_check'?'balance_only':'requires_review',warnings};
}
