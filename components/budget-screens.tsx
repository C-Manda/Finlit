import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { Header, Screen, StudentShell, ToneCard } from './finlit-ui';
import { LearningButton } from './lesson-player';
import { s } from './learning-screens';
import { learningApi } from '@/services/learning';
import { budgetInsights, budgetTotals, localDate, validDate, type BudgetData, type BudgetPlan } from '@/content/budget-rules';
import { curriculum, money, numericAnswer } from '@/content/learning';
import { useAuth } from '@/contexts/auth-context';
import { palette } from '@/constants/finlit-theme';

function BudgetInput({label,value,onChange,amount=false,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;amount?:boolean;disabled?:boolean}){return <View style={{gap:6}}><Text style={s.body}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} keyboardType={amount?'decimal-pad':'default'} style={{minHeight:52,borderWidth:1,borderColor:palette.line,borderRadius:12,padding:12,fontSize:16,color:palette.ink,backgroundColor:palette.surface}}/></View>;}
export function BudgetScreen({mode='overview'}:{mode?:'overview'|'create'|'transaction'}){const {user}=useAuth();return <BudgetBody key={user?.id+mode} mode={mode}/>;}
function BudgetBody({mode}:{mode:'overview'|'create'|'transaction'}){
 const {from,plan:planId}=useLocalSearchParams<{from?:string;plan?:string}>(),router=useRouter();
 const returnLesson=curriculum.flatMap(m=>m.lessons).find(l=>l.id===from);
 const [data,setData]=useState<BudgetData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false),[selected,setSelected]=useState('');
 const lock=useRef(false),alive=useRef(true),activeReload=useRef(reload);activeReload.current=reload;
 useFocusEffect(useCallback(()=>{if(activeReload.current!==reload)return;let active=true;alive.current=true;setLoading(true);setError('');learningApi<BudgetData>('budget').then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;alive.current=false;};},[reload]));
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Save failed. Please retry.');}finally{lock.current=false;if(alive.current)setBusy(false);}}
 const route=(path:string,extra='')=>router.push((path+(returnLesson?'?from='+returnLesson.id+(extra?'&'+extra:''):extra?'?'+extra:'')) as never);
 const goOverview=()=>router.replace(('/budget'+(returnLesson?'?from='+returnLesson.id:'')) as never);
 const guidance=returnLesson?<ToneCard tone="lilac"><View style={s.stack}><Text style={s.body}>Apply “{returnLesson.title}” using your own information. Your lesson completion is already saved. This step is optional.</Text><LearningButton title="Return to learning" secondary disabled={busy} onPress={()=>router.replace(('/learn/lesson/'+returnLesson.id+'?play=1') as never)}/></View></ToneCard>:null;
 const errors=error?<View style={s.stack}><Text accessibilityRole="alert" style={s.body}>{error}</Text><LearningButton title="Reload account data" secondary disabled={busy} onPress={()=>setReload(n=>n+1)}/></View>:null;
 let content;
 if(loading)content=<Text style={s.body}>Loading your budget records…</Text>;
 else if(!data)content=errors;
 else if(mode==='create')content=<><BudgetForm key={(planId??'new')+':'+reload} data={data} plan={data.plans.find(p=>p.id===planId)} busy={busy} onSave={payload=>run(async()=>{await learningApi('save_budget',payload);if(alive.current)goOverview();})}/>{errors}</>;
 else if(mode==='transaction')content=<><TransactionForm data={data} busy={busy} onSave={payload=>run(async()=>{await learningApi('entry',payload);if(alive.current)goOverview();})}/>{errors}</>;
 else {
  const plan=data.plans.find(p=>p.id===selected)??data.plans.find(p=>p.period_start<=localDate()&&p.period_end>=localDate())??data.plans[0];
  const totals=plan?budgetTotals(plan,data.entries):null;
  const insights=budgetInsights(data,plan);
  content=<>{errors}<Text style={s.title}>Your Budget Tracker</Text><Text style={s.body}>Plan your money and record what actually happens. Planned income is an estimate; it is separate from confirmed transactions.</Text>
   <LearningButton title="Create a budget" onPress={()=>route('/budget/create')}/><LearningButton title="Record a transaction" secondary onPress={()=>route('/budget/add')}/>
   {!plan?<ToneCard tone="lilac"><Text style={s.heading}>No budget yet</Text><Text style={s.body}>Choose a period and add your own planned income and allocations. You can do this at any point in your learning.</Text></ToneCard>:<>
    <Text style={s.heading}>Budget period</Text><View style={s.stack}>{data.plans.map(p=><LearningButton key={p.id} title={`${p.period_start} to ${p.period_end}${plan.id===p.id?' · Selected':''}`} secondary onPress={()=>setSelected(p.id)}/>)}</View>
    <ToneCard tone="lilac"><View style={s.stack}><Text style={s.body}>Planned income: {money(plan.planned_income)}</Text><Text style={s.body}>Allocated: {money(totals!.allocated)}</Text><Text style={s.heading}>{plan.planned_income>=totals!.allocated?'Unallocated':'Planned shortfall'}: {money(Math.abs(plan.planned_income-totals!.allocated))}</Text><Text style={s.note}>This is a plan, not your account balance.</Text></View></ToneCard>
    <View style={s.card}><Text style={s.heading}>Recorded in this period</Text><Text style={s.body}>Received income: {money(totals!.income)}</Text><Text style={s.body}>Expenses: {money(totals!.spent)}</Text><Text style={s.body}>Recorded income less expenses: {money(totals!.income-totals!.spent)}</Text><Text style={s.note}>Only transactions you recorded are included. This is not a bank or wallet balance.</Text></View>
    <Text style={s.heading}>Planned versus actual</Text>{data.categories.filter(c=>c.entry_type==='expense'&&((plan.allocations[c.id]??0)>0||(totals!.categories[c.id]??0)>0)).map(c=><View key={c.id} style={s.card}><Text style={s.heading}>{c.name}</Text><Text style={s.body}>{money(totals!.categories[c.id]??0)} spent / {money(plan.allocations[c.id]??0)} planned</Text></View>)}
    <LearningButton title="Revise allocations" secondary onPress={()=>route('/budget/create','plan='+plan.id)}/>
   </>}
   <View style={s.card}><Text style={s.heading}>Educational spending insights</Text><Text style={s.body}>Allow Finlit to compare your recorded spending with your allocations and suggest relevant lessons. This is optional and can be turned off here. It does not affect learning access.</Text><LearningButton title={data.insights?'Turn personalised insights off':'Allow personalised insights'} secondary disabled={busy} onPress={()=>void run(async()=>{const enabled=await learningApi<boolean>('consent',{enabled:!data.insights});if(alive.current)setData({...data,insights:enabled});})}/></View>
   {insights.map(i=><ToneCard key={i.id} tone="mint"><View style={s.stack}><Text style={s.body}>{i.text}</Text><LearningButton title="Explore the related lesson" secondary onPress={()=>router.push(('/learn/lesson/'+i.lesson) as never)}/></View></ToneCard>)}
   <Text style={s.heading}>Your transactions</Text>{data.entries.filter(e=>!plan||(e.occurred_on>=plan.period_start&&e.occurred_on<=plan.period_end)).map(e=><View key={e.id} style={s.card}><Text style={s.heading}>{e.entry_type==='income'?'+':'−'}{money(e.amount)} · {data.categories.find(c=>c.id===e.category_id)?.name??'Category unavailable'}</Text><Text style={s.note}>{e.occurred_on}{e.description?' · '+e.description:''}</Text></View>)}
   {data.entries.length===0&&<Text style={s.body}>No transactions recorded. Add an actual income or expense when you are ready.</Text>}
  </>;
 }
 const page=<Screen><Header title={mode==='create'?'Plan your budget':mode==='transaction'?'Record a transaction':'Budget'} back={mode!=='overview'}/><View style={s.stack}>{guidance}{content}</View></Screen>;
 return mode==='overview'?<StudentShell>{page}</StudentShell>:<KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>{page}</KeyboardAvoidingView>;
}
function BudgetForm({data,plan,busy,onSave}:{data:BudgetData;plan?:BudgetPlan;busy:boolean;onSave:(payload:object)=>Promise<void>}){
 const now=new Date(),[start,setStart]=useState(plan?.period_start??localDate(new Date(now.getFullYear(),now.getMonth(),1))),[end,setEnd]=useState(plan?.period_end??localDate(new Date(now.getFullYear(),now.getMonth()+1,0)));
 const [income,setIncome]=useState(plan?String(plan.planned_income):''),[allocations,setAllocations]=useState<Record<string,string>>(Object.fromEntries(Object.entries(plan?.allocations??{}).map(([k,v])=>[k,String(v)]))),[validation,setValidation]=useState('');
 const categories=data.categories.filter(c=>c.entry_type==='expense'),allocated=Object.values(allocations).reduce((s,v)=>s+(numericAnswer(v)??0),0);
 const save=()=>{if(!validDate(start)||!validDate(end)||start>end||numericAnswer(income)===null||Object.values(allocations).some(v=>v!==''&&numericAnswer(v)===null)){setValidation('Use valid dates in YYYY-MM-DD format and non-negative amounts with at most two decimals.');return;}setValidation('');void onSave({start,end,income:Number(income),allocations:Object.fromEntries(categories.map(c=>[c.id,Number(allocations[c.id]||0)])),revision:plan?.revision??0});};
 return <View style={s.stack}><Text style={s.body}>Use your own estimates for this period. Include essential needs first. A shortfall can be saved so that unmet needs remain visible.</Text><BudgetInput label="Period start (YYYY-MM-DD)" value={start} onChange={setStart} disabled={busy||!!plan}/><BudgetInput label="Period end (YYYY-MM-DD)" value={end} onChange={setEnd} disabled={busy}/><BudgetInput label="Planned income (K)" value={income} onChange={setIncome} amount disabled={busy}/>{categories.map(c=><BudgetInput key={c.id} label={c.name+' allocation (K)'} value={allocations[c.id]??''} onChange={v=>setAllocations({...allocations,[c.id]:v})} amount disabled={busy}/>)}<Text style={s.heading}>Allocated: {money(allocated)}</Text><Text style={s.body}>Unallocated / shortfall: {money((numericAnswer(income)??0)-allocated)}</Text>{!!validation&&<Text accessibilityRole="alert" style={s.body}>{validation}</Text>}<LearningButton title={busy?'Saving…':'Save budget'} disabled={busy||!categories.length} onPress={save}/></View>;
}
function TransactionForm({data,busy,onSave}:{data:BudgetData;busy:boolean;onSave:(payload:object)=>Promise<void>}){
 const [type,setType]=useState('expense'),[amount,setAmount]=useState(''),[category,setCategory]=useState(''),[date,setDate]=useState(localDate()),[description,setDescription]=useState(''),[validation,setValidation]=useState('');
 // Random UUID is only a collision-resistant retry identifier, never an authentication secret.
 const request=useRef('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return(c==='x'?r:(r&3)|8).toString(16);}));
 const save=()=>{if(numericAnswer(amount)===null||Number(amount)<=0||!category||!validDate(date)||date>localDate()||description.length>500){setValidation('Enter a positive amount, choose a category and use an actual date (YYYY-MM-DD), not a future date. Notes can contain up to 500 characters.');return;}setValidation('');void onSave({type,amount:Number(amount),category,date,description,request:request.current});};
 return <View style={s.stack}><Text style={s.body}>Record money actually received or spent. Moving your own money into cash is a transfer: do not record it as income or an expense. Record any transfer fee as a separate expense.</Text>{['income','expense'].map(t=><LearningButton key={t} title={(type===t?'● ':'○ ')+(t==='income'?'Income':'Expense')} secondary disabled={busy} onPress={()=>{setType(t);setCategory('');}}/>)}<BudgetInput label="Amount (K)" value={amount} onChange={setAmount} amount disabled={busy}/><Text style={s.heading}>Category</Text>{data.categories.filter(c=>c.entry_type===type).map(c=><Pressable key={c.id} accessibilityRole="radio" accessibilityState={{checked:category===c.id,disabled:busy}} disabled={busy} style={[s.card,category===c.id&&s.current]} onPress={()=>setCategory(c.id)}><Text style={s.body}>{category===c.id?'●':'○'} {c.name}</Text></Pressable>)}<BudgetInput label="Transaction date (YYYY-MM-DD)" value={date} onChange={setDate} disabled={busy}/><BudgetInput label="Description (optional)" value={description} onChange={setDescription} disabled={busy}/>{!!validation&&<Text accessibilityRole="alert" style={s.body}>{validation}</Text>}<LearningButton title={busy?'Saving…':'Save transaction'} disabled={busy} onPress={save}/></View>;
}
