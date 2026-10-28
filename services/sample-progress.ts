import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { authoredLessons, emptyProgress, newLessonRecord, parseProgress, validateRecord, type LearningProgress, type LessonRecord } from '@/content/learning';

// v1 arithmetic previews stay untouched; their answers do not match this authored sample.
const key = (userId: string, id: string) => 'finlit.sample.v2.' + userId + '.' + id;
async function read(storageKey: string) {
  if (Platform.OS !== 'web') return SecureStore.getItemAsync(storageKey);
  if (typeof localStorage === 'undefined') throw new Error('Device storage unavailable.');
  return localStorage.getItem(storageKey);
}
async function write(storageKey: string, value: string) {
  if (Platform.OS !== 'web') return SecureStore.setItemAsync(storageKey, value);
  if (typeof localStorage === 'undefined') throw new Error('Device storage unavailable.');
  localStorage.setItem(storageKey, value);
}
async function readProgress(userId: string): Promise<LearningProgress> {
  if (!userId) throw new Error('Sign in to save lesson progress.');
  const progress = emptyProgress();
  await Promise.all(authoredLessons.map(async lesson => {
    const raw = await read(key(userId, lesson.id));
    if (raw) progress.lessons[lesson.id] = JSON.parse(raw);
  }));
  return parseProgress(JSON.stringify(progress));
}
let pending: Promise<unknown> = Promise.resolve();
export async function loadSampleProgress(userId: string) {
  await pending.catch(() => undefined);
  return readProgress(userId);
}
// The player uses a save/read boundary; a cloud adapter must preserve this contract.
export function saveSampleProgress(userId: string, id: string, record: LessonRecord, expected: LessonRecord): Promise<LearningProgress> {
  const task = pending.catch(() => undefined).then(async () => {
    const lesson = authoredLessons.find(item => item.id === id);
    if (!lesson) throw new Error('This lesson is not available.');
    const current = await readProgress(userId);
    const before = current.lessons[id] ?? newLessonRecord(lesson.version);
    if (JSON.stringify(before) !== JSON.stringify(expected)) throw new Error('This lesson was updated in another view. Load your latest saved progress to continue.');
    const next = validateRecord(lesson, record);
    if (before.completed && !next.completed) throw new Error('A completed lesson cannot be reset.');
    await write(key(userId, id), JSON.stringify(next));
    return { lessons: { ...current.lessons, [id]: next } };
  });
  pending = task;
  return task;
}
