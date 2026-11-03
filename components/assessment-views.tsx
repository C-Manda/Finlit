import { useLocalSearchParams } from 'expo-router';
import { ChallengeScreen } from './challenge-screen';
export function DiagnosticIntroView() { return <ChallengeScreen assessmentKey="diagnostic" />; }
export const AssessmentQuestionsView = DiagnosticIntroView;
export function AssessmentResultsView() { const { attemptId } = useLocalSearchParams<{attemptId:string}>(); return <ChallengeScreen assessmentKey="diagnostic" attemptId={attemptId} />; }
