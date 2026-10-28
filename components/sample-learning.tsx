import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Header, Screen, ToneCard } from '@/components/finlit-ui';
import { LearningButton, LessonPlayer } from '@/components/lesson-player';
import { palette, radii } from '@/constants/finlit-theme';
import { authoredLessons, curriculum, LEARNING_RULES, newLessonRecord, sampleLesson, STAGE_TITLES } from '@/content/learning';
import { useSampleProgress } from '@/hooks/use-sample-progress';

type ProgressState = ReturnType<typeof useSampleProgress>;
function Status({ state }: { state: ProgressState }) {
  if (state.loading) return <Text style={styles.body}>Loading your progress…</Text>;
  if (state.error) return <View style={styles.stack}><Text accessibilityRole="alert" style={styles.body}>{state.error}</Text><LearningButton title="Retry loading progress" onPress={state.retry} /></View>;
  return null;
}
export function SampleRecommendation() {
  const router = useRouter();
  const state = useSampleProgress();
  const record = state.progress.lessons[sampleLesson.id];
  return <ToneCard tone="lilac" style={styles.recommendation}>
    <Text style={styles.label}>{record?.completed ? 'KEEP LEARNING' : 'YOUR NEXT LESSON'}</Text>
    <Text style={styles.title}>{sampleLesson.title}</Text>
    <Text style={styles.body}>{record?.completed ? 'Lesson complete. Revisit the ideas and practise at your own pace.' : record ? 'Continue at ' + STAGE_TITLES[record.stage].toLowerCase() + ' · Stage ' + (record.stage + 1) + ' of 7.' : 'Turn a student allowance into a plan. About ' + sampleLesson.estimatedMinutes + ' minutes.'}</Text>
    <Status state={state} />
    {!state.loading && !state.error && <LearningButton title={record ? record.completed ? 'Review lesson' : 'Continue lesson' : 'Start lesson'}
      onPress={() => router.push(('/learn/lesson/' + sampleLesson.id + (record && !record.completed ? '?play=1' : '')) as never)} />}
    <Text style={styles.note}>Your progress is saved on this device.</Text>
  </ToneCard>;
}
export function SampleModule({ moduleId }: { moduleId: string }) {
  const module = curriculum.find(item => item.id === moduleId);
  const state = useSampleProgress();
  const router = useRouter();
  const [notice, setNotice] = useState('');
  if (!module) return <Screen><Header title="Module unavailable" back /><Text style={styles.body}>We couldn’t find this module. Return to Learn to choose another.</Text></Screen>;
  const sampleModule = module.id === sampleLesson.moduleId;
  const record = state.progress.lessons[sampleLesson.id];
  const completed = sampleModule && record?.completed ? 1 : 0;
  return <Screen><Header title="Module overview" back /><View style={styles.stack}>
    <Text style={styles.label}>MODULE {curriculum.indexOf(module) + 1}</Text>
    <Text style={styles.title}>{module.title}</Text><Text style={styles.body}>{module.introduction}</Text>
    <Text style={styles.body}>{module.lessons.length} lessons · About {LEARNING_RULES.estimatedMinutes} minutes each · {LEARNING_RULES.challengeQuestions}-question challenge</Text>
    <Status state={state} />
    {!state.loading && !state.error && <><Text style={styles.heading}>{completed} of {LEARNING_RULES.lessonsPerModule} lessons completed on this device</Text>
      {sampleModule && <View style={styles.card}><Text style={styles.heading}>What you’ll practise</Text>{sampleLesson.outcomes.map(outcome => <Text key={outcome} style={styles.body}>• {outcome}</Text>)}</View>}
      {module.lessons.map((lesson, i) => {
        const available = lesson.id === sampleLesson.id;
        const status = available ? record?.completed ? 'Completed · Review available' : record ? 'In progress · Continue ' + STAGE_TITLES[record.stage].toLowerCase() : 'Available · Recommended' : '';
        const requirement = i === 0 ? curriculum.indexOf(module) === 0 ? 'Start your learning journey here.' : 'Complete the previous module to unlock this lesson.' : 'Complete “' + module.lessons[i - 1].title + '” first.';
        return <Pressable key={lesson.id} accessibilityRole="button" accessibilityLabel={status ? lesson.title + '. ' + status : lesson.title}
          onPress={() => available ? router.push(('/learn/lesson/' + lesson.id) as never) : setNotice(lesson.title + '. ' + requirement)}
          style={[styles.card, available && styles.current]}>
          <Text style={styles.label}>LESSON {i + 1} · ABOUT {LEARNING_RULES.estimatedMinutes} MIN</Text><Text style={styles.heading}>{available && record?.completed ? '✓ ' : ''}{lesson.title}</Text>
          {!!status && <Text style={styles.body}>{status}</Text>}{!available && <Text style={styles.note}>{requirement}</Text>}
        </Pressable>;
      })}
      {!!notice && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{notice}</Text>}
      <View style={styles.card}><Text style={styles.label}>MODULE CHALLENGE</Text><Text style={styles.heading}>Apply what you’ve learned</Text>
        <Text style={styles.body}>{LEARNING_RULES.challengeQuestions} questions · Pass with {LEARNING_RULES.challengePassScore}/{LEARNING_RULES.challengeQuestions}</Text>
        <Text style={styles.body}>Complete all four lessons to prepare for the module challenge.</Text>
      </View>
      <Text style={styles.note}>Lessons unlock in order. Pass the module challenge to continue to the next module.</Text>
    </>}
  </View></Screen>;
}
export function SampleLessonScreen({ lessonId }: { lessonId: string }) {
  const { play } = useLocalSearchParams<{ play?: string }>();
  const state = useSampleProgress();
  const router = useRouter();
  const lesson = authoredLessons.find(item => item.id === lessonId);
  if (!lesson) return <Screen><Header title="Lesson unavailable" back /><Text style={styles.body}>This lesson isn’t available yet. Return to Learn to choose another.</Text></Screen>;
  const module = curriculum.find(item => item.id === lesson.moduleId);
  const moduleIndex = module ? curriculum.indexOf(module) : -1;
  const record = state.progress.lessons[lesson.id] ?? newLessonRecord(lesson.version);
  const exit = () => router.replace(('/learn/module/' + lesson.moduleId) as never);
  if (state.loading || state.error) return <Screen><Header title={lesson.title} back /><Status state={state} /></Screen>;
  if (play === '1') return <LessonPlayer key={lesson.id} lesson={lesson} record={record} saved={!!state.progress.lessons[lesson.id]} saving={state.saving}
    saveError={state.saveError} onSave={next => state.save(lesson.id, next)} onRetrySave={state.retrySave} onReload={state.retry} onExit={exit} />;
  const start = async () => {
    if (record.completed && !await state.save(lesson.id, { ...record, stage: 0 })) return;
    router.push(('/learn/lesson/' + lesson.id + '?play=1') as never);
  };
  return <Screen><Header title="Lesson overview" back /><View style={styles.stack}>
    <Text style={styles.label}>MODULE {moduleIndex + 1} · {module?.title.toUpperCase()}</Text>
    <Text style={styles.title}>{lesson.title}</Text><Text style={styles.body}>{lesson.introduction}</Text>
    <ToneCard tone="lilac"><Text style={styles.body}>Follow Chipo’s monthly spending plan, then try making a decision of your own. All amounts are fictional ZMW examples.</Text></ToneCard>
    <Text style={styles.heading}>By the end, you’ll be able to</Text>
    {lesson.outcomes.map(outcome => <Text key={outcome} style={styles.body}>• {outcome}</Text>)}
    <Text style={styles.body}>About {lesson.estimatedMinutes} minutes · 7 stages · {LEARNING_RULES.checkpointQuestions} checkpoint questions</Text>
    <Text style={styles.note}>Learn at your own pace. The checkpoint helps you practise, with an explanation for every answer. Your progress is saved on this device.</Text>
    <View style={styles.card}>{STAGE_TITLES.map((title, i) => <Text key={title} style={styles.body}>{i + 1}. {title}</Text>)}</View>
    {!!state.saveError && <View style={styles.stack}><Text accessibilityRole="alert" style={styles.body}>{state.saveError}</Text><LearningButton title="Retry saving progress" disabled={state.saving} onPress={() => void state.retrySave()} /></View>}
    <LearningButton title={state.saving ? 'Saving…' : record.completed ? 'Review lesson' : state.progress.lessons[lesson.id] ? 'Continue lesson' : 'Start lesson'} disabled={state.saving || !!state.saveError} onPress={() => void start()} />
    <LearningButton title="View module" secondary onPress={exit} />
  </View></Screen>;
}
export function CurriculumPlan() {
  const router = useRouter();
  return <View style={styles.stack}><Text style={styles.heading}>Your learning path</Text><Text style={styles.note}>Build your money skills across six modules, with four lessons in each.</Text>
    {curriculum.map((module, i) => <Pressable key={module.id} accessibilityRole="button" style={styles.card}
      onPress={() => router.push(('/learn/module/' + module.id) as never)}><Text style={styles.heading}>{i + 1}. {module.title}</Text>
      {module.id === sampleLesson.moduleId && <Text style={styles.note}>Start with Understanding budgets</Text>}</Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  stack: { gap: 16 }, recommendation: { gap: 14, marginVertical: 18 }, card: { padding: 18, borderWidth: 1, borderColor: palette.line, borderRadius: radii.md, backgroundColor: palette.surface, gap: 10 },
  current: { borderColor: palette.purple }, title: { fontSize: 27, lineHeight: 34, color: palette.ink, fontWeight: '600' },
  heading: { fontSize: 19, lineHeight: 27, color: palette.ink, fontWeight: '600' }, body: { fontSize: 16, lineHeight: 25, color: palette.ink },
  label: { color: palette.purple, fontSize: 11, lineHeight: 17, letterSpacing: 0.6, fontWeight: '700' },
  note: { color: palette.muted, fontSize: 13, lineHeight: 20 },
});
