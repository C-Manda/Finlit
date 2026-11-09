import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Linking,Platform,Pressable,Text,View} from 'react-native';
import {useFocusEffect,useRouter} from 'expo-router';
import {useAuth} from '@/contexts/auth-context';
import {usePalette} from '@/constants/finlit-theme';
import {type BudgetData,currency,localDate} from '@/content/budget-rules';
import {learningApi} from '@/services/learning';
import {smsNative} from '@/features/sms/native';
import type {SmsSettings,ScanResult,SmsDiagnostics} from '@/features/sms/native.types';
import type {LocalCandidate,SmsDirection,SmsImport} from '@/features/sms/types';
import {parseSms} from '@/features/sms/parsers/registry';
import {minorUnits} from '@/features/sms/parsers/shared';
import {manualFingerprint} from '@/features/sms/fingerprint';
import {approveCandidate,localCandidates,setSmsOwner,syncApproved} from '@/features/sms/import-service';
import {possibleMatches,providerName,reconciliation,suggestedWallets} from '@/features/sms/review';
import {Screen,Header,Field} from './finlit-ui';
import {LearningButton} from './lesson-player';
import {useLearningStyles} from './learning-screens';
import {LocationPicker,locationName} from './money-locations';

const initialSettings:SmsSettings={enabled:false,baseline:null,lastScan:null,full:false,cache:null};
const initialDiagnostics:SmsDiagnostics={nativeAvailable:false,readSms:false,receiveSms:false,trackingEnabled:false,ownerInitialized:false,lastReceiverEvent:null,lastScan:null,messagesScanned:0,candidatesQueued:0,pendingQueue:0,lastError:null};
const dateTime=(s:string)=>new Date(s).toLocaleString('en-ZM',{timeZone:'Africa/Lusaka',hour12:false});
const amount=(n:number|null)=>n===null?'Not stated':currency(n/100);
function Check({label,value,onChange,disabled}:{label:string;value:boolean;onChange:(v:boolean)=>void;disabled:boolean}){
 const s=useLearningStyles();return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} aria-checked={value} accessibilityState={{checked:value,disabled}} disabled={disabled} onPress={()=>onChange(!value)} style={{minHeight:44,justifyContent:'center'}}><Text style={s.body}>{value?'☑':'☐'} {label}</Text></Pressable>;
}
export function SmsTrackingScreen(){const {user}=useAuth();return user?<SmsBody key={user.id} owner={user.id}/>:null;}
function SmsBody({owner}:{owner:string}){
 const s=useLearningStyles(),router=useRouter();
 const [settings,setSettings]=useState(initialSettings),[permission,setPermission]=useState(false),[diagnostics,setDiagnostics]=useState(initialDiagnostics),[data,setData]=useState<BudgetData|null>(null),[imports,setImports]=useState<SmsImport[]>([]);
 const [candidates,setCandidates]=useState<LocalCandidate[]>([]),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [days,setDays]=useState('7'),[cursor,setCursor]=useState<ScanResult|null>(null),[clear,setClear]=useState(false),[confirmEnable,setConfirmEnable]=useState(false),[showOlder,setShowOlder]=useState(false);
 const [manualBaseline,setManualBaseline]=useState(new Date().toISOString());
 const [manual,setManual]=useState(false),[body,setBody]=useState(''),[sender,setSender]=useState(''),[received,setReceived]=useState(new Date().toISOString());
 const alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const refresh=useCallback(async()=>{
  if(smsNative){await setSmsOwner(owner);const config=await smsNative.settings(owner),perm=await smsNative.permissionStatus();const diag=await smsNative.diagnostics(owner);if(!alive.current)return;setSettings(config);setPermission(perm.granted);setDiagnostics(diag);
   if(config.cache){try{const cached=JSON.parse(config.cache);setData(cached.data);setImports(cached.imports??[]);}catch{/* Fetch a fresh snapshot below. */}}
   if(config.enabled&&perm.granted){await syncApproved(owner);const rows=await localCandidates(owner);if(alive.current)setCandidates(rows);}
  }
  try{const [budget,history]=await Promise.all([learningApi<BudgetData>('budget'),learningApi<SmsImport[]>('sms_list')]);
   if(!alive.current)return;setData(budget);setImports(history);setError('');
   await smsNative?.saveCache(owner,JSON.stringify({data:budget,imports:history}));
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Could not refresh account data. Cached data may be out of date.');}
 },[owner]);
 useFocusEffect(useCallback(()=>{void refresh().catch(e=>{if(alive.current)setError(String(e.message??e));});},[refresh]));
 useEffect(()=>{const receive=()=>void refresh().catch(()=>undefined);const sub=smsNative?.addListener('onCandidate',receive);const foreground=AppState.addEventListener('change',state=>{if(state==='active')receive();});return()=>{sub?.remove();foreground.remove();};},[refresh]);
 async function run(work:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await work();}catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const current=candidates.find(c=>c.message.id===selected);
 const cutoff=Date.now()-Number(days)*86400000;
 const recentCandidates=useMemo(()=>candidates.filter(c=>Date.parse(c.message.receivedAt)>=cutoff),[candidates,cutoff]);
 const olderCount=candidates.length-recentCandidates.length;
 async function scan(more=false){
  if(!smsNative)return;
  const n=Number(days);if(!Number.isInteger(n)||n<1||n>90)throw new Error('Choose 1–90 recent days.');
  const scanSince=Date.now()-n*86400000;
  const result=await smsNative.scan(owner,scanSince,more&&cursor?cursor.before:Date.now()+1000,more&&cursor?cursor.beforeId:null);
  await refresh();
  const unsupported=(await localCandidates(owner)).filter(c=>c.parsed.kind==='unknown'&&Date.parse(c.message.receivedAt)>=scanSince).length;
  if(alive.current){setCursor(result);setNotice(`Checked ${result.visited} messages; ${result.relevant} relevant; ${result.newlyQueued} newly queued; ${result.previouslyHandled} previously handled; ${unsupported} unsupported awaiting review; ${result.pending} pending. ${result.more?'More messages are available.':''}`);}
 }
 async function parseManual(){
  const fingerprint=await manualFingerprint(sender,body,received),message={id:fingerprint,fingerprint,sender,body,receivedAt:received,subscriptionId:null};
  const parsed=parseSms(message);if(!parsed)throw new Error('No supported Mobile Money format found. OTPs and unrelated messages are excluded.');
  setCandidates(items=>items.some(c=>c.message.id===fingerprint)?items:[...items,{message,parsed}]);setManual(false);setBody('');setSelected(fingerprint);
 }
 async function confirm(candidate:LocalCandidate,approval:Record<string,unknown>){
  await approveCandidate(owner,candidate,approval);
  if(!alive.current)return;
  if(smsNative){const pending=await localCandidates(owner);setCandidates(pending);const remaining=pending.find(c=>c.message.id===candidate.message.id);setNotice(remaining?'Confirmation saved on this device. Import is pending; review any error and retry when connected.':'Database confirmed the review outcome.');}
  else {setCandidates(items=>items.filter(c=>c.message.id!==candidate.message.id));setNotice('Database confirmed the review outcome.');}
  setSelected(null);await refresh();
 }
 return <Screen><Header title="Mobile Money SMS" back/><View style={s.stack}>
  <Text style={s.body}>Review MTN MoMo, Airtel Money and Zamtel messages before they affect your money. SMS text is not independent proof of a transaction.</Text>
  {smsNative?<View style={s.card}>
   <Text style={s.heading}>Tracking: {settings.enabled?(permission?'On':'Paused · permission missing'):'Off'}</Text>
   <Text style={s.note}>Android SMS permission: {permission?'Granted':'Not granted'}. Disabling tracking does not revoke Android permissions or erase financial entries.</Text>
   {settings.enabled?<LearningButton title="Disable SMS tracking" secondary disabled={busy} onPress={()=>void run(async()=>{await smsNative!.setEnabled(owner,false);setCandidates([]);setSelected(null);await refresh();})}/>:<LearningButton title="Enable SMS tracking" disabled={busy} onPress={()=>setConfirmEnable(true)}/>}
   {confirmEnable&&!settings.enabled&&<View style={s.stack}>
    <Text style={s.body}>FinLit will read relevant financial SMS on this device and queue new messages locally. Nothing is posted without confirmation. Check your wallets’ current balances first. Tracking starts now; earlier activity is history-only, because it may already be included in those balances.</Text>
    <LearningButton title="Check Money Locations" secondary onPress={()=>router.push('/budget')}/>
    <LearningButton title="Grant permission and start tracking" disabled={busy} onPress={()=>void run(async()=>{const result=await smsNative!.requestPermissions();setPermission(result.granted);if(!result.granted)throw new Error('SMS access was not granted. You can continue using manual Budget entries.');await smsNative!.setEnabled(owner,true);setConfirmEnable(false);await refresh();await scan();})}/>
    <LearningButton title="Cancel setup" secondary onPress={()=>setConfirmEnable(false)}/>
   </View>}
   <LearningButton title="Android permission settings" secondary disabled={busy} onPress={()=>void Linking.openSettings()}/>
   <Text style={s.note}>Tracking baseline: {settings.baseline?dateTime(settings.baseline):'Not set'} · Last scan: {settings.lastScan?dateTime(settings.lastScan):'Never'}</Text>
   <Text style={s.note}>Diagnostics: native {diagnostics.nativeAvailable?'available':'unavailable'} · READ_SMS {diagnostics.readSms?'granted':'missing'} · RECEIVE_SMS {diagnostics.receiveSms?'granted':'missing'} · owner {diagnostics.ownerInitialized?'ready':'not initialized'} · receiver {diagnostics.lastReceiverEvent?dateTime(diagnostics.lastReceiverEvent):'never'} · scanned {diagnostics.messagesScanned} · queued {diagnostics.candidatesQueued} · pending {diagnostics.pendingQueue}</Text>
   {!!diagnostics.lastError&&<Text accessibilityRole="alert" style={s.body}>Last native capture/scan error: {diagnostics.lastError}</Text>}
   <Field label="Scan recent days (1–90)" value={days} onChangeText={v=>{setDays(v);setCursor(null);setShowOlder(false);}} keyboardType="number-pad" editable={!busy}/>
   <LearningButton title="Scan existing SMS" disabled={busy||!settings.enabled||!permission} onPress={()=>void run(()=>scan())}/>
   {cursor?.more&&<LearningButton title="Scan next page" secondary disabled={busy||!settings.enabled||!permission} onPress={()=>void run(()=>scan(true))}/>}
   {settings.full&&<Text accessibilityRole="alert" style={s.body}>The local queue is full. Review or clear candidates, then scan again. Pending confirmations have not been discarded.</Text>}
  </View>:<Text style={s.note}>{Platform.OS==='android'?'SMS reading needs the custom Android APK, not Expo Go.':'Automatic SMS reading is Android-only.'} You can review pasted messages here while connected; this manual review is not saved after leaving the screen.</Text>}
  {!smsNative&&<LearningButton title="Paste an SMS for review" secondary disabled={busy} onPress={()=>setManual(!manual)}/>}
  {manual&&<View style={s.card}><Field label="Confirmed tracking baseline (ISO with timezone)" value={manualBaseline} onChangeText={setManualBaseline}/><Text style={s.note}>Use the time your starting balance was confirmed. Earlier messages stay history-only.</Text><Field label="SMS sender" value={sender} onChangeText={setSender}/><Field label="SMS receipt timestamp (ISO with timezone)" value={received} onChangeText={setReceived}/><Field label="SMS text (never paste a PIN or OTP)" value={body} onChangeText={setBody} multiline maxLength={4096}/><LearningButton title="Parse SMS locally" disabled={busy} onPress={()=>void run(parseManual)}/></View>}
  {!!error&&<Text accessibilityRole="alert" style={s.body}>{error}</Text>}{!!notice&&<Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}
  <LearningButton title={busy?'Working…':'Refresh and retry approved imports'} secondary disabled={busy} onPress={()=>void run(refresh)}/>
  <Text style={s.heading}>Pending review · {recentCandidates.length}</Text>
  {olderCount>0&&<><Text style={s.note}>{olderCount} older candidate{olderCount===1?'':'s'} retained locally.</Text><LearningButton title={showOlder?'Hide older candidates':'View older candidates'} secondary onPress={()=>setShowOlder(!showOlder)}/></>}
  {current&&data?<SmsReview key={current.message.id} candidate={current} data={data} imports={imports} busy={busy} baseline={settings.baseline??manualBaseline} onClose={()=>setSelected(null)} onConfirm={approval=>run(()=>confirm(current,approval))}/>: (showOlder?candidates:recentCandidates).map(c=><View key={c.message.id} style={s.card}><Text style={s.heading}>{providerName(c.parsed.provider)} · {c.parsed.kind.replace(/_/g,' ')}</Text><Text style={s.body}>{amount(c.parsed.amountMinor)} · {dateTime(c.parsed.occurredAt)}</Text><Text style={s.note}>{c.parsed.kind==='unknown'?'Unsupported format · manual review only':c.approval?'Confirmed locally · awaiting database':'Needs your review'}</Text>{!!c.error&&<Text style={s.body}>{c.error}</Text>}<LearningButton title="Review message" secondary disabled={busy} onPress={()=>setSelected(c.message.id)}/></View>)}
  {!data&&<Text style={s.note}>Connect once to load your wallets and categories before confirming imports.</Text>}
  {smsNative&&<><LearningButton title="Clear local SMS candidates" secondary disabled={busy} onPress={()=>setClear(true)}/>{clear&&<View style={s.card}><Text style={s.body}>Remove locally retained message text and pending confirmations? Already imported financial entries remain. Duplicate fingerprints are retained locally.</Text><LearningButton title="Confirm clear candidates" disabled={busy} onPress={()=>void run(async()=>{await smsNative!.clearCandidates(owner);setCandidates([]);setSelected(null);setClear(false);await refresh();})}/><LearningButton title="Keep candidates" secondary onPress={()=>setClear(false)}/></View>}</>}
  {data&&(data.locations??[]).filter(l=>l.active&&l.location_type==='mobile_money').map(l=>{
   const r=reconciliation(data,imports,l);if(!r)return null;
   return <View key={l.id} style={s.card}><Text style={s.heading}>{locationName(l)} · Balance review</Text><Text style={s.body}>SMS reported {currency(r.observation.balance_after!)} at {dateTime(r.observation.transaction_occurred_at)}. FinLit now: {currency(l.balance)}.</Text><Text style={s.note}>{r.comparable?`Difference: ${currency(r.differenceMinor/100)}. Missing fees, messages or transactions may explain it.`:'Later or undated activity prevents a reliable comparison at this SMS time. Review entries before changing anything.'}</Text><Text style={s.note}>Check the provider’s current balance before making a correction. An old SMS may not represent your balance now.</Text><LearningButton title="Review entries or correct balance" secondary onPress={()=>router.push('/budget')}/></View>;
  })}
  <Text style={s.heading}>Import and observation history</Text>
  {imports.map(i=><View key={i.id} style={s.card}><Text style={s.body}>{providerName(i.provider)} · {i.transaction_type.replace(/_/g,' ')} · {i.status.replace(/_/g,' ')}</Text><Text style={s.note}>{dateTime(i.transaction_occurred_at)} · {i.amount===null?'No amount retained':currency(i.amount)}</Text><LearningButton title="Remove retained import details" secondary disabled={busy} onPress={()=>void run(async()=>{await learningApi('sms_forget',{id:i.id});await refresh();})}/><Text style={s.note}>Keeps the transaction and minimal duplicate identity, so rescanning cannot import it again.</Text></View>)}
 </View></Screen>;
}

function SmsReview({candidate,data,imports,busy,baseline,onClose,onConfirm}:{candidate:LocalCandidate;data:BudgetData;imports:SmsImport[];busy:boolean;baseline:string;onClose:()=>void;onConfirm:(p:Record<string,unknown>)=>Promise<void>}){
 const s=useLearningStyles(),palette=usePalette(),p=candidate.parsed;
 const wallets=suggestedWallets(p,data.locations??[]),old=candidate.approval;
 const [wallet,setWallet]=useState(String(old?.wallet??(wallets.length===1?wallets[0].id:'')));
 const [type,setType]=useState(String(old?.type??(p.kind==='withdrawal'||p.kind==='bank_transfer'?'transfer':p.kind==='received'?'income':'expense')));
 const [direction,setDirection]=useState<SmsDirection>(old?.direction==='in'||old?.direction==='out'?old.direction:p.direction);
 const [other,setOther]=useState(String(old?.destination??(p.kind==='withdrawal'?(data.locations??[]).find(l=>l.location_type==='cash')?.id??'':'')));
 const [category,setCategory]=useState(String(old?.category??'')),[fee,setFee]=useState(old?.feeMinor!==undefined?String(Number(old.feeMinor)/100):p.feeMinor===null?'':String(p.feeMinor/100));
 const [description,setDescription]=useState(String(old?.description??'')),[match,setMatch]=useState(''),[verified,setVerified]=useState(false),[feeConfirmed,setFeeConfirmed]=useState(false),[baselineConfirmed,setBaselineConfirmed]=useState(false),[distinctConfirmed,setDistinctConfirmed]=useState(false),[error,setError]=useState('');
 const selected=(data.locations??[]).find(l=>l.id===wallet),sameDay=selected?.opening_date===localDate(new Date(p.occurredAt));
 const historical=Date.parse(p.occurredAt)<Date.parse(baseline)||(selected&&localDate(new Date(p.occurredAt))<selected.opening_date);
 const matches=possibleMatches(p,wallet,data.entries).filter(e=>!imports.some(i=>i.financial_entry_id===e.id));
 const cannotPost=p.amountMinor===null||['balance_check','failed','loan','refund','reversal','unknown'].includes(p.kind);
 const decide=(decision:string)=>{
  if(!wallet){setError('Choose and confirm the wallet for this message.');return;}
  const feeMinor=minorUnits(fee);
  if(decision==='import'||decision==='match'){
   if(!verified||feeMinor===null||!feeConfirmed||(sameDay&&!baselineConfirmed)||(!match&&type!=='transfer'&&!category)||(type==='transfer'&&(direction==='unknown'||!other||other===wallet))){setError(type==='transfer'&&direction==='unknown'?'Choose whether this transfer is incoming or outgoing before confirming.':'Confirm the wallet, transaction, fee, classification and opening-day boundary before posting.');return;}
  }
  setError('');void onConfirm({wallet,baseline,decision,confirmed:verified,feeConfirmed,feeMinor,baselineConfirmed,distinctConfirmed,type,direction,category:category||null,source:type==='transfer'&&direction==='in'?other:wallet,destination:type==='transfer'?(direction==='in'?wallet:other):null,description,entry:match||null});
 };
 return <View style={s.card}>
  <Text style={s.heading}>Review {providerName(p.provider)} message</Text>
  <Text style={s.body}>{p.kind.replace(/_/g,' ')} · Amount {amount(p.amountMinor)} · Fee {amount(p.feeMinor)} · Reported balance {amount(p.balanceMinor)}</Text>
  <Text style={s.note}>Time: {dateTime(p.occurredAt)} ({p.timestampSource==='provider'?'provider-reported':'SMS receipt fallback'}). Reference: {p.reference??'Not stated'}.</Text>
  <Text style={s.note}>Check the original message on this device: {candidate.message.body}</Text>
  {p.warnings.map(w=><Text key={w} style={s.note}>{w}</Text>)}
  <LocationPicker label="SMS wallet" locations={(data.locations??[]).filter(l=>l.location_type==='mobile_money')} value={wallet} onChange={v=>{setWallet(v);setVerified(false);setMatch('');}} disabled={busy} allowUnassigned={false}/>
  {wallets.length>1&&<Text style={s.note}>Several wallets use this provider. A sender label or SIM subscription alone cannot choose the right one.</Text>}
  {historical&&<Text style={s.body}>This message predates the tracking baseline or opening balance. It can be kept as history only; it will not move money.</Text>}
  {!cannotPost&&!historical&&<>
   <Text style={s.heading}>Accounting classification</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{['income','expense','transfer'].map(t=><LearningButton key={t} title={(type===t?'● ':'○ ')+t} secondary disabled={busy} onPress={()=>{setType(t);setCategory('');setMatch('');}}/>)}</View>
   <Text style={s.note}>Received money may be an own-account transfer or borrowing, not earnings. Refunds and reversals need separate review. Withdrawals transfer principal to Cash.</Text>
   {type==='transfer'?<>
    <Text style={s.body}>Transfer direction</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['in','out'] as const).map(value=><LearningButton key={value} title={(direction===value?'● ':'○ ')+(value==='in'?'Incoming':'Outgoing')} secondary disabled={busy} onPress={()=>{setDirection(value);setOther('');}}/>)}</View>
    {direction==='unknown'&&<Text style={s.note}>Choose incoming or outgoing after checking the original message. Unknown direction cannot be posted.</Text>}
    <LocationPicker label={direction==='in'?'Transfer source':'Transfer destination'} locations={(data.locations??[]).filter(l=>l.id!==wallet)} value={other} onChange={setOther} disabled={busy} allowUnassigned={false}/>
   </>:<><Text style={s.body}>Category</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{data.categories.filter(c=>c.entry_type===type&&c.name!=='Transaction fees'&&c.name!=='Savings').map(c=><Pressable key={c.id} accessibilityRole="radio" aria-checked={category===c.id} disabled={busy} onPress={()=>setCategory(c.id)} style={[s.card,{padding:12,borderWidth:1,borderColor:category===c.id?palette.ink:palette.line}]}><Text style={s.body}>{category===c.id?'●':'○'} {c.name}</Text></Pressable>)}</View></>}
   <Field label="Confirmed fee (K; enter 0 only if verified)" value={fee} onChangeText={v=>{setFee(v);setFeeConfirmed(false);}} keyboardType="decimal-pad" editable={!busy&&p.feeMinor===null}/>
   <Check label="I checked the actual fee" value={feeConfirmed} onChange={setFeeConfirmed} disabled={busy}/>
   <Field label="Import description (optional)" value={description} onChangeText={setDescription} maxLength={500} editable={!busy}/>
   {sameDay&&<Check label="This opening-day transaction is not already included in the opening balance" value={baselineConfirmed} onChange={setBaselineConfirmed} disabled={busy}/>}
   {matches.length>0&&<><Text style={s.heading}>Possible existing entries</Text><Text style={s.note}>Matching amount and date do not prove a duplicate. Unassigned entries must first be linked to the correct wallet in Budget.</Text>{matches.map(e=><LearningButton key={e.id} title={(match===e.id?'● ':'○ ')+`${e.entry_type} ${currency(e.amount)} · ${e.description||e.occurred_on}`} secondary disabled={busy||!e.location_id} onPress={()=>{setMatch(e.id);setType(e.entry_type);setCategory(e.category_id??'');setFee(String(e.fee_amount??0));setOther(e.location_id===wallet?e.destination_location_id??'':e.location_id??'');setDirection(e.location_id===wallet?'out':'in');}}/>)}<Check label="This is a separate transaction, not one of the entries above" value={distinctConfirmed} onChange={v=>{setDistinctConfirmed(v);if(v)setMatch('');}} disabled={busy}/></>}
   <Check label="I verified this transaction and selected the correct wallet" value={verified} onChange={setVerified} disabled={busy}/>
   <LearningButton title={match?'Link to selected entry':'Confirm transaction'} disabled={busy} onPress={()=>decide(match?'match':'import')}/>
  </>}
  {!!error&&<Text accessibilityRole="alert" style={s.body}>{error}</Text>}
  <LearningButton title={p.kind==='balance_check'?'Keep balance observation':'Keep as history only'} secondary disabled={busy} onPress={()=>decide('history')}/>
  <LearningButton title="Ignore message" secondary disabled={busy} onPress={()=>decide('ignore')}/>
  <LearningButton title="Back to SMS list" secondary disabled={busy} onPress={onClose}/>
 </View>;
}
