export const STAGES = ['situation', 'concept', 'example', 'practice', 'feedback', 'checkpoint', 'summary'] as const;
export const LEARNING_RULES = { lessonsPerModule: 4, checkpointQuestions: 3, challengeQuestions: 8, challengePassScore: 6, estimatedMinutes: 10 } as const;
export const STAGE_TITLES = ['Situation', 'Concept', 'Worked example', 'Practice', 'Feedback', 'Checkpoint', 'Summary'];
export type Question = { id: string; prompt: string; options: { text: string; feedback: string }[]; correct: number; explanation: string };
export type LessonContent = {
  id: string; moduleId: string; title: string; version: number; estimatedMinutes: number;
  sourceStatus: 'sample'; citations: string[]; introduction: string; outcomes: string[];
  situation: { title: string; body: string; figures: { label: string; value: string }[]; reflection: string; choices: string[] };
  concept: { title: string; introduction: string; takeaway: string; definitions: { term: string; meaning: string; detail: string }[] };
  example: { title: string; introduction: string; income: number; rows: { label: string; amount: number }[]; steps: string[] };
  practice: { kind: 'numeric'; prompt: string; context: string; correct: number; unit: string; hint: string; consequence: string; feedback: { correctTitle: string; incorrectTitle: string; correct: string; low: string; high: string } };
  checkpoint: [Question, Question, Question]; summaryTitle: string; takeaways: string[];
};
export type PlannedModule = { id: string; title: string; introduction: string; lessons: { id: string; title: string }[] };
const topics = [
  ['Managing Your Money', 'Understanding income', 'Needs, wants and priorities', 'Understanding expenses', 'Making everyday money decisions'],
  ['Budgeting for Student Life', 'Understanding budgets', 'Planning an allowance', 'Tracking expenses', 'Adjusting a budget'],
  ['Saving and Financial Goals', 'Why people save', 'Setting financial goals', 'Choosing saving methods', 'Emergency savings'],
  ['Borrowing and Debt', 'Understanding borrowing', 'Interest, fees and total repayment', 'Loan affordability', 'Managing debt responsibly'],
  ['Digital Financial Services', 'Accounts and mobile money', 'Transaction fees and records', 'Scams and account security', 'Consumer rights and complaints'],
  ['Financial Planning and Investment', 'Planning beyond this month', 'Inflation and purchasing power', 'Understanding risk and return', 'Evaluating investment claims'],
];
// A catalogue is a plan, not authored or published teaching content.
export const curriculum: PlannedModule[] = topics.map(([title, ...titles], index) => ({
  id: 'planned-module-' + (index + 1), title,
  introduction: [
    'Explore income, expenses and the choices you make with money.',
    'Plan for student life with the money you have, then check and adjust as things change.',
    'Build saving habits and plan towards goals that matter to you.',
    'Understand borrowing costs and consider the consequences of repayment.',
    'Learn to use financial services and protect your accounts.',
    'Explore longer-term plans, purchasing power, risk and return.',
  ][index],
  lessons: titles.map((title, lesson) => ({ id: index === 1 && lesson === 0 ? 'sample-budgeting-1' : 'planned-' + (index + 1) + '-' + (lesson + 1), title })),
}));
export const sampleLesson: LessonContent = {
  id: 'sample-budgeting-1', moduleId: 'planned-module-2', title: 'Understanding budgets', version: 2, estimatedMinutes: LEARNING_RULES.estimatedMinutes,
  sourceStatus: 'sample', citations: [],
  introduction: 'Help a fictional student turn a monthly allowance into a workable spending plan.',
  outcomes: ['Explain what a budget helps you decide.', 'Calculate the money left after planned expenses.', 'Adjust a plan when a new cost appears.'],
  situation: {
    title: 'A month of choices for Chipo',
    body: 'Chipo is a university student in Zambia. In this fictional month, she has K1,500 available. She needs food, transport, data and study materials. Friends also invite her to an event costing K300. Before she agrees, she wants to know what she can afford without losing money needed for her studies.',
    figures: [{ label: 'Money available', value: 'K1,500' }, { label: 'Event invitation', value: 'K300' }],
    reflection: 'What would you help Chipo check first?',
    choices: ['The costs she needs to cover this month', 'Whether her friends are going', 'How to spend the full allowance quickly'],
  },
  concept: {
    title: 'A plan before a purchase',
    takeaway: 'Money available − planned expenses = remaining balance. Check the period and the costs before deciding what the balance can cover.',
    introduction: 'A budget is a plan for how to use money over a chosen period. It connects what is available with what needs to be paid, rather than relying on the account balance alone. A plan can change when a cost changes.',
    definitions: [
      { term: 'Money available', meaning: 'Money you can use within the period you are planning for.', detail: 'Use the same period for your money and costs. An uncertain payment should not be treated as money already available. In this example, Chipo has K1,500 for one month.' },
      { term: 'Planned expenses', meaning: 'Costs you expect to pay during that period.', detail: 'List each cost once. Chipo separates food, transport, data and study materials. The amounts are invented for this activity, not a guide to local prices.' },
      { term: 'Remaining balance', meaning: 'Money available minus the total planned expenses.', detail: 'A positive balance means the plan leaves some money unallocated. A negative balance means planned costs exceed available money. Neither tells you that a future cost is impossible.' },
    ],
  },
  example: {
    title: 'Give each cost a place',
    introduction: 'Chipo writes a first monthly plan. All amounts in this lesson are fictional ZMW examples.',
    income: 1500,
    rows: [{ label: 'Food', amount: 600 }, { label: 'Transport', amount: 300 }, { label: 'Data', amount: 150 }, { label: 'Study materials', amount: 250 }],
    steps: [
      'Use one period: the K1,500 and all four costs refer to the same month.',
      'Add the costs: K600 + K300 + K150 + K250 = K1,300.',
      'Subtract: K1,500 − K1,300 = K200 remaining. The K300 event would leave a K100 shortfall unless she changes the plan.',
    ],
  },
  practice: {
    kind: 'numeric', unit: 'K', correct: 120,
    hint: 'Start with the previous K200 remainder and account for the additional printing cost.',
    consequence: 'With K120 left, the K300 invitation is K180 beyond this plan. Chipo can look for a lower-cost option, decline, or check whether a real change to the plan is possible. Ignoring a needed cost would not make the event affordable.',
    prompt: 'What balance remains after Chipo adds the printing cost?',
    context: 'Chipo keeps the K1,300 expense plan and adds K80 for printing. She still has K1,500 available. Enter the remaining amount in kwacha.',
    feedback: {
      correctTitle: 'You accounted for the new cost', incorrectTitle: 'Review what changed',
      correct: 'K1,300 + K80 = K1,380 in planned expenses. K1,500 − K1,380 = K120 remaining. You included the new cost before deciding what is available.',
      low: 'Your answer leaves less than K120. Check that you have included each cost once: K1,300 already includes food, transport, data and materials. Add only the new K80, then subtract K1,380 from K1,500.',
      high: 'Your answer leaves more than K120. Check whether you included the new printing cost. The old K200 remainder falls by K80, so K120 remains.',
    },
  },
  checkpoint: [
    { id: 'budget-purpose', prompt: 'What is the main purpose of Chipo’s budget?', correct: 1,
      options: [
        { text: 'To guarantee that no unexpected costs occur', feedback: 'A plan cannot prevent unexpected costs. It gives Chipo a starting point for adjusting her choices.' },
        { text: 'To plan how available money will cover costs', feedback: 'Yes. The plan connects her available money with costs and helps her make choices.' },
        { text: 'To make sure every kwacha is spent immediately', feedback: 'A budget does not require immediate spending. Money can remain for later costs or a goal.' },
      ], explanation: 'A budget helps plan and review choices over a period. It is useful even when the amounts later change.' },
    { id: 'budget-application', prompt: 'A different student has K1,200 available and K950 in planned expenses. What remains?', correct: 2,
      options: [
        { text: 'K2,150', feedback: 'That adds the money and the costs. Expenses use up the available money, so subtract instead.' },
        { text: 'K950', feedback: 'K950 is the cost total, not the amount left after paying it.' },
        { text: 'K250', feedback: 'Yes. K1,200 − K950 = K250 remaining.' },
      ], explanation: 'Use the same period, add the planned expenses, then subtract the expense total from the money available.' },
    { id: 'budget-decision', prompt: 'After printing, Chipo has K120 unallocated. Her friends’ event still costs K300. Which response fits her plan?', correct: 0,
      options: [
        { text: 'Check for a lower-cost option or decline while keeping needed costs covered', feedback: 'This recognises the K180 shortfall and protects the costs she still needs to pay.' },
        { text: 'Go because the account originally received K1,500', feedback: 'The starting balance includes money already planned for other costs. It does not mean K300 is still available.' },
        { text: 'Remove transport from the plan without checking how she will get to class', feedback: 'Removing a needed cost on paper does not remove the need. She should check the consequences before changing it.' },
      ], explanation: 'K300 − K120 = K180 more than the current plan allows. An affordable choice needs a real change, not an ignored expense.' },
  ],
  summaryTitle: 'A plan you can review and adjust',
  takeaways: ['Plan money and costs for the same period.', 'Subtract total planned expenses from money available to find the remainder.', 'Review new costs and their consequences before changing a plan.'],
};
export const authoredLessons: LessonContent[] = [sampleLesson];
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
      if (record.stage === 3 && numericAnswer(record.practice) !== null) { next.practiceSubmitted = true; next.stage = 4; }
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
      typeof r.practice !== 'string' || r.practice.length > 12 || typeof r.practiceSubmitted !== 'boolean' ||
      !Array.isArray(r.answers) || r.answers.length !== 3 || !r.answers.every((a, i) => a === null || index(a, lesson.checkpoint[i].options.length)) ||
      !Array.isArray(r.checked) || r.checked.length !== 3 || !r.checked.every((c, i) => typeof c === 'boolean' && (!c || r.answers[i] !== null)) ||
      !index(r.checkpointIndex, 3) || typeof r.completed !== 'boolean' ||
      (r.practiceSubmitted && numericAnswer(r.practice) === null) ||
      (r.maxStage >= 4 && !r.practiceSubmitted) || (r.maxStage >= 6 && !r.checked.every(Boolean)) ||
      (r.completed && r.maxStage !== 6) || (r.checked.some(Boolean) && !r.practiceSubmitted) ||
      r.checked.some((c, i) => c && i > 0 && !r.checked[i - 1]) ||
      (r.checkpointIndex > 0 && !r.checked[r.checkpointIndex - 1])) throw new Error('Saved lesson progress is inconsistent.');
  return { version: r.version, stage: r.stage, maxStage: r.maxStage, reflection: r.reflection,
    practice: r.practice, practiceSubmitted: r.practiceSubmitted, answers: [...r.answers], checked: [...r.checked], checkpointIndex: r.checkpointIndex, completed: r.completed };
}
export function parseProgress(raw: string): LearningProgress {
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) || !value.lessons || typeof value.lessons !== 'object' || Array.isArray(value.lessons)) throw new Error('Invalid saved learning progress.');
  const progress = emptyProgress();
  for (const lesson of authoredLessons) {
    const record = value.lessons[lesson.id];
    if (record && record.version === lesson.version) progress.lessons[lesson.id] = validateRecord(lesson, record);
  }
  return progress;
}
