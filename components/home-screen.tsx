import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radii } from '@/constants/finlit-theme';
import { curriculum } from '@/content/learning';
import { moduleAvailable, recommendation } from '@/content/progression';
import { useAuth } from '@/contexts/auth-context';
import { useLearning } from '@/hooks/use-learning';
import { ProgressBar, Screen, StudentShell } from './finlit-ui';
import { LearningButton } from './lesson-player';
import { LearningStatus } from './learning-screens';

export function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const state = useLearning();
  const name = typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()
    ? user.user_metadata.full_name.trim() : 'Welcome back';
  const initials = name === 'Welcome back' ? 'FL' : name.split(/\s+/).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase();
  const lessons = curriculum.flatMap(module => module.lessons);
  const completed = lessons.filter(lesson => state.progress.lessons[lesson.id]?.completed).length;
  const percent = Math.round(completed / lessons.length * 100);
  const next = recommendation(state.progress);
  const continuing = next.lesson && !!state.progress.lessons[next.lesson.id];
  const openNext = () => router.push((next.lesson ? `/learn/lesson/${next.lesson.id}`
    : next.module ? `/learn/challenge/${next.module.id.replace('module-', '')}` : '/learn') as never);

  return <StudentShell><Screen><View style={styles.stack}>
    <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push('/profile')} style={styles.userbar}>
      <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
      <View style={styles.userCopy}><Text style={styles.name}>{name}</Text><Text style={styles.muted}>Student</Text></View>
      <Ionicons name="person-circle-outline" size={25} color={palette.ink} />
    </Pressable>
    <Text accessibilityRole="header" style={styles.title}>What will you{'\n'}master today?</Text>
    <LearningStatus state={state} />
    {!state.loading && !state.error && <>
      <View style={styles.progressBlock}>
        <View style={styles.progressLabels}><Text style={styles.muted}>{completed} of {lessons.length} lessons</Text><Text style={styles.muted}>{percent}% complete</Text></View>
        <View accessibilityRole="progressbar" accessibilityLabel="Lessons completed" accessibilityValue={{ min: 0, max: lessons.length, now: completed }}><ProgressBar value={percent} /></View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${next.lesson ? continuing ? 'Continue lesson' : 'Start lesson' : next.module ? 'Take module challenge' : 'Review learning'}: ${next.lesson?.title ?? next.module?.title ?? 'Curriculum complete'}`} onPress={openNext} style={({ pressed }) => [styles.feature, pressed && styles.pressed]}>
        <Text style={styles.eyebrow}>{next.lesson ? `${continuing ? 'CONTINUE' : 'START LEARNING'} · ABOUT 10 MIN` : next.module ? 'MODULE CHALLENGE · 8 QUESTIONS' : 'ALL SIX MODULES COMPLETE'}</Text>
        <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={styles.noteBehind} /><View style={styles.banknote}><Text style={styles.currency}>K</Text><Ionicons name="sparkles-outline" size={24} color={palette.ink} /></View>
        </View>
        <View style={styles.featureBottom}><View style={styles.featureCopy}><Text style={styles.featureTitle}>{next.lesson?.title ?? (next.module ? 'Ready for your challenge?' : 'Keep your skills fresh')}</Text><Text style={styles.muted}>{next.module ? `Module ${curriculum.indexOf(next.module) + 1} · ${next.module.title}` : 'Revisit your favourite lessons'}</Text></View><View style={styles.play}><Ionicons name={next.module ? 'play' : 'arrow-forward'} size={18} color={palette.surface} /></View></View>
      </Pressable>
      <View style={styles.sectionHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Your learning path</Text><Pressable accessibilityRole="button" accessibilityLabel="View all modules" onPress={() => router.push('/learn')} style={styles.viewAll}><Text style={styles.link}>View all</Text><Ionicons name="arrow-forward" size={15} color={palette.purple} /></Pressable></View>
      <View style={styles.modules}>{curriculum.slice(0, 2).map((module, index) => {
        const passed = state.progress.modules.some(item => item.key === module.id && item.completed);
        const available = moduleAvailable(module.id, state.progress);
        return <Pressable key={module.id} accessibilityRole="button" accessibilityLabel={`${module.title}. ${passed ? 'Completed' : available ? 'Available' : 'Locked'}`} onPress={() => router.push(`/learn/module/${module.id}` as never)} style={({ pressed }) => [styles.module, { backgroundColor: index ? palette.blue : palette.mint }, pressed && styles.pressed]}>
          <Ionicons name={index ? 'bar-chart-outline' : 'wallet-outline'} size={25} color={palette.ink} />
          <Text style={styles.moduleTitle}>{index ? 'Budgeting' : 'Managing money'}</Text>
          <View style={styles.moduleStatus}><Ionicons name={passed ? 'checkmark-circle-outline' : available ? 'arrow-forward' : 'lock-closed-outline'} size={14} color={palette.muted} /><Text style={styles.muted}>{passed ? 'Completed' : available ? 'Explore' : 'Locked'}</Text></View>
        </Pressable>;
      })}</View>
      {state.progress.journey?.baseline&&<LearningButton title={`Knowledge profile · ${state.progress.journey.baseline.score}/${state.progress.journey.baseline.total}`} secondary onPress={()=>router.push('/knowledge-profile' as never)}/>}
      {state.progress.journey?.finalAvailable&&<LearningButton title={state.progress.journey.final?'View learning comparison':'Take final assessment'} onPress={()=>router.push((state.progress.journey?.final?'/learning-comparison':'/final-assessment') as never)}/>}
    </>}
  </View></Screen></StudentShell>;
}

const styles = StyleSheet.create({
  stack: { gap: 20 },
  userbar: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '600', color: palette.ink },
  userCopy: { flex: 1, gap: 3 },
  name: { fontSize: 16, fontWeight: '600', color: palette.ink },
  muted: { fontSize: 12, lineHeight: 18, color: palette.muted },
  title: { fontSize: 36, lineHeight: 40, letterSpacing: -1, fontWeight: '500', color: palette.ink, marginTop: 8 },
  progressBlock: { gap: 10 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  feature: { borderRadius: radii.lg, backgroundColor: palette.blush, padding: 18, gap: 16 },
  eyebrow: { fontSize: 11, lineHeight: 17, letterSpacing: 0.6, fontWeight: '600', color: palette.ink },
  art: { height: 108, alignItems: 'flex-end', justifyContent: 'center', paddingRight: 12 },
  noteBehind: { position: 'absolute', right: 30, top: 26, width: 116, height: 72, borderRadius: 16, backgroundColor: palette.peach, transform: [{ rotate: '-5deg' }] },
  banknote: { width: 116, height: 72, borderRadius: 16, backgroundColor: palette.teal, transform: [{ rotate: '7deg' }], flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  currency: { fontSize: 42, color: palette.ink, fontWeight: '500' },
  featureBottom: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCopy: { flex: 1, gap: 5 },
  featureTitle: { fontSize: 23, lineHeight: 29, fontWeight: '500', color: palette.ink },
  play: { width: 44, height: 44, borderRadius: 22, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '500', color: palette.ink },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  link: { fontSize: 13, color: palette.purple },
  modules: { flexDirection: 'row', gap: 12, marginTop: -10 },
  module: { flex: 1, padding: 16, borderRadius: radii.md, gap: 12 },
  moduleTitle: { fontSize: 15, lineHeight: 21, color: palette.ink, fontWeight: '500' },
  moduleStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  pressed: { opacity: 0.75 },
});
