import { useLocalSearchParams } from 'expo-router';
import { ModuleScreen } from '@/components/learning-screens';
export default function Route() { const { id } = useLocalSearchParams<{id:string}>(); return <ModuleScreen key={id} moduleId={id.replace('planned-module-','module-')} />; }
