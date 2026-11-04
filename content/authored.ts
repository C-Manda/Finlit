// Authoring and glossary data. The runtime lesson player loads only one lesson from Supabase.
import { polishLesson } from './academic-polish';
import { additionalLessons } from './curriculum-lessons';
import { LEARNING_RULES, type LessonContent } from './learning';
const baseSampleLesson: LessonContent = {
  id: 'lesson-2-1', moduleId: 'module-2', title: 'Understanding budgets', version: 2, estimatedMinutes: LEARNING_RULES.estimatedMinutes,
  sourceStatus: 'reviewed', citations: ['nsfe', 'ilo', 'worldbank', 'finscope', 'council'], references: [{ source: 'council', section: 'Session 10: Think About the Future: Money In and Money Out', concept: 'Original exercise applying income and expense planning' }, { source: 'finscope', section: '7.2 Cash-flow Management', concept: 'Budgeting and spending records in Zambian context' }, { source: 'nsfe', section: 'Priority programmes for children and youth', concept: 'Practical financial capability' }, { source: 'ilo', section: 'Session 7: Budget and budgeting', concept: 'Planning income and expenses' }, { source: 'worldbank', section: 'Financial capability', concept: 'Budgeting and monitoring expenditure in Zambia' }], action: { actionType: 'open_budget', destination: 'overview', label: 'Explore a Budget', optional: true },
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
export const sampleLesson = polishLesson(baseSampleLesson);
export const authoredLessons: LessonContent[] = [...additionalLessons, sampleLesson].sort((a, b) => a.id.localeCompare(b.id));
