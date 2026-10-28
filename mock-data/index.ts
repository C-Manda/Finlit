export type ModuleStatus = 'completed' | 'current' | 'locked';

export const modules = [
  { id: 'income', title: 'Income management', subtitle: 'Completed · 82%', tone: 'mint', status: 'completed' as ModuleStatus, icon: 'wallet' as const },
  { id: 'budgeting', title: 'Budgeting basics', subtitle: 'In progress · 25%', tone: 'blue', status: 'current' as ModuleStatus, icon: 'bar-chart' as const },
  { id: 'saving', title: 'Saving & emergencies', subtitle: 'Complete budgeting first', tone: 'peach', status: 'locked' as ModuleStatus, icon: 'lock-closed' as const },
  { id: 'borrowing', title: 'Responsible borrowing', subtitle: 'Locked', tone: 'lilac', status: 'locked' as ModuleStatus, icon: 'lock-closed' as const },
];

export const entries = [
  { id: 'allowance', title: 'Allowance', detail: 'Every month', amount: '+K1,500', type: 'income' },
  { id: 'groceries', title: 'Groceries', detail: 'Every month', amount: '-K500', type: 'expense' },
  { id: 'transport', title: 'Transport', detail: 'Every week', amount: '-K320', type: 'expense' },
];

export const quizOptions = ['Entertainment', 'Transport to lectures', 'New clothing', 'Eating out'];

export const savedExplanations = [
  'Budgeting in simple terms',
  'Reliable and irregular income',
  'Longer loan repayment example',
];