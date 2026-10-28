import { useLocalSearchParams } from 'expo-router';
import { LessonView } from '@/components/screen-views';
import { SampleLessonScreen } from '@/components/sample-learning';
import { authoredLessons } from '@/content/learning';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return authoredLessons.some(lesson => lesson.id === id) ? <SampleLessonScreen key={id} lessonId={id} /> : <LessonView lessonId={id} />;
}
