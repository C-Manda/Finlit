import type { SourceReference } from './sources';
export const STAGES = ['situation', 'concept', 'example', 'practice', 'feedback', 'checkpoint', 'summary'] as const;
export const LEARNING_RULES = { lessonsPerModule: 4, checkpointQuestions: 3, challengeQuestions: 8, challengePassScore: 6, estimatedMinutes: 10 } as const;
export const STAGE_TITLES = ['Situation', 'Concept', 'Worked example', 'Practice', 'Feedback', 'Checkpoint', 'Summary'];
export type Question = { id: string; prompt: string; options: { text: string; feedback: string }[]; correct: number; explanation: string };
export type LessonContent = {
  id: string; moduleId: string; title: string; version: number; estimatedMinutes: number;
  sourceStatus: 'reviewed' | 'desk-reviewed'; academicAudit?: { status: string; coreSource: string; coreSection: string; corePrintedPages: string | null; corePdfPages: string | null; policy: string; scope: string; duration: string; reviewedOn: string };  citations: string[]; references: SourceReference[];
  action?: { actionType: 'open_budget'; destination: 'create' | 'transaction' | 'overview'; label: string; optional: true }; introduction: string; outcomes: string[];
  situation: { title: string; body: string; figures: { label: string; value: string }[]; reflection: string; choices: string[] };
  concept: { title: string; introduction: string; takeaway: string; definitions: { term: string; meaning: string; detail: string }[] };
  example: { title: string; introduction: string; income: number; rows: { label: string; amount: number }[]; steps: string[]; showBudgetTable?: boolean };
  practice: { kind: 'numeric' | 'choice' | 'allocation'; allocation?: { available: number; fields: { id: string; label: string; minimum: number }[] }; options?: { text: string; feedback: string }[]; prompt: string; context: string; correct: number; unit: string; hint: string; consequence: string; feedback: { correctTitle: string; incorrectTitle: string; correct: string; low: string; high: string } };
  checkpoint: [Question, Question, Question]; summaryTitle: string; takeaways: string[];
};
export type PlannedModule = { id: string; title: string; introduction: string; lessons: { id: string; title: string }[] };
const topics = [
  ['Managing Your Money', 'Understanding income', 'Needs, Wants and Financial Priorities', 'Understanding expenses', 'Making everyday money decisions'],
  ['Budgeting for Student Life', 'Understanding budgets', 'Planning Your Monthly Allowance', 'Tracking expenses', 'Adjusting a budget'],
  ['Saving and Financial Goals', 'Why people save', 'Setting financial goals', 'Choosing Where to Save', 'Emergency Savings and Setbacks'],
  ['Borrowing and Debt Management', 'Understanding borrowing', 'Interest, Fees and Repayment', 'Borrowing Affordability', 'Managing debt responsibly'],
  ['Digital Financial Services', 'Mobile Money and Digital Payments', 'Transaction fees and records', 'Scams and Digital Security', 'Consumer rights and complaints'],
  ['Financial Planning and Investment Basics', 'Planning beyond this month', 'Inflation and purchasing power', 'Financial Risk and Return', 'Evaluating investment claims'],
];
// Stable curriculum keys map to existing database records through content_key.
export const curriculum: PlannedModule[] = topics.map(([title, ...titles], index) => ({
  id: 'module-' + (index + 1), title,
  introduction: [
    'Explore income, expenses and the choices you make with money.',
    'Plan for student life with the money you have, then check and adjust as things change.',
    'Build saving habits and plan towards goals that matter to you.',
    'Understand borrowing costs and consider the consequences of repayment.',
    'Learn to use financial services and protect your accounts.',
    'Explore longer-term plans, purchasing power, risk and return.',
  ][index],
  lessons: titles.map((title, lesson) => ({ id: 'lesson-' + (index + 1) + '-' + (lesson + 1), title })),
}));
export type LessonRecord = {
  version: number; stage: number; maxStage: number; reflection: number | null;
  practice: string; practiceSubmitted: boolean; answers: (number | null)[];
  checked: boolean[]; checkpointIndex: number; completed: boolean;
};
export type LearningProgress = { lessons: Record<string, LessonRecord> };
export const emptyProgress = (): LearningProgress => ({ lessons: {} });
export const newLessonRecord = (version: number): LessonRecord => ({
  version, stage: 0, maxStage: 0, reflection: null, practice: '', practiceSubmitted: false,
  answers: [null, null, null], checked: [false, false, false], checkpointIndex: 0, completed: false,
});
export const money = (value: number) => 'K' + value.toLocaleString('en-ZM');
export function numericAnswer(value: string): number | null {
  if (!/^(?:\d{1,7})(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}
export function score(lesson: LessonContent, record: LessonRecord) {
  return lesson.checkpoint.reduce((total, q, i) => total + Number(record.checked[i] && record.answers[i] === q.correct), 0);
}
export function canAdvance(record: LessonRecord) {
  if (record.stage === 3 || record.stage === 4) return record.practiceSubmitted;
  if (record.stage === 5) return record.checked.every(Boolean);
  return record.stage < 6;
}
export type LessonAction = { type: 'next' | 'previous' | 'submit-practice' | 'retry-practice' | 'check-answer' | 'finish' | 'review' };
export function transition(lesson: LessonContent, record: LessonRecord, action: LessonAction): LessonRecord {
  const next = { ...record, answers: [...record.answers], checked: [...record.checked] };
  switch (action.type) {
    case 'next':
      if (record.stage === 5 && record.checked[record.checkpointIndex] && record.checkpointIndex < 2) next.checkpointIndex++;
      else if (canAdvance(record)) next.stage++;
      break;
    case 'previous':
      if (record.stage === 5 && record.checkpointIndex > 0) next.checkpointIndex--;
      else next.stage = Math.max(0, record.stage - 1);
      break;
    case 'submit-practice':
      if (record.stage === 3 && validPractice(lesson, record.practice)) { next.practiceSubmitted = true; next.stage = 4; }
      break;
    case 'retry-practice':
      if (record.stage === 4 && !record.completed) { next.stage = 3; next.practiceSubmitted = false; next.maxStage = 3; next.answers = [null, null, null]; next.checked = [false, false, false]; next.checkpointIndex = 0; }
      break;
    case 'check-answer':
      if (record.stage === 5 && record.answers[record.checkpointIndex] !== null) next.checked[record.checkpointIndex] = true;
      break;
    case 'finish':
      if (record.stage === 6 && record.practiceSubmitted && record.checked.every(Boolean)) next.completed = true;
      break;
    case 'review':
      if (record.completed) next.stage = 0;
      break;
  }
  next.maxStage = Math.max(next.maxStage, next.stage);
  return validateRecord(lesson, next);
}
export function validateRecord(lesson: LessonContent, value: unknown): LessonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved lesson.');
  const r = value as LessonRecord;
  const index = (v: unknown, length: number) => Number.isInteger(v) && Number(v) >= 0 && Number(v) < length;
  if (r.version !== lesson.version || !index(r.stage, 7) || !index(r.maxStage, 7) || r.maxStage < r.stage ||
      !(r.reflection === null || index(r.reflection, lesson.situation.choices.length)) ||
      typeof r.practice !== 'string' || r.practice.length > (lesson.practice.kind === 'allocation' ? 512 : 12) || typeof r.practiceSubmitted !== 'boolean' ||
      !Array.isArray(r.answers) || r.answers.length !== 3 || !r.answers.every((a, i) => a === null || index(a, lesson.checkpoint[i].options.length)) ||
      !Array.isArray(r.checked) || r.checked.length !== 3 || !r.checked.every((c, i) => typeof c === 'boolean' && (!c || r.answers[i] !== null)) ||
      !index(r.checkpointIndex, 3) || typeof r.completed !== 'boolean' ||
      (r.practiceSubmitted && !validPractice(lesson, r.practice)) ||
      (r.maxStage >= 4 && !r.practiceSubmitted) || (r.maxStage >= 6 && !r.checked.every(Boolean)) ||
      (r.completed && r.maxStage !== 6) || (r.checked.some(Boolean) && !r.practiceSubmitted) ||
      r.checked.some((c, i) => c && i > 0 && !r.checked[i - 1]) ||
      (r.checkpointIndex > 0 && !r.checked[r.checkpointIndex - 1])) throw new Error('Saved lesson progress is inconsistent.');
  return { version: r.version, stage: r.stage, maxStage: r.maxStage, reflection: r.reflection,
    practice: r.practice, practiceSubmitted: r.practiceSubmitted, answers: [...r.answers], checked: [...r.checked], checkpointIndex: r.checkpointIndex, completed: r.completed };
}
export function parseProgress(raw: string, lessons: LessonContent[] = []): LearningProgress {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.lessons || typeof value.lessons !== 'object' || Array.isArray(value.lessons)) throw new Error('Invalid saved learning progress.');
  const progress = emptyProgress();
  for (const lesson of lessons) {
    const record = value.lessons[lesson.id];
    if (record && record.version === lesson.version) progress.lessons[lesson.id] = validateRecord(lesson, record);
  }
  return progress;
}

export function allocationValues(value: string): Record<string, string> {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? Object.fromEntries(Object.entries(parsed).filter(([, item]) => typeof item === 'string')) as Record<string, string> : {}; } catch { return {}; }
}
export function allocationReview(lesson: LessonContent, value: string) {
  const config = lesson.practice.allocation;
  const values = allocationValues(value);
  const total = Math.round((config?.fields.reduce((sum, field) => sum + (numericAnswer(values[field.id] ?? '') ?? 0), 0) ?? 0) * 100) / 100;
  const uncovered = config?.fields.filter(field => (numericAnswer(values[field.id] ?? '') ?? 0) < field.minimum).map(field => field.label) ?? [];
  const remaining = Math.round(((config?.available ?? 0) - total) * 100) / 100;
  const correct = remaining >= 0 && uncovered.length === 0;
  const feedback = [remaining < 0 ? 'This plan needs ' + money(-remaining) + ' more than the confirmed funds. Revise it without counting delayed support.' : 'The plan leaves ' + money(remaining) + ' unallocated from confirmed funds.', uncovered.length ? 'Recheck the immediate needs for: ' + uncovered.join(', ') + '. If these cannot be met, make the gap explicit and discuss timing or support.' : 'The stated immediate needs are covered. More than one allocation can work; consider which use of any remainder best fits uncertainty.'].join(' ');
  return { total, remaining, correct, feedback };
}
export function validPractice(lesson: LessonContent, value: string) {
  if (lesson.practice.kind === 'allocation') {
    const values = allocationValues(value); const fields = lesson.practice.allocation?.fields ?? [];
    return fields.length > 0 && Object.keys(values).length === fields.length && fields.every(field => typeof values[field.id] === 'string' && numericAnswer(values[field.id]) !== null);
  }
  const n = numericAnswer(value);
  return n !== null && (lesson.practice.kind === 'numeric' || (Number.isInteger(n) && n >= 0 && n < (lesson.practice.options?.length ?? 0)));
}
