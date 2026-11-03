import { useLocalSearchParams } from 'expo-router';
import { ChallengeScreen } from '@/components/challenge-screen';
export default function Route() { const { id } = useLocalSearchParams<{id:string}>(); return <ChallengeScreen assessmentKey={'challenge-'+id} />; }
