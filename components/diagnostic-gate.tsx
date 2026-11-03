import { Redirect, usePathname, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '@/contexts/auth-context';
import { learningApi } from '@/services/learning';
import type { KnowledgeJourney } from '@/content/knowledge';
import { Screen } from './finlit-ui';
import { LearningButton } from './lesson-player';

export function DiagnosticGate({ children }: { children: ReactNode }) {
 const {user}=useAuth(),path=usePathname(),router=useRouter();
 const guarded=path==='/dashboard'||path==='/learn'||path.startsWith('/learn/')||path==='/recommended'||path==='/progress';
 const userId=user?.id;
 const request=JSON.stringify([userId,path]);
 const [state,setState]=useState({request:'',required:false,error:''}),[reload,setReload]=useState(0);
 useEffect(()=>{let active=true;if(!userId||!guarded)return;learningApi<KnowledgeJourney>('journey').then(j=>{if(active)setState({request,required:j.required,error:''});}).catch(e=>{if(active)setState({request,required:false,error:e.message});});return()=>{active=false;};},[request,userId,guarded,reload]);
 const checking=!!user&&guarded&&state.request!==request;
 const failed=!!user&&guarded&&state.request===request&&!!state.error;
 const redirect=!!user&&guarded&&state.request===request&&!state.error&&state.required;
 // Keep the router's Stack mounted while checking a new route. Unmounting it loses navigation state.
 return <View style={{flex:1}}>{children}{redirect&&<Redirect href="/diagnostic"/>}
  {(checking||failed||redirect)&&<View style={{position:'absolute',inset:0,backgroundColor:'#faf9f8'}}><Screen>{failed?<View style={{gap:16}}><Text accessibilityRole="alert">{state.error}</Text><LearningButton title="Retry" onPress={()=>{setState({request:'',required:false,error:''});setReload(n=>n+1);}}/><LearningButton title="Open Budget Tracker" secondary onPress={()=>router.push('/budget')}/><LearningButton title="Open profile" secondary onPress={()=>router.push('/profile')}/></View>:<Text>Loading your learning journey…</Text>}</Screen></View>}
 </View>;
}
