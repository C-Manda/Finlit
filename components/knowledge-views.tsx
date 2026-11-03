import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { curriculum } from '@/content/learning';
import { competencyFeedback, signed, type KnowledgeJourney, type KnowledgeProfile } from '@/content/knowledge';
import { learningApi, type ChallengeResult } from '@/services/learning';
import { Header, ProgressBar, Screen, StudentShell, ToneCard } from './finlit-ui';
import { LearningButton } from './lesson-player';
import { s } from './learning-screens';

export function KnowledgeSummary({ profile }: { profile: KnowledgeProfile }) {
 return <View style={s.stack}>
  <ToneCard tone="lilac"><Text style={s.title}>{profile.score}/{profile.total} · {profile.percentage}%</Text><Text style={s.body}>Correct answers in this assessment</Text></ToneCard>
  <Text style={s.note}>{profile.classification === 'late_baseline' ? 'Taken after learning had already started. This is a current knowledge profile, not a pre-learning baseline.' : profile.classification === 'historical_unverified' ? 'Earlier assessment: its timing relative to learning is unverified.' : profile.classification === 'pre_learning' ? 'Your original pre-learning result is preserved.' : 'Your post-learning knowledge result.'}</Text>
  {curriculum.map(module => { const score = profile.scores[module.id]; if (!score) return null;
   return <View key={module.id} style={s.card}><Text style={s.heading}>{module.title}</Text><Text style={s.body}>{score.correct}/{score.total} correct · {Math.round(score.correct / score.total * 1000) / 10}%</Text><View accessibilityRole="progressbar" accessibilityLabel={module.title} accessibilityValue={{min:0,max:score.total,now:score.correct}}><ProgressBar value={score.correct / score.total * 100}/></View><Text style={s.note}>{competencyFeedback(score)}</Text></View>;
  })}
  <Text style={s.heading}>Stronger demonstrated knowledge</Text><Text style={s.body}>{curriculum.filter(m=>profile.scores[m.id]?.correct===profile.scores[m.id]?.total && profile.scores[m.id]).map(m=>m.title).join(' · ') || 'No area had every sampled question correct. The feedback above offers a starting point for practice.'}</Text>
  <Text style={s.heading}>Areas to review</Text><Text style={s.body}>{curriculum.filter(m=>profile.reviewAreas.includes(m.id)).map(m=>m.title).join(' · ') || 'You answered all sampled questions correctly. Continue the guided curriculum to apply these ideas.'}</Text>
  <Text style={s.note}>Each area contains only a few questions. This profile describes demonstrated knowledge, not your financial behaviour or complete capability. These are original Finlit questions, not a validated OECD instrument.</Text>
  <Text style={s.note}>Completed {new Date(profile.completedAt).toLocaleDateString()} · Assessment version {profile.version}</Text>
 </View>;
}
export function PriorityList({ journey, compact = false }: { journey: KnowledgeJourney; compact?: boolean }) {
 const router=useRouter();
 return <View style={s.stack}><Text style={s.heading}>Your learning priorities</Text>
  {!journey.baseline ? <Text style={s.body}>Complete the knowledge assessment for recommendations based on your answers.</Text> : !journey.priorities.length ? <Text style={s.body}>No additional priorities remain from your initial answers. Continue the guided sequence or revisit completed topics.</Text> : (compact?journey.priorities.slice(0,2):journey.priorities).map(item=><View key={item.key} style={s.card}><Text style={s.heading}>{curriculum.find(m=>m.id===item.key)?.title}</Text><Text style={s.body}>{item.reason}</Text><Text style={s.note}>Initial assessment: {item.correct}/{item.total} · {item.completedLessons}/4 lessons complete</Text><Text style={s.note}>{item.available?'Available in your guided path.':'A future priority: complete preceding modules first.'}</Text><LearningButton title="View module" secondary onPress={()=>router.push(`/learn/module/${item.key}` as never)}/></View>)}
 </View>;
}
export function KnowledgeResult({ result }: { result: ChallengeResult }) {
 const router=useRouter(), profile=result.analysis!;
 return <Screen><Header title={result.assessment.assessment_type==='final'?'Final assessment results':'Your Financial Knowledge Profile'} back/><View style={s.stack}>
  <KnowledgeSummary profile={profile}/>{result.journey&&<PriorityList journey={result.journey} compact/>}
  <LearningButton title="Continue to Learning" onPress={()=>router.replace('/learn')}/>
  {result.assessment.assessment_type==='final'&&<LearningButton title="View learning comparison" secondary onPress={()=>router.push('/learning-comparison' as never)}/>}
  <Text style={s.heading}>Review your answers</Text>{result.feedback.map((item,index)=><View key={item.id} style={s.card}><Text style={s.label}>QUESTION {index+1} · {item.correct?'CORRECT':'REVIEW'}</Text><Text style={s.heading}>{item.prompt}</Text><Text style={s.body}>Your answer: {item.selected}</Text><Text style={s.body}>{item.explanation}</Text></View>)}
 </View></Screen>;
}
export function JourneyScreen({ comparison=false }: { comparison?: boolean }) {
 const router=useRouter();const [state,setState]=useState<{data:KnowledgeJourney|null;error:string}>({data:null,error:''}),[reload,setReload]=useState(0);
 useFocusEffect(useCallback(()=>{void reload;let active=true;setState({data:null,error:''});learningApi<KnowledgeJourney>('journey').then(data=>{if(active)setState({data,error:''});}).catch(e=>{if(active)setState({data:null,error:e.message});});return()=>{active=false;};},[reload]));
 const j=state.data;
 return <StudentShell><Screen><Header title={comparison?'Your Financial Learning Journey':'Your Financial Knowledge Profile'} back/><View style={s.stack}>
  {state.error?<><Text accessibilityRole="alert" style={s.body}>{state.error}</Text><LearningButton title="Retry" onPress={()=>setReload(n=>n+1)}/></>:!j?<Text style={s.body}>Loading your saved results…</Text>:comparison?<>
   <Text style={s.body}>{j.comparison.limitation}</Text>
   {j.baseline&&<ToneCard tone="lilac"><Text style={s.heading}>Initial assessment: {j.baseline.score}/{j.baseline.total} · {j.baseline.percentage}%</Text><Text style={s.note}>{new Date(j.baseline.completedAt).toLocaleDateString()}</Text></ToneCard>}
   {j.final&&<ToneCard tone="mint"><Text style={s.heading}>Final assessment: {j.final.score}/{j.final.total} · {j.final.percentage}%</Text><Text style={s.note}>{new Date(j.final.completedAt).toLocaleDateString()}</Text></ToneCard>}
   {j.comparison.comparable&&j.baseline&&j.final&&<><Text style={s.title}>{signed(j.comparison.correctDifference!)} correct answers</Text><Text style={s.body}>{signed(j.comparison.percentagePointDifference!)} percentage points</Text>{curriculum.map(m=>{const before=j.baseline!.scores[m.id],after=j.final!.scores[m.id];if(!before||!after)return null;const delta=after.correct-before.correct;return <View style={s.card} key={m.id}><Text style={s.heading}>{m.title}</Text><Text style={s.body}>{before.correct}/{before.total} → {after.correct}/{after.total} · {signed(delta)} correct</Text><Text style={s.note}>{delta>0?'More sampled questions answered correctly.':delta<0?'Fewer sampled questions answered correctly; revisit this topic.':'The number of correct answers is unchanged.'} {after.correct<after.total?'Further review may help.':'All final questions in this area were correct.'}</Text></View>;})}</>}
   {!j.final&&<LearningButton title={j.finalAvailable?'Open final assessment':'Continue learning'} onPress={()=>router.push((j.finalAvailable?'/final-assessment':'/learn') as never)}/>}
  </>:j.baseline?<><KnowledgeSummary profile={j.baseline}/><PriorityList journey={j}/><LearningButton title="Review assessment answers" secondary onPress={()=>router.push(`/diagnostic-results?attemptId=${j.baseline!.id}` as never)}/></>:<><Text style={s.body}>{j.legacy?'Your learning progress is preserved. Take an optional knowledge assessment; it will be labelled as taken after learning started.':'Your initial assessment creates a starting knowledge profile.'}</Text><LearningButton title="Open initial assessment" onPress={()=>router.push('/diagnostic')}/></>}
  <LearningButton title="Return to learning" secondary onPress={()=>router.replace('/learn')}/>
 </View></Screen></StudentShell>;
}
