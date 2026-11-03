import { useLocalSearchParams } from 'expo-router';
import { LessonScreen } from '@/components/learning-screens';
export default function Route() { const { id } = useLocalSearchParams<{id:string}>(); return <LessonScreen key={id} lessonId={id === 'sample-budgeting-1' ? 'lesson-2-1' : id} />; }
