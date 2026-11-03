import { curriculum } from './learning';
import type { LearningSnapshot } from '../services/learning';

export function moduleAvailable(key: string, progress: LearningSnapshot) {
  if (progress.journey?.required) return false;
  const index = curriculum.findIndex(m => m.id === key);
  return index >= 0 && curriculum.slice(0, index).every(m => progress.modules.some(p => p.key === m.id && p.completed));
}
export function lessonAvailable(key: string, progress: LearningSnapshot) {
  if (progress.lessons[key]?.completed) return true;
  const module = curriculum.find(m => m.lessons.some(l => l.id === key));
  if (!module || !moduleAvailable(module.id, progress)) return false;
  const index = module.lessons.findIndex(l => l.id === key);
  return module.lessons.slice(0, index).every(l => progress.lessons[l.id]?.completed);
}
export function recommendation(progress: LearningSnapshot) {
  const next = curriculum.find(m => moduleAvailable(m.id, progress) && !progress.modules.some(p => p.key === m.id && p.completed));
  const weak = Object.entries(progress.diagnostic?.scores ?? {}).filter(([,s]) => s.total > 0 && s.correct / s.total < 0.75).sort((a,b) => a[1].correct/a[1].total-b[1].correct/b[1].total)[0];
  return { module: next, lesson: next?.lessons.find(l => !progress.lessons[l.id]?.completed),
    reason: !next ? 'You have passed all six module challenges. Revisit any lesson to refresh your skills.' : weak?.[0] === next.id ? `Your knowledge check showed ${weak[1].correct}/${weak[1].total} in this area. These lessons offer focused practice.` : weak ? `Build the foundations here first. Your knowledge check also suggests practising ${curriculum.find(m => m.id === weak[0])?.title ?? 'later topics'} when its prerequisites are complete.` : 'This is the next step in your learning sequence. Complete four lessons, then pass the challenge with 6/8.' };
}
