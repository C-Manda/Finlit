import type { SmsMessage } from './types';
export type SmsSettings = {enabled:boolean;baseline:string|null;lastScan:string|null;full:boolean;cache:string|null};
export type ScanResult = {visited:number;relevant:number;newlyQueued:number;previouslyHandled:number;unsupported:number;pending:number;before:number;beforeId:string;more:boolean;full:boolean};
export type SmsDiagnostics = {
 nativeAvailable:boolean; readSms:boolean; receiveSms:boolean; trackingEnabled:boolean;
 ownerInitialized:boolean; lastReceiverEvent:string|null; lastScan:string|null;
 messagesScanned:number; candidatesQueued:number; pendingQueue:number; lastError:string|null;
};
export interface SmsNative {
 setOwner(owner:string|null):Promise<void>;
 permissionStatus():Promise<{granted:boolean;canAskAgain:boolean;readSms:boolean;receiveSms:boolean}>;
 diagnostics(owner:string):Promise<SmsDiagnostics>;
 requestPermissions():Promise<{granted:boolean;canAskAgain:boolean}>;
 settings(owner:string):Promise<SmsSettings>;
 setEnabled(owner:string,enabled:boolean):Promise<void>;
 saveCache(owner:string,value:string):Promise<void>;
 candidates(owner:string):Promise<(SmsMessage & {payload:string|null})[]>;
 saveCandidate(owner:string,id:string,value:string):Promise<void>;
 acknowledge(owner:string,id:string):Promise<void>;
 clearCandidates(owner:string):Promise<void>;
 scan(owner:string,since:number,before:number,beforeId:string|null):Promise<ScanResult>;
 addListener(name:'onCandidate',listener:()=>void):{remove:()=>void};
}
