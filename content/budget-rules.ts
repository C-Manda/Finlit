export type BudgetPlan = { id: string; period_start: string; period_end: string; planned_income: number; allocations: Record<string, number>; revision: number };
export type Entry = { id: string; category_id: string; entry_type: string; amount: number; description: string | null; occurred_on: string };
export type Category = { id: string; name: string; entry_type: string };
export type BudgetData = { plans: BudgetPlan[]; entries: Entry[]; categories: Category[]; insights: boolean };
export const insightConfig = { approachingThreshold: 0.8 };
export const cents = (value: number) => Math.round(value * 100);
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
export function localDate(date=new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
export function budgetTotals(plan: BudgetPlan, entries: Entry[]) {
  const period=entries.filter(e=>e.occurred_on>=plan.period_start&&e.occurred_on<=plan.period_end);
  const expense=period.filter(e=>e.entry_type==='expense'), income=period.filter(e=>e.entry_type==='income');
  return { allocated:Object.values(plan.allocations).reduce((s,v)=>s+cents(v),0)/100,
    income:income.reduce((s,e)=>s+cents(e.amount),0)/100,spent:expense.reduce((s,e)=>s+cents(e.amount),0)/100,
    categories:expense.reduce<Record<string,number>>((s,e)=>({...s,[e.category_id]:((cents(s[e.category_id]??0))+cents(e.amount))/100}),{}) };
}
export function budgetInsights(data: BudgetData, plan: BudgetPlan | undefined, config=insightConfig) {
  if(!data.insights)return [];
  if(!plan)return [{id:'no-budget',text:'A spending plan can help connect your resources with upcoming costs.',lesson:'lesson-2-2'}];
  const actual=budgetTotals(plan,data.entries), result:{id:string;text:string;lesson:string}[]=[];
  for(const c of data.categories.filter(c=>c.entry_type==='expense')){
    const spent=actual.categories[c.id]??0, allocated=plan.allocations[c.id]??0;
    if(spent>allocated)result.push({id:'over-'+c.id,text:`${c.name}: recorded spending is K${(spent-allocated).toFixed(2)} above the planned amount. Review remaining needs and any possible adjustment.`,lesson:'lesson-2-4'});
    else if(allocated>0&&spent>=allocated*config.approachingThreshold)result.push({id:'near-'+c.id,text:`${c.name}: recorded spending has reached ${Math.round(spent/allocated*100)}% of its allocation. Check what still needs to be covered.`,lesson:'lesson-2-4'});
  }
  if(data.entries.some(e=>e.entry_type==='expense'&&e.occurred_on>=plan.period_start&&e.occurred_on<=plan.period_end&&data.categories.find(c=>c.id===e.category_id)?.name.toLowerCase().includes('uncategorised')))result.push({id:'uncategorised',text:'Some spending uses the general category. More specific records can make patterns easier to review.',lesson:'lesson-2-3'});
  // Planned income alone is not an expected-income schedule. Do not infer that support is late.
  return result;
}
