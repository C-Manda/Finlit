import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Header, ProgressBar, Screen, StudentShell, ToneCard } from './finlit-ui';
import { LearningButton, LessonPlayer } from './lesson-player';
import { radii, usePalette, themedStyles } from '@/constants/finlit-theme';
import { curriculum, newLessonRecord, STAGE_TITLES, type LessonContent } from '@/content/learning';
import { lessonAvailable, moduleAvailable, recommendation } from '@/content/progression';
import { useLearning } from '@/hooks/use-learning';
import { PriorityList } from './knowledge-views';
import { loadLesson } from '@/services/learning';
import { useAuth } from '@/contexts/auth-context';

export function LearningStatus({ state }: { state: ReturnType<typeof useLearning> }) {
  const s = useLearningStyles();

  if (state.loading) return <Text style={s.body}>Loading your learning record…</Text>;
  if (state.error) return <View style={s.stack}><Text accessibilityRole="alert" style={s.body}>{state.error}</Text><LearningButton title="Retry loading" onPress={state.retry} /></View>;
  return null;
}
export function LearningPath() {
  const s = useLearningStyles();
  const palette = usePalette();

  const state = useLearning(), router = useRouter(); const { user } = useAuth();
  const next = recommendation(state.progress);
  const completed = Object.values(state.progress.lessons).filter(l => l.completed).length;
  return <StudentShell><Screen><Header title="Learning path" /><View style={s.stack}>
    <Text style={s.title}>Build your financial confidence</Text>
    <Text style={s.body}>Six modules for student life in Zambia. Your learning and budget stay connected to your account.</Text>
    <LearningStatus state={state} />
    {!state.loading && !state.error && <>
      <ToneCard tone="lilac"><View style={s.stack}><Text style={s.label}>{next.module ? 'RECOMMENDED NEXT STEP' : 'CURRICULUM COMPLETE'}</Text><Text style={s.heading}>{next.lesson?.title ?? next.module?.title ?? 'Keep your skills fresh'}</Text><Text style={s.body}>{next.reason}</Text>
        {next.module && <LearningButton title={next.lesson ? state.progress.lessons[next.lesson.id] ? 'Resume lesson' : 'Explore lesson' : 'Take module challenge'} onPress={() => router.push((next.lesson ? '/learn/lesson/'+next.lesson.id : '/learn/challenge/'+next.module!.id.replace('module-','')) as never)} />}
      </View></ToneCard>
      <Text style={s.body}>{completed} of 24 lessons complete · {state.progress.modules.filter(m=>m.completed).length} of 6 modules passed</Text>
      <View accessibilityRole="progressbar" accessibilityLabel="Lessons completed" accessibilityValue={{min:0,max:24,now:completed}}><ProgressBar value={completed/24*100}/></View>
      <Text style={s.note}>{state.progress.modules.filter(m=>m.completed).length}/6 module challenges passed</Text>
      {curriculum.map((m,i) => {
        const passed = state.progress.modules.some(p=>p.key===m.id && p.completed), available = moduleAvailable(m.id,state.progress);
        const done = m.lessons.filter(l=>state.progress.lessons[l.id]?.completed).length;
        const score = state.progress.diagnostic?.scores[m.id];
        return <Pressable key={m.id} accessibilityRole="button" accessibilityLabel={m.title + (passed ? '. Completed' : available ? '. Available' : '. Locked')} style={[s.card,{backgroundColor:[palette.mint,palette.blue,palette.peach,palette.lilac,palette.blush,palette.mint][i]},available && !passed && s.current]} onPress={() => router.push(('/learn/module/'+m.id) as never)}>
          <Text style={s.label}>MODULE {i+1} · {passed ? 'COMPLETED' : available ? m.lessons.some(l=>state.progress.lessons[l.id]) ? 'IN PROGRESS' : 'AVAILABLE' : 'LOCKED'}</Text><Text style={s.heading}>{m.title}</Text><Text style={s.body}>{m.introduction}</Text><Text style={s.note}>{done}/4 lessons · Challenge: {passed?'Passed':'6/8 to pass'}</Text><View accessibilityRole="progressbar" accessibilityLabel={m.title+' lessons completed'} accessibilityValue={{min:0,max:4,now:done}}><ProgressBar value={done/4*100}/></View>
          {score && <Text style={s.note}>Knowledge check: {score.correct}/{score.total}{score.correct/score.total<0.75 ? ' · Practice recommended' : ' · Build on this strength'}</Text>}
          {!available && <Text style={s.note}>Pass Module {i} before starting.</Text>}
        </Pressable>;
      })}
      {state.progress.journey && <><View style={s.card}><Text style={s.heading}>Financial Knowledge Profile</Text><Text style={s.body}>{state.progress.journey.baseline ? `${state.progress.journey.baseline.score}/${state.progress.journey.baseline.total} correct · ${state.progress.journey.baseline.percentage}%` : state.progress.journey.legacy ? 'Your existing learning is preserved. An optional assessment can show your current knowledge.' : 'Start with your initial assessment.'}</Text><LearningButton title={state.progress.journey.baseline?'View knowledge profile':'Open initial assessment'} secondary onPress={()=>router.push((state.progress.journey?.baseline?'/knowledge-profile':'/diagnostic') as never)}/></View><PriorityList journey={state.progress.journey} compact/><View style={s.card}><Text style={s.heading}>Final Assessment</Text><Text style={s.body}>{state.progress.journey.final?'Your final result is saved.':state.progress.journey.finalAvailable?'You have completed the curriculum. Reflect on your learning with 18 new questions.':'Complete all 24 lessons and pass the six module challenges to unlock.'}</Text><LearningButton title={state.progress.journey.final?'View final results':'Open final assessment'} disabled={!state.progress.journey.finalAvailable} onPress={()=>router.push('/final-assessment' as never)}/>{state.progress.journey.comparison.available&&<LearningButton title="View learning comparison" secondary onPress={()=>router.push('/learning-comparison' as never)}/>}</View></>}
      <LearningButton title="Open my Budget Tracker" secondary onPress={() => router.push('/budget')} />
      <LearningButton title="Financial glossary" secondary onPress={() => router.push('/glossary' as never)} />
      <Text style={s.note}>Signed in as {user?.email}. A connection is required to save progress.</Text>
    </>}
  </View></Screen></StudentShell>;
}
export function ModuleScreen({ moduleId }: { moduleId: string }) {
  const palette = usePalette();
  const s = useLearningStyles();

  const state=useLearning(), router=useRouter(); const module=curriculum.find(m=>m.id===moduleId);
  if(!module) return <Screen><Header title="Module unavailable" back /><LearningButton title="Open learning path" onPress={()=>router.replace('/learn')} /></Screen>;
  const done=module.lessons.filter(l=>state.progress.lessons[l.id]?.completed).length;
  const result=state.progress.modules.find(m=>m.key===module.id);
  return <Screen><Header title="Module overview" back /><View style={s.stack}><ToneCard tone="mint"><View style={{height:112,alignItems:'center',justifyContent:'center'}}><Ionicons name="book-outline" size={48} color={palette.ink}/></View></ToneCard><Text style={s.title}>{module.title}</Text><Text style={s.body}>{module.introduction}</Text><LearningStatus state={state}/>
    {!state.loading && !state.error && <><Text style={s.body}>{done}/4 lessons complete · About 10 minutes per lesson</Text>
      {result?.completed && <ToneCard tone="mint"><Text style={s.heading}>Module completed</Text><Text style={s.body}>Highest challenge score: {result.score}/8. Your lessons remain available to review.</Text></ToneCard>}
      {module.lessons.map((l,i)=>{const r=state.progress.lessons[l.id], available=lessonAvailable(l.id,state.progress);return <View key={l.id} style={s.card}><Text style={s.label}>LESSON {i+1}</Text><Text style={s.heading}>{l.title}</Text><Text style={s.note}>{r?.completed?'Completed · Review available':available?r?'In progress · '+STAGE_TITLES[r.stage]:'Available':i?'Complete the preceding lesson first.':'Pass the preceding module challenge first.'}</Text><LearningButton title={r?.completed?'Review lesson':r?'Continue lesson':'Explore lesson'} disabled={!available} onPress={()=>router.push(('/learn/lesson/'+l.id) as never)}/></View>;})}
      <View style={s.card}><Text style={s.heading}>Module challenge</Text><Text style={s.body}>Eight questions · Pass with six correct answers. Retakes preserve earlier attempts.</Text>{result && !result.completed && <Text style={s.body}>Review needed · Best result {result.score}/8</Text>}<LearningButton title="Open challenge" disabled={done!==4 || !moduleAvailable(module.id,state.progress)} onPress={()=>router.push(('/learn/challenge/'+module.id.replace('module-','')) as never)}/></View>
    </>}
  </View></Screen>;
}
export function LessonScreen({ lessonId }: { lessonId: string }) {
  const { user }=useAuth(); return <LessonBody key={user?.id+lessonId} lessonId={lessonId}/>;
}
function LessonBody({ lessonId }: { lessonId: string }) {
  const s = useLearningStyles();

  const { play }=useLocalSearchParams<{play?:string}>(), state=useLearning(), router=useRouter();
  const [lesson,setLesson]=useState<LessonContent|null>(null), [error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;setLesson(null);setError('');loadLesson(lessonId).then(l=>{if(active)setLesson(l);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[lessonId,reload]);
  if(state.loading || state.error) return <Screen><Header title="Your lesson" back/><LearningStatus state={state}/></Screen>;
  if(error) return <Screen><Header title="Lesson unavailable" back/><Text accessibilityRole="alert" style={s.body}>{error}</Text><LearningButton title="Retry" onPress={()=>setReload(n=>n+1)}/><LearningButton title="Return to learning" secondary onPress={()=>router.replace('/learn')}/></Screen>;
  if(!lesson) return <Screen><Text style={s.body}>Loading lesson…</Text></Screen>;
  if(!lessonAvailable(lesson.id,state.progress)) return <Screen><Header title="Lesson locked" back/><Text style={s.body}>Complete the preceding lessons and module challenge first.</Text><LearningButton title="View learning path" onPress={()=>router.replace('/learn')}/></Screen>;
  const record=state.progress.lessons[lesson.id]??newLessonRecord(lesson.version);
  const exit=()=>router.replace(('/learn/module/'+lesson.moduleId) as never);
  const action=()=>{const destination=lesson.action?.destination;router.push((destination==='create'?'/budget/create':destination==='transaction'?'/budget/add':'/budget')+'?from='+lesson.id as never);};
  if(play==='1') return <LessonPlayer lesson={lesson} record={record} saving={state.saving} saveError={state.saveError} saved={!!state.progress.lessons[lesson.id]} onSave={r=>state.save(lesson,r)} onRetrySave={state.retrySave} onReload={state.retry} onExit={exit} onAction={action} onNext={()=>{const module=curriculum.find(m=>m.id===lesson.moduleId)!;const next=module.lessons[module.lessons.findIndex(l=>l.id===lesson.id)+1];router.replace((next?'/learn/lesson/'+next.id:'/learn/challenge/'+module.id.replace('module-','')) as never);}}/>;
  const start=async()=>{if(record.completed && !await state.save(lesson,{...record,stage:0}))return;router.push(('/learn/lesson/'+lesson.id+'?play=1') as never);};
  return <Screen><Header title="Lesson overview" back/><View style={s.stack}><Text style={s.title}>{lesson.title}</Text><Text style={s.body}>{lesson.introduction}</Text><ToneCard tone="lilac"><Text style={s.body}>Practise with a fictional student situation. You never need to enter personal financial information to complete a lesson.</Text></ToneCard><Text style={s.heading}>Your learning objective</Text>{lesson.outcomes.map(o=><Text key={o} style={s.body}>{o}</Text>)}<Text style={s.note}>About {lesson.estimatedMinutes} minutes · Seven stages · Three checkpoints</Text>{STAGE_TITLES.map((t,i)=><Text key={t} style={s.body}>{i+1}. {t}</Text>)}
    {!!state.saveError&&<><Text accessibilityRole="alert" style={s.body}>{state.saveError}</Text><LearningButton title="Retry saving" onPress={()=>void state.retrySave()}/></>}
    <LearningButton title={record.completed?'Review lesson':state.progress.lessons[lesson.id]?'Continue lesson':'Start lesson'} disabled={state.saving||!!state.saveError} onPress={()=>void start()}/><Text style={s.note}>Progress is saved to your account after each step. Stay connected while learning.</Text></View></Screen>;
}
export const useLearningStyles = themedStyles(palette => ({stack:{gap:16},card:{padding:18,borderWidth:1,borderColor:palette.line,borderRadius:radii.md,backgroundColor:palette.surface,gap:12},current:{borderColor:palette.purple,backgroundColor:palette.lilac},title:{fontSize:30,lineHeight:35,color:palette.ink,fontWeight:'500'},heading:{fontSize:19,lineHeight:25,color:palette.ink,fontWeight:'500'},body:{fontSize:14,lineHeight:22,color:palette.ink},label:{color:palette.muted,fontSize:11,lineHeight:17,letterSpacing:0.6,fontWeight:'500'},note:{color:palette.muted,fontSize:13,lineHeight:20}}));
