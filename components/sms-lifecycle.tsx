import {useEffect} from 'react';
import {AppState,Platform} from 'react-native';
import {useAuth} from '@/contexts/auth-context';
import {smsNative} from '@/features/sms/native';
import {setSmsOwner,syncApproved} from '@/features/sms/import-service';
export function SmsLifecycle(){
 const {user,isLoading}=useAuth();const id=user?.id??null;
 useEffect(()=>{
  if(isLoading||!smsNative)return;
  let alive=true;
  const sync=()=>{if(alive&&id)void syncApproved(id).catch(()=>undefined);};
  void setSmsOwner(id).then(sync).catch(()=>undefined);
  const app=AppState.addEventListener('change',state=>{if(state==='active')sync();});
  const sms=smsNative.addListener('onCandidate',sync);
  if(Platform.OS==='web'&&typeof window!=='undefined')window.addEventListener('online',sync);
  return()=>{alive=false;app.remove();sms.remove();if(Platform.OS==='web'&&typeof window!=='undefined')window.removeEventListener('online',sync);};
 },[id,isLoading]);
 return null;
}
