export type BudgetPlan = { id: string; period_start: string; period_end: string; planned_income: number; allocations: Record<string, number>; revision: number };
export type Entry = { occurred_at?: string | null; location_id?: string | null; destination_location_id?: string | null; id: string; category_id: string | null; entry_type: string; amount: number; description: string | null; occurred_on: string; fee_amount?: number; fee_category_id?: string | null; revision?: number; deleted_at?: string | null };
export type Category = { id: string; name: string; entry_type: string };
export type MoneyLocation = { id: string; location_type: 'cash' | 'mobile_money' | 'bank'; provider: string; nickname: string; colour: string; opening_balance: number; opening_date: string; active: boolean; balance: number };
export type BalanceAdjustment = { id: string; location_id: string; amount: number; balance_before: number; balance_after: number; reason: string; created_at: string };
export type BudgetData = { locations?: MoneyLocation[]; available?: number; adjustments?: BalanceAdjustment[]; plans: BudgetPlan[]; entries: Entry[]; categories: Category[]; insights: boolean };
export const insightConfig = { approachingThreshold: 0.8 };
export const cents = (value: number) => Math.round(value * 100);
export const currency = (value: number) => (value<0?'−K':'K') + Math.abs(value).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value; }
// Lusaka has UTC+2 and no daylight-saving changes. Keep dates independent of the device zone.
export function localDate(date=new Date()) { return new Date(date.getTime()+2*60*60*1000).toISOString().slice(0,10); }
export function monthPeriod(month=localDate().slice(0,7)) {
 const [year,index]=month.split('-').map(Number);
 return {period_start:month+'-01',period_end:month+'-'+new Date(Date.UTC(year,index,0)).getUTCDate()};
}
export function budgetTotals(plan: Pick<BudgetPlan,'period_start'|'period_end'|'allocations'|'planned_income'>, entries: Entry[]) {
 const period=entries.filter(e=>!e.deleted_at && validDate(e.occurred_on) && e.occurred_on>=plan.period_start&&e.occurred_on<=plan.period_end);
 const categories: Record<string,number>={}, days: Record<string,number>={};
 let income=0,spent=0,transfers=0;
 const expense=(amount:number,category:string|null|undefined,day:string)=>{
  const amountCents=cents(amount); spent+=amountCents;
  categories[category??'missing']=(categories[category??'missing']??0)+amountCents;
  days[day]=(days[day]??0)+amountCents;
 };
 for(const entry of period){
  if(!Number.isFinite(entry.amount)||entry.amount<=0)continue;
  if(entry.entry_type==='income')income+=cents(entry.amount);
  if(entry.entry_type==='expense')expense(entry.amount,entry.category_id,entry.occurred_on);
  if(entry.entry_type==='transfer')transfers+=cents(entry.amount);
  const fee=entry.fee_amount??0;
  if(Number.isFinite(fee)&&fee>0)expense(fee,entry.fee_category_id,entry.occurred_on);
 }
 const allocated=Object.values(plan.allocations).reduce((sum,value)=>sum+(Number.isFinite(value)&&value>=0?cents(value):0),0);
 const categoryValues=Object.fromEntries(Object.entries(categories).map(([id,value])=>[id,value/100]));
 return {allocated:allocated/100,income:income/100,spent:spent/100,transfers:transfers/100,categories:categoryValues,
  remaining:(allocated-spent)/100,unallocated:(cents(plan.planned_income)-allocated)/100,variance:(spent-allocated)/100,net:(income-spent)/100,
  categoryRemaining:Object.fromEntries([...new Set([...Object.keys(plan.allocations),...Object.keys(categories)])].map(id=>[id,((cents(plan.allocations[id]??0))-(categories[id]??0))/100])),
  days:Object.entries(days).sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value:value/100})),entries:period};
}
export function budgetInsights(data: BudgetData, plan: BudgetPlan | undefined, config=insightConfig, totals?: ReturnType<typeof budgetTotals>) {
  if(!data.insights)return [];
  if(!plan)return [{id:'no-budget',text:'A spending plan can help connect your resources with upcoming costs.',lesson:'lesson-2-2'}];
  const actual=totals??budgetTotals(plan,data.entries), result:{id:string;text:string;lesson:string}[]=[];
  for(const c of data.categories.filter(c=>c.entry_type==='expense')){
    const spent=actual.categories[c.id]??0, allocated=plan.allocations[c.id]??0;
    if(spent>allocated)result.push({id:'over-'+c.id,text:`${c.name}: recorded spending is K${(spent-allocated).toFixed(2)} above the planned amount. Review remaining needs and any possible adjustment.`,lesson:'lesson-2-4'});
    else if(allocated>0&&spent>=allocated*config.approachingThreshold)result.push({id:'near-'+c.id,text:`${c.name}: recorded spending has reached ${Math.round(spent/allocated*100)}% of its allocation. Check what still needs to be covered.`,lesson:'lesson-2-4'});
  }
  if(data.entries.some(e=>e.entry_type==='expense'&&e.occurred_on>=plan.period_start&&e.occurred_on<=plan.period_end&&data.categories.find(c=>c.id===e.category_id)?.name.toLowerCase().includes('uncategorised')))result.push({id:'uncategorised',text:'Some spending uses the general category. More specific records can make patterns easier to review.',lesson:'lesson-2-3'});
  if(actual.unallocated>0)result.push({id:'unallocated',text:`${currency(actual.unallocated)} of planned income is unallocated. Consider upcoming needs; this does not mean the money has arrived.`,lesson:'lesson-2-2'});
  // Planned income alone is not an expected-income schedule. Do not infer that support is late.
  return result;
}
