import { useLocalSearchParams } from 'expo-router';
import { ModuleView } from '@/components/screen-views';
import { SampleModule } from '@/components/sample-learning';
import { curriculum } from '@/content/learning';

export default function ModuleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return curriculum.some(module => module.id === id) ? <SampleModule key={id} moduleId={id} /> : <ModuleView moduleId={id} />;
}
