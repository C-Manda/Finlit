// Manual web import only. Android computes SHA-256 before persisting a candidate.
export async function manualFingerprint(sender:string,body:string,receivedAt:string){
 if(typeof globalThis.crypto?.subtle==='undefined')throw new Error('Manual import requires a browser with secure cryptography, or the Android build.');
 const value=sender.trim().toLowerCase()+'|'+body.trim().replace(/\s+/g,' ')+'|'+receivedAt;
 const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
}
