import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, usePalette, themedStyles } from '@/constants/finlit-theme';
import { curriculum, STAGE_TITLES, money, numericAnswer, allocationValues, allocationReview, validPractice, score, transition, type LessonContent, type LessonRecord, type Question } from '@/content/learning';

export function LearningButton({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const styles = useStyles();

  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, disabled && styles.disabled, pressed && styles.pressed]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
export function QuestionCard({ question, answer, reveal = false, disabled = false, onAnswer }: {
  question: Question; answer: number | null; reveal?: boolean; disabled?: boolean; onAnswer: (answer: number) => void;
}) {
  const styles = useStyles();

  const correct = answer === question.correct;
  return <View style={styles.stack}>
    <Text accessibilityRole="header" style={styles.heading}>{question.prompt}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={question.prompt} style={styles.stack}>
      {question.options.map((option, index) => <Pressable key={option.text} accessibilityRole="radio"
        accessibilityState={{ checked: answer === index, disabled: disabled || reveal }} disabled={disabled || reveal}
        onPress={() => onAnswer(index)} style={[styles.option, answer === index && styles.selected]}>
        <Text style={styles.optionMarker}>{answer === index ? '●' : '○'}</Text><Text style={styles.optionText}>{option.text}</Text>
      </Pressable>)}
    </View>
    {reveal && answer !== null && <View accessibilityLiveRegion="polite" style={[styles.card, correct ? styles.success : styles.caution]}>
      <Text style={styles.subheading}>{correct ? '✓ Correct' : '↻ Let’s work through it'}</Text>
      <Text style={styles.body}>{question.options[answer].feedback}</Text>
      <Text style={styles.body}>{question.explanation}</Text>
    </View>}
  </View>;
}
function DefinitionCard({ definition }: { definition: LessonContent['concept']['definitions'][number] }) {
  const styles = useStyles();

  const [expanded, setExpanded] = useState(false);
  return <View style={styles.card}>
    <Text style={styles.subheading}>{definition.term}</Text><Text style={styles.body}>{definition.meaning}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.textButton}>
      <Text style={styles.link}>{expanded ? 'Less detail −' : 'Explore this term +'}</Text>
    </Pressable>
    {expanded && <Text style={styles.body}>{definition.detail}</Text>}
  </View>;
}
export function LessonPlayer({ lesson, record, saving, saveError, saved, onSave, onRetrySave, onReload, onExit, onAction, onNext }: {
  lesson: LessonContent; record: LessonRecord; saving: boolean; saveError: string; saved: boolean;
  onSave: (record: LessonRecord) => Promise<boolean>; onRetrySave: () => Promise<boolean>; onReload: () => void; onExit: () => void; onAction?: () => void; onNext?: () => void;
}) {
  const styles = useStyles();
  const palette = usePalette();

  const [draft, setDraft] = useState(record);
  const [showRecap, setShowRecap] = useState(false);
  const scroll = useRef<ScrollView>(null);
  useEffect(() => { setDraft(record); }, [record]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [record.stage, record.checkpointIndex]);
  const module = curriculum.find(item => item.id === lesson.moduleId);
  const moduleIndex = module ? curriculum.indexOf(module) : -1;
  const lessonIndex = module?.lessons.findIndex(item => item.id === lesson.id) ?? -1;
  const nextLesson = module?.lessons[lessonIndex + 1];
  const stage = record.stage;
  const blocked = saving || !!saveError;
  const practiceValue = numericAnswer(record.practice);
  const allocation = allocationReview(lesson, record.practice);
  const draftAllocation = allocationReview(lesson, draft.practice);
  const practiceCorrect = lesson.practice.kind === 'allocation' ? allocation.correct : practiceValue === lesson.practice.correct;
  const total = lesson.example.rows.reduce((sum, row) => sum + row.amount, 0);
  const qIndex = record.checkpointIndex;
  const question = lesson.checkpoint[qIndex];
  const complete = record.completed && stage === 6;
  const commit = (action: Parameters<typeof transition>[2]) => { void onSave(transition(lesson, draft, action)); };
  const close = async () => {
    if (blocked) return;
    if (JSON.stringify(draft) === JSON.stringify(record) || await onSave(draft)) onExit();
  };
  let primary = ['Explore the concept', 'Show worked example', 'Try the practice', 'Check answer', 'Start checkpoint', 'Check answer', 'Complete lesson'][stage];
  let disabled = blocked;
  let action: Parameters<typeof transition>[2] = { type: 'next' };
  if (stage === 3) {
    primary = record.practiceSubmitted ? 'View feedback' : 'Check answer';
    action = { type: record.practiceSubmitted ? 'next' : 'submit-practice' };
    disabled ||= !record.practiceSubmitted && !validPractice(lesson, draft.practice);
  }
  if (stage === 5) {
    const checked = record.checked[qIndex];
    primary = checked ? qIndex === 2 ? 'View lesson summary' : 'Next question' : 'Check answer';
    action = { type: checked ? 'next' : 'check-answer' };
    disabled ||= !checked && draft.answers[qIndex] === null;
  }
  if (stage === 6) action = { type: 'finish' };
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Save and close lesson" disabled={blocked} onPress={() => void close()} style={styles.close}>
            <Ionicons name="close" size={24} color={palette.ink} />
          </Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>MODULE {moduleIndex + 1} · LESSON {lessonIndex + 1} OF {module?.lessons.length ?? 4}</Text><Text style={styles.headerTitle}>{lesson.title}</Text></View>
          {record.completed && <Ionicons accessibilityLabel="Lesson completed to your account" name="checkmark-circle" size={24} color={palette.purple} />}
        </View>
        <View accessible accessibilityRole="progressbar" accessibilityLabel={'Lesson stages. ' + STAGE_TITLES[stage]}
          accessibilityValue={{ min: 1, max: 7, now: stage + 1, text: 'Stage ' + (stage + 1) + ' of 7' }} style={styles.segments}>
          {STAGE_TITLES.map((title, index) => <View key={title} style={[styles.segment, index <= record.maxStage && styles.segmentDone, index === stage && styles.segmentCurrent]} />)}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.meta}>Stage {stage + 1} of 7 · {STAGE_TITLES[stage]}{record.completed ? ' · Review available' : ''}</Text>
      </View>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {stage === 0 && <View style={styles.stack}>
          <Text style={styles.eyebrow}>START WITH A REALISTIC SITUATION</Text>
          <Text accessibilityRole="header" style={styles.title}>{lesson.situation.title}</Text>
          <Text style={styles.body}>{lesson.situation.body}</Text>
          {lesson.situation.figures.length > 0 && <View style={[styles.card, styles.lilac]}>{lesson.situation.figures.map(figure => <View key={figure.label} style={styles.figure}><Text style={styles.body}>{figure.label}</Text><Text style={styles.amount}>{figure.value}</Text></View>)}</View>}
          <Text style={styles.subheading}>{lesson.situation.reflection}</Text><Text style={styles.meta}>Pause and choose · This reflection is not graded.</Text>
          {lesson.situation.choices.map((choice, i) => <Pressable key={choice} accessibilityRole="radio" accessibilityState={{ checked: draft.reflection === i, disabled: blocked }}
            disabled={blocked} onPress={() => setDraft({ ...draft, reflection: i })} style={[styles.option, draft.reflection === i && styles.selected]}><Text style={styles.optionText}>{draft.reflection === i ? '● ' : '○ '}{choice}</Text></Pressable>)}
          {draft.reflection !== null && <Text style={styles.body}>Keep that thought as you explore the situation. You can change your view as you learn.</Text>}
        </View>}
        {stage === 1 && <View style={styles.stack}><Text accessibilityRole="header" style={styles.title}>{lesson.concept.title}</Text><Text style={styles.body}>{lesson.concept.introduction}</Text>
          {lesson.concept.definitions.map(definition => <DefinitionCard key={definition.term} definition={definition} />)}
          <View style={[styles.card, styles.lilac]}><Text style={styles.subheading}>Put it together</Text><Text style={styles.body}>{lesson.concept.takeaway}</Text></View>
        </View>}
        {stage === 2 && <View style={styles.stack}><Text accessibilityRole="header" style={styles.title}>{lesson.example.title}</Text><Text style={styles.body}>{lesson.example.introduction}</Text>
          <>{lesson.example.showBudgetTable !== false && <View style={styles.card}><View style={styles.figure}><Text style={styles.subheading}>Money available</Text><Text style={styles.amount}>{money(lesson.example.income)}</Text></View>
            {lesson.example.rows.map(row => <View key={row.label} style={styles.tableRow}><Text style={styles.body}>{row.label}</Text><Text style={styles.subheading}>{money(row.amount)}</Text></View>)}
            <View style={styles.tableRow}><Text style={styles.subheading}>Total planned expenses</Text><Text style={styles.subheading}>{money(total)}</Text></View>
            <View style={[styles.figure, styles.balance]}><Text style={styles.subheading}>Remaining balance</Text><Text style={styles.amount}>{money(lesson.example.income - total)}</Text></View>
          </View>}</>
          {lesson.example.steps.map((step, i) => <View key={step} style={styles.step}><Text style={styles.stepNumber}>{i + 1}</Text><Text style={styles.stepText}>{step}</Text></View>)}
        </View>}
        {stage === 3 && <View style={styles.stack}><Text style={styles.eyebrow}>YOUR TURN · NO PASS MARK</Text><Text accessibilityRole="header" style={styles.title}>{lesson.practice.prompt}</Text><Text style={styles.body}>{lesson.practice.context}</Text>
          {lesson.practice.kind === 'allocation' ? <View style={styles.stack}>{lesson.practice.allocation?.fields.map(field => <View key={field.id} style={styles.card}><Text style={styles.subheading}>{field.label} (K)</Text><Text style={styles.meta}>Immediate need: at least {money(field.minimum)}</Text><TextInput accessibilityLabel={field.label + ' allocation in kwacha'} value={allocationValues(draft.practice)[field.id] ?? ''} placeholder="Enter amount" keyboardType="decimal-pad" maxLength={12} editable={!blocked && !record.practiceSubmitted} onChangeText={value => setDraft({ ...draft, practice: JSON.stringify({ ...allocationValues(draft.practice), [field.id]: value }) })} style={styles.input} /></View>)}<Text accessibilityLiveRegion="polite" style={styles.subheading}>Allocated: {money(draftAllocation.total)} · {draftAllocation.remaining < 0 ? 'Shortfall: ' + money(-draftAllocation.remaining) : 'Unallocated: ' + money(draftAllocation.remaining)}</Text><Text style={styles.meta}>Enter a non-negative amount in every category. Check your plan to review the consequences.</Text></View> : lesson.practice.kind === 'choice' ? <View style={styles.stack}>{lesson.practice.options?.map((option, i) => <Pressable key={option.text} accessibilityRole="radio" accessibilityState={{ checked: draft.practice === String(i), disabled: blocked || record.practiceSubmitted }} disabled={blocked || record.practiceSubmitted} onPress={() => setDraft({ ...draft, practice: String(i) })} style={[styles.option, draft.practice === String(i) && styles.selected]}><Text style={styles.optionText}>{draft.practice === String(i) ? '● ' : '○ '}{option.text}</Text></Pressable>)}</View> : <View style={styles.card}><Text style={styles.subheading}>Your answer ({lesson.practice.unit})</Text>
            <TextInput accessibilityLabel={lesson.practice.prompt + ' (kwacha)'} placeholder="Enter an amount, for example 50" placeholderTextColor={palette.muted}
              value={draft.practice} editable={!blocked && !record.practiceSubmitted} maxLength={12} keyboardType="decimal-pad" returnKeyType="done"
              onChangeText={practice => setDraft({ ...draft, practice })} style={styles.input} />
            <Text style={styles.meta}>{record.practiceSubmitted ? 'Answer already checked. Continue to see the feedback.' : 'Use a number without K or commas. Your answer is saved when you check it or leave this step.'}</Text>
            {draft.practice !== '' && !validPractice(lesson, draft.practice) && <Text accessibilityRole="alert" style={styles.error}>Enter a non-negative amount with up to two decimal places.</Text>}
          </View>}<Text style={styles.body}>Hint: {lesson.practice.hint}</Text>
        </View>}
        {stage === 4 && <View style={styles.stack}>
          <View style={[styles.card, practiceCorrect ? styles.success : styles.caution]}><Text style={styles.feedbackSymbol}>{practiceCorrect ? '✓' : '↻'}</Text>
            <Text accessibilityRole="header" style={styles.title}>{practiceCorrect ? lesson.practice.feedback.correctTitle : lesson.practice.feedback.incorrectTitle}</Text>
            <Text style={styles.subheading}>Your answer: {lesson.practice.kind === 'allocation' ? money(allocation.total) + ' allocated' : lesson.practice.kind === 'choice' ? lesson.practice.options?.[practiceValue ?? 0]?.text : money(practiceValue ?? 0)}</Text>
            <Text style={styles.body}>{lesson.practice.kind === 'allocation' ? allocation.feedback : lesson.practice.kind === 'choice' ? lesson.practice.options?.[practiceValue ?? 0]?.feedback : practiceCorrect ? lesson.practice.feedback.correct : practiceValue !== null && practiceValue < lesson.practice.correct ? lesson.practice.feedback.low : lesson.practice.feedback.high}</Text>
          </View>
          <Text style={styles.heading}>What does the result mean?</Text><Text style={styles.body}>{lesson.practice.consequence}</Text>
          {!record.completed && <LearningButton title="Try the practice again" secondary disabled={blocked} onPress={() => commit({ type: 'retry-practice' })} />}
        </View>}
        {stage === 5 && <View style={styles.stack}><Text style={styles.eyebrow}>CHECKPOINT · QUESTION {qIndex + 1} OF 3</Text><Text style={styles.body}>Check your understanding. Every answer gets an explanation; there is no pass mark for this checkpoint.</Text>
          <QuestionCard question={question} answer={draft.answers[qIndex]} reveal={record.checked[qIndex]} disabled={blocked}
            onAnswer={answer => setDraft({ ...draft, answers: draft.answers.map((value, i) => i === qIndex ? answer : value) })} />
        </View>}
        {stage === 6 && <View style={styles.stack}>
          <Text style={styles.eyebrow}>{complete ? 'SAVED TO YOUR ACCOUNT' : 'BRING IT TOGETHER'}</Text>
          <Text accessibilityRole="header" style={styles.title}>{complete ? 'Lesson complete' : lesson.summaryTitle}</Text>
          {complete && <Text accessibilityLiveRegion="polite" style={styles.body}>Your lesson completion is saved to your account. You can come back and review it anytime.</Text>}
          {lesson.takeaways.map(item => <View key={item} style={styles.step}><Text style={styles.stepNumber}>✓</Text><Text style={styles.stepText}>{item}</Text></View>)}
          <View style={[styles.card, styles.lilac]}><Text style={styles.heading}>Checkpoint recap</Text><Text style={styles.body}>{score(lesson, record)} of 3 correct · All 3 answered and reviewed.</Text>
            <Text style={styles.body}>Use the explanations to revisit anything that was unclear.</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showRecap }} style={styles.textButton} onPress={() => setShowRecap(!showRecap)}><Text style={styles.link}>{showRecap ? 'Hide checkpoint answers −' : 'Review checkpoint answers +'}</Text></Pressable>
          {showRecap && lesson.checkpoint.map((q, i) => <QuestionCard key={q.id} question={q} answer={record.answers[i]} reveal onAnswer={() => undefined} />)}
          <View style={styles.card}><Text style={styles.subheading}>{nextLesson ? 'Next: ' + nextLesson.title : 'You reached the last lesson in this module'}</Text><Text style={styles.body}>{nextLesson ? 'Review this lesson or return to the module to explore what’s next.' : 'Return to the module to review your progress.'}</Text></View>
          {complete && onNext && <LearningButton title={nextLesson ? "Next lesson" : "Open module challenge"} onPress={onNext} disabled={blocked} />}
          {complete && lesson.action && onAction && <><Text style={styles.meta}>Optional · Apply this skill using your own information. Learning examples are never added to your budget.</Text><LearningButton title={lesson.action.label} onPress={onAction} disabled={blocked} /></>}
          {complete && <LearningButton title="Review this lesson" secondary disabled={blocked} onPress={() => commit({ type: 'review' })} />}
        </View>}
      </ScrollView>
      <View style={styles.footer}>
        {!!saveError && <View accessibilityRole="alert" style={styles.stack}><Text style={styles.error}>{saveError}</Text><LearningButton title={saveError.includes("another view") ? "Load latest saved progress" : "Retry saving progress"} disabled={saving} onPress={saveError.includes("another view") ? onReload : () => void onRetrySave()} /></View>}
        <Text accessibilityLiveRegion="polite" style={styles.saveStatus}>{saving ? 'Saving to your account…' : saveError ? 'Save pending · Keep this lesson open to retain your answer' : saved ? 'Saved to your account' : 'Your progress saves to your account'}</Text>
        <View style={styles.navigation}>
          {(stage > 0 || (stage === 5 && qIndex > 0)) && <View style={styles.previous}><LearningButton title="Previous" secondary disabled={blocked} onPress={() => commit({ type: 'previous' })} /></View>}
          <View style={styles.next}><LearningButton title={complete ? 'Return to module' : primary} disabled={disabled}
            onPress={complete ? () => void close() : () => commit(action)} /></View>
        </View>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const useStyles = themedStyles(palette => ({
  page: { flex: 1, backgroundColor: palette.canvas }, header: { padding: spacing.md, borderBottomWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, headerCopy: { flex: 1 }, close: { minWidth: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: palette.ink, fontSize: 18, fontWeight: '600', marginTop: 4 }, eyebrow: { color: palette.purple, fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8 },
  segments: { flexDirection: 'row', gap: 5, marginTop: 16, marginBottom: 8 }, segment: { flex: 1, height: 5, borderRadius: 6, backgroundColor: palette.line },
  segmentDone: { backgroundColor: palette.lilac }, segmentCurrent: { backgroundColor: palette.purple },
  scroll: { flex: 1 }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: spacing.lg, gap: 22, paddingBottom: 32 },
  stack: { gap: 14 },
  title: { color: palette.ink, fontSize: 30, lineHeight: 35, fontWeight: '500' }, heading: { color: palette.ink, fontSize: 21, lineHeight: 28, fontWeight: '500' },
  subheading: { color: palette.ink, fontSize: 16, lineHeight: 23, fontWeight: '600' }, body: { color: palette.ink, fontSize: 16, lineHeight: 25 },
  meta: { color: palette.muted, fontSize: 12, lineHeight: 18 }, card: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line, borderRadius: radii.md, padding: 18, gap: 12 },
  lilac: { backgroundColor: palette.lilac, borderColor: palette.lilac }, success: { backgroundColor: palette.mint }, caution: { backgroundColor: palette.peach },
  figure: { gap: 4, paddingVertical: 8 }, amount: { fontSize: 26, lineHeight: 34, color: palette.purple, fontWeight: '600' },
  tableRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', columnGap: 14, paddingVertical: 10, borderBottomWidth: 1, borderColor: palette.line },
  balance: { backgroundColor: palette.lilac, borderRadius: radii.sm, padding: 14 }, step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNumber: { color: palette.purple, fontSize: 16, fontWeight: '700', paddingTop: 3 }, stepText: { flex: 1, color: palette.ink, fontSize: 16, lineHeight: 25 },
  option: { minHeight: 54, padding: 16, borderRadius: radii.sm, borderColor: palette.line, borderWidth: 1, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: palette.surface },
  selected: { borderColor: palette.purple, backgroundColor: palette.lilac }, optionMarker: { fontSize: 18, color: palette.purple }, optionText: { flex: 1, fontSize: 16, lineHeight: 24, color: palette.ink },
  input: { borderWidth: 1, borderColor: palette.line, borderRadius: radii.sm, minHeight: 56, padding: 14, color: palette.ink, fontSize: 18, backgroundColor: palette.surface },
  feedbackSymbol: { color: palette.purple, fontSize: 32 }, textButton: { minHeight: 48, justifyContent: 'center' }, link: { color: palette.purple, fontWeight: '600', fontSize: 15, lineHeight: 23 },
  footer: { padding: spacing.md, gap: 10, backgroundColor: palette.surface, borderTopWidth: 1, borderColor: palette.line },
  saveStatus: { color: palette.muted, fontSize: 11, lineHeight: 16, textAlign: 'center' }, navigation: { flexDirection: 'row', gap: 10 }, previous: { flex: 1 }, next: { flex: 2 },
  button: { minHeight: 50, borderRadius: radii.pill, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.ink },
  secondary: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.line }, buttonText: { color: palette.surface, fontSize: 14, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
  secondaryText: { color: palette.ink }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.75 }, error: { color: palette.error, fontSize: 14, lineHeight: 21 },
}));
