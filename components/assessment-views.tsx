import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Header, PrimaryButton, ProgressBar, Screen, ToneCard } from '@/components/finlit-ui';
import { commonStyles, palette } from '@/constants/finlit-theme';
import { useAuth } from '@/contexts/auth-context';
import { useAvailableAssessment, useAssessmentQuestions } from '@/hooks/use-assessment';
import { useAssessmentAttempt } from '@/hooks/use-assessment-attempt';
import { getAssessmentResults, type AssessmentResult } from '@/services/assessment-attempts';
import { describeSupabaseError } from '@/lib/supabase-diagnostics';

function AssessmentMessage({ title, message }: { title: string; message: string }) {
  return (
    <Screen>
      <Header title="Financial knowledge check" back />
      <Text style={commonStyles.heading}>{title}</Text>
      <Text style={commonStyles.body}>{message}</Text>
    </Screen>
  );
}

export function DiagnosticIntroView() {
  const router = useRouter();
  const { assessment, isLoading, error } = useAvailableAssessment();

  if (isLoading) return <AssessmentMessage title="Loading assessment" message="Checking whether a knowledge check is available." />;
  if (error) return <AssessmentMessage title="Unable to load assessment" message={describeSupabaseError(error)} />;
  if (!assessment) return <AssessmentMessage title="The assessment is not available yet." message="Please check back when your learning programme is ready." />;

  return (
    <Screen>
      <Header title="Financial knowledge check" back />
      <ToneCard tone="blue">
        <Text style={commonStyles.heading}>{assessment.title}</Text>
        <Text style={commonStyles.body}>This short assessment helps establish your current financial-literacy level and provides a starting point for your learning journey.</Text>
      </ToneCard>
      <Text style={commonStyles.body}>Answer each question based on what you currently know. Your results are recorded for your learning journey and are not a clinically validated measurement.</Text>
      <PrimaryButton title="Start assessment" onPress={() => router.push(`/diagnostic-questions?assessmentId=${assessment.id}`)} />
    </Screen>
  );
}

export function AssessmentQuestionsView() {
  const { user } = useAuth();
  const { assessmentId } = useLocalSearchParams<{ assessmentId?: string }>();
  return <AssessmentQuestionsBody key={JSON.stringify([user?.id, assessmentId])} />;
}
function AssessmentQuestionsBody() {
  const router = useRouter();
  const { user } = useAuth();
  const { assessmentId } = useLocalSearchParams<{ assessmentId?: string }>();
  const { questions, optionsByQuestion, isLoading, error } = useAssessmentQuestions(assessmentId || null);
  const { attempt, answers, isStarting, isSaving, isSubmitting, error: attemptError, retry, saveAnswer, submit } = useAssessmentAttempt(user?.id || null, assessmentId || null);
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!assessmentId) return <AssessmentMessage title="Assessment unavailable" message="This assessment link is missing its assessment ID." />;
  if (isLoading || isStarting) return <AssessmentMessage title="Loading assessment" message="Preparing your questions." />;
  if (error) return <AssessmentMessage title="Unable to load questions" message={describeSupabaseError(error)} />;
  if (attemptError && !attempt) return <Screen><Header title="Assessment unavailable" back /><Text style={commonStyles.body}>{describeSupabaseError(attemptError)}</Text><PrimaryButton title="Retry" onPress={retry} /></Screen>;
  if (questions.length === 0) return <AssessmentMessage title="No questions are available yet." message="Please check back when the assessment content is ready." />;

  const question = questions[currentIndex];
  const options = optionsByQuestion[question.id] || [];
  const selectedOptionId = answers[question.id];
  const isLastQuestion = currentIndex === questions.length - 1;
  const answeredCount = questions.filter(question => answers[question.id]).length;

  const selectOption = async (optionId: string) => {
    await saveAnswer(question.id, optionId);
  };

  const submitAssessment = async () => {
    if (!questions.every(question => answers[question.id]) || isSaving || isSubmitting) return;
    try {
      const result = await submit();
      if (result) router.replace(`/diagnostic-results?attemptId=${result.attempt.id}`);
    } catch {
      // The hook exposes the submission error in the screen state.
    }
  };

  return (
    <Screen>
      <Header title="Financial knowledge check" back />
      <Text style={commonStyles.label}>Question {currentIndex + 1} of {questions.length}</Text>
      <ProgressBar value={((currentIndex + 1) / questions.length) * 100} />
      <Text style={commonStyles.heading}>{question.question_text}</Text>
      <View>
        {options.map((option) => (
          <Pressable key={option.id} disabled={isSaving || isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: selectedOptionId === option.id, disabled: isSaving || isSubmitting }} onPress={() => selectOption(option.id)} style={[styles.option, selectedOptionId === option.id && styles.selectedOption]}>
            <View style={[styles.radio, selectedOptionId === option.id && styles.radioSelected]} />
            <Text style={styles.optionText}>{option.option_text}</Text>
          </Pressable>
        ))}
      </View>
      {attemptError ? <Text accessibilityRole="alert" style={styles.error}>{describeSupabaseError(attemptError)}</Text> : null}
      <View style={styles.navigation}>
        <PrimaryButton title="Previous" tone="outline" disabled={isSaving || isSubmitting || currentIndex === 0} onPress={currentIndex > 0 ? () => setCurrentIndex((index) => index - 1) : undefined} />
        {isLastQuestion ? (
          <PrimaryButton title={isSubmitting ? 'Submitting...' : 'Submit'} disabled={isSaving || isSubmitting || answeredCount !== questions.length} onPress={!isSaving && !isSubmitting && answeredCount === questions.length ? submitAssessment : undefined} />
        ) : (
          <PrimaryButton title="Next" disabled={!selectedOptionId || isSaving || isSubmitting} onPress={selectedOptionId && !isSaving ? () => setCurrentIndex((index) => index + 1) : undefined} />
        )}
      </View>
      <Text style={[commonStyles.label, styles.answerCount]}>{answeredCount} of {questions.length} answered</Text>
    </Screen>
  );
}

export function AssessmentResultsView() {
  const router = useRouter();
  const { user } = useAuth();
  const { attemptId } = useLocalSearchParams<{ attemptId?: string }>();
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    setError(null);
    setIsLoading(true);
    if (!user?.id || !attemptId) {
      setIsLoading(false);
      return;
    }

    getAssessmentResults(user.id, attemptId)
      .then(result => { if (active) setResult(result); })
      .catch((nextError: Error) => { if (active) setError(nextError); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [attemptId, user?.id]);

  if (isLoading) return <AssessmentMessage title="Loading results" message="Retrieving your assessment record." />;
  if (error) return <AssessmentMessage title="Unable to load results" message={describeSupabaseError(error)} />;
  if (!result?.attempt.completed_at || result.attempt.id !== attemptId || result.attempt.user_id !== user?.id) return <AssessmentMessage title="Results unavailable" message="This assessment attempt could not be found for the authenticated user." />;

  return (
    <Screen>
      <Header title="Assessment complete" back />
      <View style={styles.resultIcon}><Text style={styles.resultCheck}>✓</Text></View>
      <Text style={[commonStyles.heading, styles.center]}>Assessment complete</Text>
      <Text style={[commonStyles.body, styles.center]}>Your assessment has been recorded.</Text>
      <ToneCard tone="mint" style={styles.resultCard}>
        <Text style={commonStyles.label}>Questions answered</Text>
        <Text style={styles.resultValue}>{result.answers.length} / {result.questionCount}</Text>
      </ToneCard>
      <Text style={commonStyles.heading}>Your financial-literacy level</Text>
      <Text style={commonStyles.body}>Pending scoring methodology</Text>
      <Text style={commonStyles.body}>Your results will be used to establish your learning starting point.</Text>
      <PrimaryButton title="Continue learning" onPress={() => router.replace('/learn')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { minHeight: 54, marginTop: 10, padding: 14, borderWidth: 1, borderColor: '#d9d4d6', borderRadius: 8, flexDirection: 'row' as const, alignItems: 'center', gap: 10 },
  selectedOption: { borderColor: palette.ink, backgroundColor: '#f0ecee' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: palette.muted },
  radioSelected: { borderWidth: 5, borderColor: palette.ink },
  optionText: { flex: 1, color: palette.ink, fontSize: 13 },
  error: { color: '#a44a4a', marginTop: 10, fontSize: 12 },
  navigation: { flexDirection: 'row' as const, justifyContent: 'space-between', gap: 10, marginTop: 20 },
  answerCount: { textAlign: 'center' as const, marginTop: 12 },
  resultIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: palette.mint, alignSelf: 'center', alignItems: 'center' as const, justifyContent: 'center' as const },
  resultCheck: { color: palette.ink, fontSize: 30 },
  center: { textAlign: 'center' as const },
  resultCard: { marginVertical: 18 },
  resultValue: { color: palette.ink, fontSize: 26, fontWeight: '600' as const, marginTop: 6 },
});
