import { CurriculumPlan, SampleRecommendation } from '@/components/sample-learning';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter as useExpoRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { commonStyles, palette, radii, spacing } from '@/constants/finlit-theme';
import { Field, Header, PrimaryButton, ProgressBar, Screen, SectionTitle, StudentShell, ToneCard } from '@/components/finlit-ui';
import { useAuth } from '@/contexts/auth-context';
import { authoredLessons } from '@/content/learning';
import { useSampleProgress } from '@/hooks/use-sample-progress';
import { useProfile } from '@/hooks/use-profile';
import { useModules, useModule } from '@/hooks/use-modules';
import { useLessons, useLesson } from '@/hooks/use-lessons';
import { useCompleteLessonMutation, useLessonProgress, useUserLessonProgress } from '@/hooks/use-progress';
import { describeSupabaseError } from '@/lib/supabase-diagnostics';

function useRouter() {
  return useExpoRouter() as { push: (href: string) => void; back: () => void };
}

export function WelcomeView() {
  const router = useRouter();
  return <Screen><View style={styles.welcome}><Text style={styles.brand}>FINLIT</Text><View style={styles.hero}><Text style={styles.heroMark}>K</Text><View style={styles.heroDot} /></View><Text style={commonStyles.title}>Build better{`\n`}money habits</Text><Text style={[commonStyles.body, styles.welcomeBody]}>Short lessons. Practical decisions. Progress you can see.</Text><PrimaryButton title="Get started" onPress={() => router.push('/login')} /><Pressable onPress={() => router.push('/login')}><Text style={styles.centerLink}>Already have an account? Log in</Text></Pressable></View></Screen>;
}

export { LoginView } from '@/components/auth-views';

export function RecommendedView() {
  return <Screen><Header title="Your learning path" back /><Text style={commonStyles.heading}>Build your money skills</Text><Text style={commonStyles.body}>Start with a lesson, practise a decision and continue at your own pace.</Text><SampleRecommendation /><CurriculumPlan /></Screen>;
}

export function HomeView() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { modules: realModules, isLoading, error } = useModules();

  // Get user initials from profile or email
  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() || '?';

  if (isLoading) {
    return (
      <StudentShell>
        <Screen>
          <View style={styles.userBar}>
            <View style={styles.avatar}>
              <Text>{initials}</Text>
            </View>
            <View style={styles.userCopy}>
              <Text style={styles.userName}>{profile?.full_name || 'Student'}</Text>
              <Text style={commonStyles.label}>Student</Text>
            </View>
            <Ionicons name="notifications-outline" size={21} color={palette.ink} />
          </View>
          <Text style={commonStyles.body}>Loading learning path...</Text>
        </Screen>
      </StudentShell>
    );
  }

  if (error) {
    return (
      <StudentShell>
        <Screen>
          <SampleRecommendation /><Text style={commonStyles.title}>Modules unavailable</Text>
          <Text style={commonStyles.body}>{describeSupabaseError(error)}</Text>
        </Screen>
      </StudentShell>
    );
  }

  return (
    <StudentShell>
      <Screen>
        <View style={styles.userBar}>
          <View style={styles.avatar}>
            <Text>{initials}</Text>
          </View>
          <View style={styles.userCopy}>
            <Text style={styles.userName}>{profile?.full_name || 'Student'}</Text>
            <Text style={commonStyles.label}>Student</Text>
          </View>
          <Ionicons name="notifications-outline" size={21} color={palette.ink} />
        </View>
        <Text style={[commonStyles.title, styles.homeTitle]}>
          What will you{`\n`}master today?
        </Text>
        <SampleRecommendation />
        {realModules.length === 0 ? (
          <Text style={commonStyles.body}>Learning modules are being prepared.</Text>
        ) : (
          <>
            <View style={styles.streak}>
              <Text style={commonStyles.label}>📚 {realModules.length} modules</Text>
              <Text style={commonStyles.label}>Start learning</Text>
            </View>
            <SectionTitle title="Your learning path" action="View all" />
            <View style={styles.miniModules}>
              {realModules.slice(0, 2).map((module) => (
                <Pressable key={module.id} onPress={() => router.push(`/learn/module/${module.id}`)}>
                  <ToneCard tone="mint" style={styles.mini}>
                    <Text style={styles.moduleTitle}>{module.title}</Text>
                  </ToneCard>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </Screen>
    </StudentShell>
  );
}

export function LearnView() {
  const router = useRouter();
  const { modules: realModules, isLoading, error } = useModules();
  return <StudentShell><Screen><Header title="Learning path" />
    <SampleRecommendation />
    <Text style={commonStyles.heading}>More to learn</Text>
    {isLoading ? <Text style={commonStyles.body}>Loading modules...</Text> : error ? <Text accessibilityRole="alert" style={commonStyles.body}>{describeSupabaseError(error)}</Text> : realModules.length === 0 ? <Text style={commonStyles.body}>Learning modules are being prepared.</Text> :
      <View style={styles.moduleList}>{realModules.map(module => <Pressable key={module.id} onPress={() => router.push(`/learn/module/${module.id}`)}>
        <View style={styles.moduleItem}><Text style={styles.moduleTitle}>{module.title}</Text><Text style={commonStyles.label}>{module.estimated_minutes} min</Text></View>
      </Pressable>)}</View>}
    <View style={{ marginTop: 28 }}><CurriculumPlan /></View>
  </Screen></StudentShell>;
}
export function ModuleView({ moduleId }: { moduleId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { module, isLoading, error } = useModule(moduleId || null);
  const { lessons, isLoading: lessonsLoading, error: lessonsError } = useLessons(moduleId || null);
  const { progress, isLoading: progressLoading, error: userProgressError } = useUserLessonProgress(user?.id || null);

  if (isLoading) {
    return (
      <Screen>
        <Header title="Module details" back />
        <Text style={commonStyles.body}>Loading module...</Text>
      </Screen>
    );
  }

  if (error || !module) {
    return (
      <Screen>
        <Header title="Module details" back />
        <Text style={commonStyles.title}>Module not found</Text>
        <Text style={commonStyles.body}>{error ? describeSupabaseError(error) : 'This module is unavailable. Please return to your learning path.'}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Module details" back />
      <ToneCard tone="mint" style={styles.wideArt}>
        <Text style={styles.wideMark}>M</Text>
      </ToneCard>
      <Text style={commonStyles.heading}>{module.title}</Text>
      <Text style={commonStyles.body}>{module.description}</Text>
      <View style={styles.meta}>
        <Text>
          Beginner{`\n`}
          <Text style={styles.metaLabel}>Level</Text>
        </Text>
        <Text>
          {module.estimated_minutes} min{`\n`}
          <Text style={styles.metaLabel}>Duration</Text>
        </Text>
        <Text>
          {lessons.length}{`\n`}
          <Text style={styles.metaLabel}>Lessons</Text>
        </Text>
      </View>
      {userProgressError ? <Text style={styles.error}>{describeSupabaseError(userProgressError)}</Text> : null}
      {lessonsError ? <Text style={styles.error}>{describeSupabaseError(lessonsError)}</Text> : lessonsLoading ? (
        <Text style={commonStyles.body}>Loading lessons...</Text>
      ) : lessons.length === 0 ? (
        <Text style={commonStyles.body}>No lessons available in this module.</Text>
      ) : (
        <>
          {lessons.map((lesson, index) => (
            <View key={lesson.id} style={styles.stage}>
              <View style={styles.stageNumber}>
                <Text>{index + 1}</Text>
              </View>
              <View>
                <Text style={styles.moduleTitle}>{lesson.title}</Text>
                <Text style={commonStyles.label}>
                  {progressLoading ? 'Loading progress...' : userProgressError ? 'Progress unavailable' : progress.some((item) => item.lesson_id === lesson.id && item.is_completed)
                    ? 'Completed'
                    : 'Available'}
                </Text>
              </View>
            </View>
          ))}
          <PrimaryButton
            title="Start module"
            onPress={() => {
              const firstLesson = lessons[0];
              if (firstLesson) router.push(`/learn/lesson/${firstLesson.id}`);
            }}
          />
        </>
      )}
    </Screen>
  );
}

export function LessonView({ lessonId }: { lessonId?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { lesson, isLoading, error } = useLesson(lessonId || null);
  const { lessonProgress, isLoading: progressLoading, error: progressError } = useLessonProgress(user?.id || null, lessonId || null);
  const { mutate: completeLesson, isLoading: isCompleting } = useCompleteLessonMutation();
  const [completedKey, setCompletedKey] = useState('');
  const [completionError, setCompletionError] = useState('');
  const completionKey = JSON.stringify([user?.id, lessonId]);
  const completed = completedKey === completionKey || Boolean(lessonProgress && lessonProgress.lesson_id === lessonId && lessonProgress.user_id === user?.id && lessonProgress.is_completed);



  const handleComplete = async () => {
    if (!user?.id || !lessonId || isCompleting || progressLoading || progressError) return;
    setCompletionError('');
    try {
      await completeLesson(user.id, lessonId);
      setCompletedKey(completionKey);
    } catch (err) {
      setCompletionError(describeSupabaseError(err));
    }
  };

  if (isLoading) {
    return (
      <Screen>
        <Header title="Lesson" back />
        <Text style={commonStyles.body}>Loading lesson...</Text>
      </Screen>
    );
  }

  if (error || !lesson) {
    return (
      <Screen>
        <Header title="Lesson" back />
        <Text style={commonStyles.title}>Lesson not found</Text>
        <Text style={commonStyles.body}>{error ? describeSupabaseError(error) : 'This lesson is unavailable. Please return to your learning path.'}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Lesson" back />
      <ToneCard tone="blue" style={styles.lessonArt}>
        <Ionicons name="book-outline" size={42} />
      </ToneCard>
      <Text style={styles.tag}>{lesson.title.toUpperCase()}</Text>
      <Text style={commonStyles.heading}>{lesson.title}</Text>
      <Text style={styles.lessonText}>{lesson.summary || lesson.content}</Text>
      {lesson.content && (
        <>
          <Text style={styles.subheading}>Details</Text>
          <Text style={styles.lessonText}>{lesson.content}</Text>
        </>
      )}
      {completionError ? <Text style={styles.error}>{completionError}</Text> : null}
      {progressLoading ? <Text style={commonStyles.body}>Loading saved progress...</Text> : progressError ? <Text style={styles.error}>{describeSupabaseError(progressError)}</Text> : !completed ? (
        <PrimaryButton
          title={isCompleting ? 'Marking complete...' : 'Complete lesson'}
          onPress={handleComplete}
          disabled={isCompleting}
        />
      ) : (
        <>
          <View style={styles.bigIcon}>
            <Ionicons name="checkmark-circle-outline" size={52} color={palette.teal} />
          </View>
          <Text style={[commonStyles.heading, styles.center]}>Lesson completed!</Text>
          <PrimaryButton title="Back to module" onPress={() => router.back()} />
        </>
      )}
    </Screen>
  );
}

export function ExplanationView() {
  const router = useRouter();
  const [mode, setMode] = useState<'Simple' | 'Detailed' | 'Example'>('Simple');
  const explanation = {
    Simple: 'A budget is a plan for your money. List what you can use, then plan important costs before optional spending.',
    Detailed: 'Choose a period, such as one month. Add the money available for that period and list each planned cost once. Subtract the costs from the money available. Review the plan when an amount changes.',
    Example: 'Chipo has K1,500 for a fictional month. Food, transport, data and study materials total K1,300. Her plan leaves K200 before any new costs.',
  };
  return <Screen><Header title="Budget explained" back /><ToneCard tone="lilac" style={styles.aiHero}><Ionicons name="bulb-outline" size={24} /><Text style={styles.moduleTitle}>Understanding budgets</Text></ToneCard><View accessibilityRole="tablist" style={styles.segment}>{(['Simple', 'Detailed', 'Example'] as const).map(item => <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === item }} key={item} onPress={() => setMode(item)} style={[styles.segmentItem, mode === item && styles.segmentSelected]}><Text>{item}</Text></Pressable>)}</View><Text style={commonStyles.heading}>What is a budget?</Text><Text style={styles.lessonText}>{explanation[mode]}</Text><PrimaryButton title="Review budgeting lesson" onPress={() => router.push('/learn/lesson/sample-budgeting-1')} /><PrimaryButton title="Save explanation · Coming soon" tone="outline" disabled /></Screen>;
}

// Older activity links open the complete lesson, where responses and feedback stay together.
function BudgetingLessonLink() { return <Redirect href="/learn/lesson/sample-budgeting-1" />; }
export const ScenarioView = BudgetingLessonLink;
export const FeedbackView = BudgetingLessonLink;
export const ActivityView = BudgetingLessonLink;
export const QuizView = BudgetingLessonLink;
export const ResultView = BudgetingLessonLink;

export function BudgetView() {
  const router = useRouter();
  const [extraExpenses, setExtraExpenses] = useState<number[]>([]);
  const expenseTotal = 1620 + extraExpenses.reduce((total, amount) => total + amount, 0);
  const available = 2400 - expenseTotal;
  const money = (amount: number) => (amount < 0 ? '-K' : 'K') + Math.abs(amount).toLocaleString('en-ZM');
  const examples = [
    { id: 'allowance', title: 'Allowance', amount: 1500, income: true },
    { id: 'work', title: 'Part-time work', amount: 900, income: true },
    { id: 'food', title: 'Food', amount: 500, income: false },
    { id: 'transport', title: 'Transport', amount: 320, income: false },
    { id: 'materials', title: 'Study materials', amount: 360, income: false },
    { id: 'data', title: 'Data & Wi-Fi', amount: 200, income: false },
    { id: 'optional', title: 'Optional spending', amount: 240, income: false },
    ...extraExpenses.map((amount, index) => ({ id: 'extra-' + index, title: 'Extra expense', amount, income: false })),
  ];
  return <StudentShell><Screen><Header title="Monthly budget" action={<Pressable accessibilityRole="button" accessibilityLabel="Explore an example entry" onPress={() => router.push('/budget/add')}><Ionicons name="add-circle-outline" size={25} color={palette.ink} /></Pressable>} /><Text style={commonStyles.heading}>Example budget</Text><Text style={commonStyles.body}>Explore a fictional month. Changes to this example reset when you leave.</Text><ToneCard tone="blush" style={styles.balance}><Text style={commonStyles.label}>AVAILABLE AFTER EXPENSES</Text><Text style={styles.balanceAmount}>{money(available)}</Text><Text style={commonStyles.label}>K2,400 income − {money(expenseTotal)} expenses</Text><ProgressBar value={Math.min(100, expenseTotal / 2400 * 100)} /></ToneCard><SectionTitle title="Example entries" />{examples.map(entry => <View key={entry.id} style={styles.entry}><Ionicons name={entry.income ? 'cash-outline' : 'cart-outline'} size={20} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>{entry.title}</Text><Text style={commonStyles.label}>This example month</Text></View><Text style={[styles.moduleTitle, entry.income && styles.positive]}>{entry.income ? '+' : '-'}{money(entry.amount)}</Text></View>)}<PrimaryButton title="Try an extra K120 expense" onPress={() => setExtraExpenses(current => [...current, 120])} /><PrimaryButton title="View example breakdown" tone="outline" onPress={() => router.push('/budget/summary')} /><Text style={styles.noticeText}>Saving your own budget is coming soon.</Text></Screen></StudentShell>;
}

export function AddEntryView() {
  const [kind, setKind] = useState('Income');
  const [amount, setAmount] = useState('500');
  const [note, setNote] = useState('Family allowance');
  const [category, setCategory] = useState('Allowance');
  const [repeats, setRepeats] = useState(false);
  return <Screen><Header title="Example entry" back /><Text style={commonStyles.body}>Explore the details of a budget entry. Saving personal entries is coming soon.</Text><View style={styles.segment}>{['Income', 'Expense'].map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: kind === item }} onPress={() => setKind(item)} style={[styles.segmentItem, kind === item && styles.segmentSelected]}><Text>{item}</Text></Pressable>)}</View><Field label="Amount (K)" value={amount} onChangeText={setAmount} /><Field label="Category" value={category} onChangeText={setCategory} /><Field label="Source or note" value={note} onChangeText={setNote} /><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: repeats }} style={styles.checkbox} onPress={() => setRepeats(value => !value)}><Ionicons name={repeats ? 'checkbox' : 'square-outline'} size={20} color={palette.ink} /><Text>Repeats each month</Text></Pressable><ToneCard tone="mint" style={styles.notice}><Ionicons name="repeat-outline" size={20} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>{kind === 'Income' ? 'Plan money coming in' : 'Plan a cost'}</Text><Text style={commonStyles.label}>Use the same period for your income and expenses.</Text></View></ToneCard><PrimaryButton title="Save entry · Coming soon" disabled /></Screen>;
}

export function BudgetSummaryView() {
  const router = useRouter();
  return <Screen><Header title="Budget breakdown" back /><Text style={commonStyles.heading}>An example month</Text><Text style={commonStyles.body}>The original example has K2,400 income and K1,620 planned expenses.</Text><View style={styles.donut}><View style={styles.donutInner}><Text style={styles.moduleTitle}>K1,620</Text><Text style={commonStyles.label}>Total expenses</Text></View></View>{[['Essentials', 'K1,180', palette.teal], ['Optional', 'K240', '#dca5be'], ['Data & Wi-Fi', 'K200', '#e7b65e']].map(([title, amount, color]) => <View key={title} style={styles.legend}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={{ flex: 1 }}>{title}</Text><Text style={styles.moduleTitle}>{amount}</Text></View>)}<View style={styles.total}><Text>Unallocated balance</Text><Text style={styles.amount}>K780</Text></View><PrimaryButton title="Explore an example entry" tone="outline" onPress={() => router.push('/budget/add')} /><Text style={styles.noticeText}>Your personal spending breakdown is coming soon.</Text></Screen>;
}

export function ProgressView() {
  const { user } = useAuth();
  const { progress, isLoading, error } = useUserLessonProgress(user?.id ?? null);
  const local = useSampleProgress();
  const completedIds = new Set(progress.filter(lesson => lesson.is_completed).map(lesson => lesson.lesson_id));
  for (const lesson of authoredLessons) if (local.progress.lessons[lesson.id]?.completed) completedIds.add(lesson.id);
  const completed = completedIds.size;
  return <StudentShell><Screen><Header title="Your progress" /><SampleRecommendation /><SectionTitle title="Completed lessons" />{isLoading || local.loading ? <Text style={commonStyles.body}>Loading your progress...</Text> : error || local.error ? <Text accessibilityRole="alert" style={styles.error}>{error ? describeSupabaseError(error) : local.error}</Text> : <ToneCard tone="mint"><Text style={styles.moduleTitle}>{completed} completed {completed === 1 ? 'lesson' : 'lessons'}</Text><Text style={commonStyles.body}>{completed ? 'Keep building on what you have learned.' : 'Complete a lesson to start building your learning record.'}</Text></ToneCard>}<Text style={[commonStyles.body, { marginTop: spacing.md }]}>Badges and learning streaks are coming soon.</Text></Screen></StudentShell>;
}

export function SavedExplanationsView() {
  const router = useRouter();
  return <StudentShell><Screen><Header title="Saved explanations" back /><ToneCard tone="lilac" style={styles.notice}><Ionicons name="bookmark-outline" size={24} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>Save explanations for later</Text><Text style={commonStyles.body}>Coming soon. For now, reopen a lesson to review its definitions and examples.</Text></View></ToneCard><PrimaryButton title="Explore lessons" onPress={() => router.push('/learn')} /></Screen></StudentShell>;
}

export function ProfileView() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { profile, isLoading, error } = useProfile();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const initials = (profile?.full_name ?? user?.email ?? 'U').slice(0, 2).toUpperCase();
  const logOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true); setSignOutError('');
    try {
      const result = await signOut();
      if (result.error) setSignOutError('We could not log you out. Please try again.');
    } catch { setSignOutError('We could not log you out. Please try again.'); }
    finally { setIsSigningOut(false); }
  };
  return <StudentShell><Screen><View style={styles.profile}><View style={styles.profileAvatar}><Text>{initials}</Text></View><Text style={commonStyles.heading}>{profile?.full_name ?? 'Your profile'}</Text><Text style={commonStyles.body}>{user?.email ?? 'Your account'}</Text></View>{isLoading ? <Text style={commonStyles.body}>Loading profile...</Text> : null}{error ? <Text accessibilityRole="alert" style={styles.error}>{describeSupabaseError(error, 'Your profile could not be loaded. Please try again.')}</Text> : null}<Pressable accessibilityRole="button" style={styles.savedItem} onPress={() => router.push('/progress')}><Ionicons name="bar-chart-outline" size={20} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>Learning progress</Text><Text style={commonStyles.label}>Review your lessons</Text></View><Ionicons name="chevron-forward" size={17} color={palette.muted} /></Pressable><Pressable accessibilityRole="button" style={styles.savedItem} onPress={() => router.push('/saved-explanations')}><Ionicons name="bookmark-outline" size={20} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>Saved explanations</Text><Text style={commonStyles.label}>Coming soon</Text></View><Ionicons name="chevron-forward" size={17} color={palette.muted} /></Pressable><View style={styles.savedItem}><Ionicons name="notifications-outline" size={20} /><View style={{ flex: 1 }}><Text style={styles.moduleTitle}>Learning reminders</Text><Text style={commonStyles.label}>Coming soon</Text></View></View>{signOutError ? <Text accessibilityRole="alert" style={styles.error}>{signOutError}</Text> : null}<PrimaryButton title={isSigningOut ? 'Logging out...' : 'Log out'} tone="outline" disabled={isSigningOut} onPress={() => { void logOut(); }} /></Screen></StudentShell>;
}

const styles = StyleSheet.create({
  error: { color: '#a44a4a', fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  moduleTitle: { color: palette.ink, fontSize: 13, fontWeight: '500' },
  moduleItem: { padding: spacing.md, borderRadius: radii.md, backgroundColor: palette.mint, marginBottom: spacing.sm },
  wideValue: { color: palette.ink, fontSize: 24, fontWeight: '500' },
  welcome: { flex: 1, justifyContent: 'flex-end', paddingBottom: 28 }, brand: { position: 'absolute', top: 20, left: 0, color: palette.ink, fontSize: 13, letterSpacing: 3 }, hero: { alignSelf: 'center', width: 215, height: 215, marginBottom: spacing.xl, borderRadius: 110, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' }, heroMark: { color: palette.ink, fontSize: 48, fontWeight: '500', transform: [{ rotate: '8deg' }], backgroundColor: palette.blue, paddingHorizontal: 35, paddingVertical: 15, borderRadius: 18 }, heroDot: { position: 'absolute', right: 24, top: 30, width: 38, height: 38, borderRadius: 20, backgroundColor: '#e7b65e' }, welcomeBody: { marginTop: 12, marginBottom: 16 }, centerLink: { color: palette.muted, textAlign: 'center', fontSize: 11, marginTop: 15 }, boldLink: { color: palette.ink, fontWeight: '500' }, form: { marginTop: spacing.xl }, rightLink: { color: palette.muted, fontSize: 11, textAlign: 'right', marginVertical: 2 }, step: { color: palette.muted, fontSize: 11, marginBottom: 8 }, tag: { alignSelf: 'flex-start', color: palette.ink, backgroundColor: palette.blush, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, letterSpacing: 1, marginVertical: spacing.md }, equation: { marginVertical: spacing.md, alignItems: 'center' }, equationText: { color: palette.ink, fontSize: 13, lineHeight: 22, textAlign: 'center' }, option: { minHeight: 48, borderRadius: radii.sm, borderWidth: 1, borderColor: '#d9d4d6', paddingHorizontal: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }, selectedOption: { borderColor: palette.ink, backgroundColor: palette.lilac }, optionText: { fontSize: 13, color: palette.ink }, optionLetter: { width: 25, height: 25, borderRadius: 13, textAlign: 'center', paddingTop: 4, backgroundColor: '#ece8ea' }, bigIcon: { alignSelf: 'center', width: 114, height: 114, marginTop: 42, marginBottom: 15, borderRadius: 36, backgroundColor: palette.lilac, alignItems: 'center', justifyContent: 'center' }, center: { textAlign: 'center' }, scoreRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingVertical: 14, marginVertical: spacing.md }, score: { flex: 1, alignItems: 'center' }, scoreValue: { color: palette.ink, fontSize: 18, fontWeight: '500' }, scoreLabel: { color: palette.muted, fontSize: 10, marginTop: 3 }, userBar: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 20, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center' }, userCopy: { flex: 1 }, userName: { color: palette.ink, fontSize: 13, fontWeight: '500' }, homeTitle: { marginTop: 24 }, streak: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 }, course: { minHeight: 188, marginTop: 18, overflow: 'hidden' }, courseEyebrow: { color: palette.muted, fontSize: 9 }, courseTitle: { position: 'absolute', left: 16, bottom: 28, color: palette.ink, fontSize: 18, fontWeight: '500' }, courseDetail: { position: 'absolute', left: 16, bottom: 12, color: palette.muted, fontSize: 10 }, courseArt: { position: 'absolute', right: 24, top: 48, width: 112, height: 72, borderRadius: 16, backgroundColor: palette.teal, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '7deg' }] }, courseMark: { fontSize: 38, color: palette.ink }, miniModules: { flexDirection: 'row', gap: 9 }, mini: { flex: 1, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 7 }, streakPill: { color: palette.ink, backgroundColor: palette.peach, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 7, fontSize: 10 }, moduleList: { marginTop: spacing.lg }, wideArt: { minHeight: 155, marginBottom: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 }, wideMark: { fontSize: 30, backgroundColor: palette.blush, paddingHorizontal: 25, paddingVertical: 10, borderRadius: 13, transform: [{ rotate: '7deg' }] }, meta: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 14, paddingVertical: 11, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, textAlign: 'center' }, metaLabel: { color: palette.muted, fontSize: 9 }, stage: { minHeight: 53, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: palette.line }, stageNumber: { width: 29, height: 29, borderRadius: 15, backgroundColor: palette.ink, alignItems: 'center', justifyContent: 'center' }, lessonArt: { minHeight: 110, alignItems: 'center', justifyContent: 'center', marginVertical: 12 }, lessonText: { color: palette.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 }, subheading: { color: palette.ink, fontSize: 14, fontWeight: '500', marginTop: 6, marginBottom: 5 }, aiStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 12 }, aiHero: { flexDirection: 'row', alignItems: 'center', gap: 10 }, segment: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.pill, backgroundColor: '#ece8ea', marginVertical: 16 }, segmentItem: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radii.pill }, segmentSelected: { backgroundColor: palette.surface }, notice: { flexDirection: 'row', alignItems: 'center', gap: 9, marginVertical: 14 }, budgetSummary: { marginVertical: 12 }, amount: { color: palette.ink, fontSize: 25, fontWeight: '500' }, entry: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderColor: palette.line }, total: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#ece8ea', borderRadius: 14, marginVertical: 14 }, balance: { marginVertical: 16 }, balanceAmount: { color: palette.ink, fontSize: 30, fontWeight: '500', marginVertical: 5 }, positive: { color: '#367668' }, checkbox: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 38 }, donut: { alignSelf: 'center', width: 170, height: 170, borderRadius: 90, marginVertical: 14, backgroundColor: palette.teal, alignItems: 'center', justifyContent: 'center' }, donutInner: { width: 112, height: 112, borderRadius: 60, backgroundColor: palette.canvas, alignItems: 'center', justifyContent: 'center' }, legend: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 }, dot: { width: 9, height: 9, borderRadius: 5 }, noticeText: { color: palette.muted, backgroundColor: '#ece8ea', padding: 11, borderRadius: 13, fontSize: 12, lineHeight: 17, marginVertical: 10 }, resultRing: { alignSelf: 'center', width: 142, height: 142, borderRadius: 72, borderWidth: 15, borderColor: palette.teal, marginTop: 45, marginBottom: 18, alignItems: 'center', justifyContent: 'center' }, resultValue: { color: palette.ink, fontSize: 30, fontWeight: '500' }, chart: { height: 130, marginVertical: 15, borderBottomWidth: 1, borderColor: '#cfc9cc', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingHorizontal: 15 }, chartBar: { width: 25, borderRadius: 8, backgroundColor: '#dca5be' }, savedItem: { minHeight: 65, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderColor: palette.line }, profile: { alignItems: 'center', marginVertical: 24 }, profileAvatar: { width: 78, height: 78, borderRadius: 40, backgroundColor: palette.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
});