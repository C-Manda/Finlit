// Node 22+. Real learning, challenge and budget components + services against disposable Postgres.
// Auth identity and router are test adapters; no requests reach Supabase.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const project = path.resolve(path.dirname(process.argv[1]), '..');
const root = path.join(project, '.expo', 'system-review');
const browserProfile = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'finlit-system-browser-'));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
  if (req.url === '/rpc') {
    let body='';for await (const chunk of req) body+=chunk;
    const args=JSON.parse(body);
    try { if(failNext===args.p_action){failNext=null;throw Object.assign(Error('Simulated connection failure'),{code:'NETWORK'});}const data=await api(args.p_action,args.p_payload);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error:null})); }
    catch(error){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:null,error:{message:error.message,code:error.code}}));}return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');
  let file = url.pathname === '/' ? path.join(root, 'index.html') : url.pathname === '/bundle.js' ? path.join(root, 'bundle.js') : null;
  if (url.pathname.startsWith('/assets/')) {
    const relative = decodeURIComponent(url.pathname.slice('/assets/'.length));
    const base = project;
    const asset = path.resolve(base, relative);
    if (asset.startsWith(base + path.sep)) file = asset;
  }
  if (!file || !fs.existsSync(file)) {
    const appRoot = path.join(root, 'app-export');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidates = [relative, relative + '.html'];
    if (url.pathname.startsWith('/learn/lesson/')) candidates.push('learn/lesson/[id].html');
    for (const candidate of candidates) {
      const resolved = path.resolve(appRoot, candidate);
      if (resolved.startsWith(appRoot + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) { file = resolved; break; }
    }
  }
  if (!file || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=utf-8' : file.endsWith('.ttf') ? 'font/ttf' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});
let browser;
let socket;
const pending = new Map();
let seq = 0;
const exceptions = [];
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + JSON.stringify(result.exceptionDetails.exception));
  return result.result.value;
}
async function until(expression, message) {
  for (let i = 0; i < 100; i++) { if (await evaluate('!!document.body && (' + expression + ')')) return; await delay(100); }
  const body = await evaluate('document.body.innerText');
  throw new Error(message + '\n' + body.slice(0, 1600));
}
async function button(text, role = 'button') {
  const selector = '[role="' + role + '"]';
  const target = text.replace(/^[●○]\s*/, '');
  const condition = role === 'radio' ? '(el.textContent.trim().endsWith(' + JSON.stringify(target) + ') || el.getAttribute("aria-label") === ' + JSON.stringify(text) + ')' : '(el.textContent.trim() === ' + JSON.stringify(text) + ' || el.getAttribute("aria-label") === ' + JSON.stringify(text) + ')';
  const find = 'Array.from(document.querySelectorAll(' + JSON.stringify(selector) + ')).find(el => ' + condition + ')';
  await until('!!(' + find + ')', 'Missing control: ' + text);
  const rect = await evaluate('(() => {const e=' + find + ';e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:e.getAttribute("aria-disabled")};})()');
  assert.notEqual(rect.disabled, 'true', text + ' should be enabled');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await delay(150);
}
async function screenshot(name) {
  const learnerCopy = await evaluate('document.body.innerText');
  assert.doesNotMatch(learnerCopy, /development sample|sources? (?:not yet validated|await validation)|published module|secure server grading|curriculum preview|design target|sample progress|sample lesson/i, 'Developer copy appeared in the learner flow');
  const output = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.join(root, 'screens'), { recursive: true });
  fs.writeFileSync(path.join(root, 'screens', name + '.png'), Buffer.from(output.data, 'base64'));
}
const {PGlite}=require(process.env.FINLIT_PGLITE_PATH||'@electric-sql/pglite');
const load=require('./load-typescript.cjs');
const c={...load('content/learning.ts'),...load('content/authored.ts')};
const db=new PGlite();let failNext=null;
const user='10000000-0000-4000-a000-000000000001';let answerKeys=[];
async function api(action,payload={}){return(await db.query('select public.finlit_api($1,$2::jsonb) value',[action,JSON.stringify(payload)])).rows[0].value;}
async function completeLesson(key){const lesson=await api('lesson',{key});let record=c.newLessonRecord(lesson.version);const save=async(next)=>{record=await api('save_lesson',{key,record:next,expected:record});};const act=async(type)=>save(c.transition(lesson,record,{type}));await act('next');await act('next');await act('next');await save({...record,practice:lesson.practice.kind==='allocation'?JSON.stringify(Object.fromEntries(lesson.practice.allocation.fields.map(f=>[f.id,String(f.minimum)]))):String(lesson.practice.correct)});await act('submit-practice');await act('next');for(let i=0;i<3;i++){await save({...record,answers:record.answers.map((v,j)=>j===i?lesson.checkpoint[i].correct:v)});await act('check-answer');await act('next');}await act('finish');}
async function setInput(label,value){await evaluate('(()=>{const e=Array.from(document.querySelectorAll("input")).find(e=>e.getAttribute("aria-label")==='+JSON.stringify(label)+');if(!e)throw Error("Missing input");e.scrollIntoView({block:"center"});e.focus();e.select();})()');await send('Input.insertText',{text:value});await delay(100);}
async function go(route){await evaluate('window.__go('+JSON.stringify(route)+')');await delay(250);}
const req = require('node:module').createRequire(path.join(project, 'package.json'));
const Metro = req('metro');
const {getDefaultConfig}=req('expo/metro-config');
async function prepareFixture(){
 fs.mkdirSync(root,{recursive:true});
 fs.writeFileSync(path.join(root,'auth.js'),`export const useAuth=()=>({user:{id:'${user}',email:'learner@example.invalid'}});`);
 fs.writeFileSync(path.join(root,'supabase.js'),`export const supabase={rpc:async(name,args)=>{if(name!=='finlit_api')throw Error('Unexpected RPC');return fetch('/rpc',{method:'POST',body:JSON.stringify(args)}).then(r=>r.json());}};`);
 fs.writeFileSync(path.join(root,'router.js'),`import React,{useEffect} from 'react';import {Pressable} from 'react-native';export const Redirect=({href})=>{useEffect(()=>window.__go(href),[href]);return null;};export const useRouter=()=>({push:window.__go,replace:window.__go,back:()=>window.__go('/learn')});export const usePathname=()=>window.__route.split('?')[0];export const useLocalSearchParams=()=>Object.fromEntries(new URLSearchParams(window.__route.split('?')[1]||''));export const useFocusEffect=callback=>useEffect(callback,[callback]);export const Link=({children,href})=><Pressable onPress={()=>window.__go(href)}>{children}</Pressable>;`);
 fs.writeFileSync(path.join(root,'entry.js'),`import React,{useState} from 'react';import {AppRegistry} from 'react-native';import {SafeAreaProvider} from 'react-native-safe-area-context';import {LearningPath,LessonScreen,ModuleScreen} from '@/components/learning-screens';import {ChallengeScreen} from '@/components/challenge-screen';import {BudgetScreen} from '@/components/budget-screens';import {HomeScreen} from '@/components/home-screen';import {DiagnosticGate} from '@/components/diagnostic-gate';import {JourneyScreen} from '@/components/knowledge-views';function Review(){const [route,setRoute]=useState('/learn');window.__go=setRoute;window.__route=route;const path=route.split('?')[0];let body=path==='/dashboard'?<HomeScreen/>:path==='/learning-comparison'?<JourneyScreen comparison/>:path==='/knowledge-profile'?<JourneyScreen/>:path==='/final-assessment'?<ChallengeScreen assessmentKey="final"/>:path==='/diagnostic'?<ChallengeScreen assessmentKey="diagnostic"/>:path.startsWith('/learn/challenge/')?<ChallengeScreen assessmentKey={'challenge-'+path.split('/').pop()}/>:path.startsWith('/learn/lesson/')?<LessonScreen lessonId={path.split('/').pop()}/>:path.startsWith('/learn/module/')?<ModuleScreen moduleId={path.split('/').pop()}/>:path.startsWith('/budget')?<BudgetScreen mode={path==='/budget/create'?'create':path==='/budget/add'?'transaction':'overview'}/>:<LearningPath/>;return <SafeAreaProvider initialMetrics={{frame:{x:0,y:0,width:390,height:844},insets:{top:0,bottom:0,left:0,right:0}}}><React.Fragment key={route}><DiagnosticGate>{body}</DiagnosticGate></React.Fragment></SafeAreaProvider>;}AppRegistry.registerComponent('Review',()=>Review);AppRegistry.runApplication('Review',{rootTag:document.getElementById('root')});`);
 fs.writeFileSync(path.join(root,'index.html'),'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{height:100%;margin:0}#root{display:flex}</style><div id="root"></div><script src="/bundle.js"></script></html>');
 const config=getDefaultConfig(project);config.watchFolders=[project];config.resolver.nodeModulesPaths=[path.join(project,'node_modules')];
 config.resolver.extraNodeModules={'expo-asset':path.dirname(req.resolve('expo-asset/package.json',{paths:[path.dirname(req.resolve('expo/package.json'))]}))};
 const mocks={'expo-router':'router.js','@/contexts/auth-context':'auth.js','@/lib/supabase':'supabase.js'};
 config.resolver.resolveRequest=(context,name,platform)=>context.resolveRequest({...context,preferNativePlatform:false,mainFields:['browser','module','main']},mocks[name]?path.join(root,mocks[name]):name==='react-native'?'react-native-web':name.startsWith('@/')?path.join(project,name.slice(2)):name,platform);config.maxWorkers=2;
 await Metro.runBuild(config,{entry:'.expo/system-review/entry.js',out:path.join(root,'bundle.js'),platform:'web',dev:true,minify:false});
 console.log('Bundled real screens, hooks and RPC service with isolated auth/router adapters.');
}
async function answerAssessment(key,count){
 const data=await api('assessment',{key});
 for(let i=0;i<data.questions.length;i++){const q=data.questions[i],correct=answerKeys.find(k=>k.question_id===q.id).correct_option_id;const option=q.options.find(o=>i<count?o.id===correct:o.id!==correct);await button(option.text,'radio');await until('document.body.innerText.includes('+JSON.stringify((i+1)+'/'+data.questions.length+' ANSWERS SAVED')+')','Answer did not save');await button(i===data.questions.length-1?'Review all answers':'Next question');}
 await button('Confirm and submit');
 await until('document.body.innerText.includes('+JSON.stringify(count+'/'+data.questions.length)+')','Assessment result missing');
}
(async()=>{
 await require('./test-database.cjs').setup(db);
 await db.query('insert into auth.users(id) values($1)',[user]);
 answerKeys=(await db.query('select * from assessment_answer_keys')).rows;
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');
 if(!process.env.FINLIT_TEST_REUSE_BUNDLE) await prepareFixture();await new Promise(resolve=>server.listen(4391,'127.0.0.1',resolve));
 browser=spawn(process.env.FINLIT_BROWSER_PATH||'/opt/google/chrome/chrome',['--no-sandbox','--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-extensions','--remote-debugging-port=9330','--user-data-dir='+browserProfile,'about:blank'],{stdio:'ignore'});
 let pages;for(let i=0;i<300;i++){try{pages=await(await fetch('http://127.0.0.1:9330/json/list')).json();if(pages.length)break;}catch{}await delay(100);}assert(pages?.length,'Browser unavailable');
 socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
 socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);if(data.error)p.reject(Error(JSON.stringify(data.error)));else p.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails);});
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url:'http://127.0.0.1:4391/'});
 await until('document.body.innerText.includes("Discover Your Financial Knowledge")','First-time learner was not routed to assessment');await screenshot('01-assessment-intro');
 await go('/budget');await until('document.body.innerText.includes("No budget yet")','Budget blocked before assessment');
 await go('/learn/lesson/lesson-1-1');await until('window.__route==="/diagnostic"','Lesson deep link bypassed assessment');
 await button('Start Assessment');
 const attemptBefore=(await api('begin_assessment',{key:'diagnostic'})).attempt.id;
 const initial=(await api('assessment',{key:'diagnostic'})).questions[0];await button(initial.options[0].text,'radio');
 await send('Page.reload');await until('document.body.innerText.includes("Resume Assessment")','Interrupted assessment did not offer resume');await button('Resume Assessment');
 assert.equal((await api('begin_assessment',{key:'diagnostic'})).attempt.id,attemptBefore);
 await button('Previous question');
 failNext='answer';await button(initial.options[1].text,'radio');await until('document.body.innerText.includes("We could not connect")','Answer save failure hidden');await button('Retry');
 await answerAssessment('diagnostic',7);await screenshot('02-diagnostic-results');await button('Continue to Learning');await until('document.body.innerText.includes("Your learning priorities")','Priorities missing');
 await screenshot('03-learning-priorities');
 for(let i=1;i<=4;i++)await completeLesson('lesson-1-'+i);
 await go('/learn/challenge/1');await button('Start or resume');await answerAssessment('challenge-1',5);await until('document.body.innerText.includes("Review and try again")','Fail flow missing');await screenshot('03-failed-challenge');
 await button('Retake challenge');await answerAssessment('challenge-1',6);await until('document.body.innerText.includes("Module passed")','Pass flow missing');assert.equal((await api('assessment',{key:'challenge-1'})).history.length,2);await screenshot('04-passed-challenge');
 await completeLesson('lesson-2-1');await go('/learn/lesson/lesson-2-2?play=1');await button('Explore the concept');await button('Show worked example');await button('Try the practice');
 for(const [label,value]of[['Accommodation','600'],['Food','150'],['Transport','80'],['Data','40'],['Study materials','30']])await setInput(label+' allocation in kwacha',value);
 await screenshot('05-budget-practice');await button('Check answer');await until('document.body.innerText.includes("Your plan fits")','Allocation feedback missing');await button('Start checkpoint');
 const lesson=c.authoredLessons.find(l=>l.id==='lesson-2-2');for(let i=0;i<3;i++){await button(lesson.checkpoint[i].options[lesson.checkpoint[i].correct].text,'radio');await button('Check answer');await button(i===2?'View lesson summary':'Next question');}await button('Complete lesson');await button('Create My Budget');
 await until('document.body.innerText.includes("Planned income (K)")','Budget form missing');assert((await evaluate('window.__route')).includes('from=lesson-2-2'));
 await setInput('Planned income (K)','1500');await setInput('Food & groceries allocation (K)','300');await button('Save budget');await until('document.body.innerText.includes("Planned income: K1,500")','Budget not persisted');
 assert(!await evaluate('document.body.innerText.includes("Create a budget")'),'Create button remains after planning');await button('Add an entry from cash flow');await until('document.body.innerText.includes("Amount (K)")','Transaction form missing');await setInput('Amount (K)','250');await button('Food & groceries','radio');failNext='entry';await button('Save transaction');await until('document.body.innerText.includes("We could not connect")','Save error missing');assert.equal(await evaluate('Array.from(document.querySelectorAll("input")).find(e=>e.getAttribute("aria-label")==="Amount (K)").value'),'250');await button('Save transaction');
 await until('document.body.innerText.includes("Expenses: K250")','Transaction not persisted');assert.equal((await api('budget')).entries.length,1);await button('Spending insights');await button('Allow personalised insights');await until('document.body.innerText.includes("Explore the related lesson")','Insight missing');await screenshot('06-budget-insights');
 await button('Turn personalised insights off');await until('!document.body.innerText.includes("Explore the related lesson")','Consent withdrawal did not hide insights');await button('Return to learning');await until('document.body.innerText.includes("Lesson complete")','Lesson return did not preserve completion');
 await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await go('/budget');await until('document.body.innerText.includes("Expenses: K250")','Narrow budget missing');assert(await evaluate('document.documentElement.scrollWidth<=321'),'Budget horizontal overflow');await screenshot('07-budget-narrow');
 // Budget management and chart refresh use the same real RPC as the screens.
 const expense=(await api('budget')).entries[0];
 await button('Entries');await button('View or correct transaction');await setInput('Amount (K)','275');await button('Save transaction');
 await until('document.body.innerText.includes("Expenses: K275.00")','Corrected expense did not refresh');
 await button('Plan vs actual');await until('document.body.innerText.includes("Recorded: K275.00")','Comparison chart did not refresh');
 await button('View planned budget');await setInput('Food & groceries allocation (K)','400');await button('Save budget');
 await button('Plan vs actual');await until('document.body.innerText.includes("Planned: K400.00")','Budget edit did not refresh chart');
 await button('Record a transaction');await button('○ Income');await setInput('Amount (K)','1000');await button('Family & gifts','radio');await button('Save transaction');
 await until('document.body.innerText.includes("Received income: K1,000.00")','Income not refreshed');
 await button('Record a transaction');await button('Moving between my own accounts','checkbox');await setInput('Amount (K)','200');await setInput('Transfer fee (K, optional)','5');await button('Save transaction');
 await until('document.body.innerText.includes("Expenses: K280.00")','Transfer fee not counted exactly once');
 await button('Income vs expenses');await until('document.body.innerText.includes("Tracked net cash flow: K720.00")','Transfer inflated cash flow');
 await screenshot('11-budget-cash-flow');
 await button('Over time');await until('document.body.innerText.includes("Expenses: K280.00")','Timeline values incorrect');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await button('Categories');await until(`Array.from(document.querySelectorAll('[dir=auto]')).some(e=>e.textContent==='Planned budget'&&getComputedStyle(e).color==='rgb(246, 244, 245)')`,'Shared cards did not switch to dark theme');await evaluate(`Array.from(document.querySelectorAll('[role=heading]')).find(e=>e.textContent==='Spending by category').scrollIntoView({block:'start'})`);await screenshot('12-budget-chart-dark');
 assert(await evaluate('document.documentElement.scrollWidth<=321'),'Dark chart horizontal overflow');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});
 const transfer=(await api('budget')).entries.find(e=>e.entry_type==='transfer');
 await go('/budget/add?entry='+transfer.id);await button('Delete transaction');await until('document.body.innerText.includes("Confirm deletion")','Deletion lacked confirmation');await button('Keep transaction');
 assert((await api('budget')).entries.some(e=>e.id===transfer.id));await button('Delete transaction');await button('Confirm deletion');
 await until('document.body.innerText.includes("Expenses: K275.00")','Deleted fee still counted');
 assert(!(await api('budget')).entries.some(e=>e.id===transfer.id));
 await go('/budget/add?entry='+expense.id);await button('Delete transaction');await button('Confirm deletion');
 await button('Categories');await until('document.body.innerText.includes("No expenses recorded in this period.")','Empty expense chart was fabricated');
 await screenshot('13-budget-empty-expenses');
 // Both main entry types expose attached fees; totals include them once.
 await button('Add an entry from cash flow');await setInput('Amount (K)','10');await setInput('Transfer fee (K, optional)','1');await button('Recreation','radio');await screenshot('ux-expense-fee');await button('Save transaction');await until('document.body.innerText.includes("Expenses: K11.00")','Expense fee missing');
 await button('Add an entry from cash flow');await button('○ Income');await setInput('Amount (K)','100');await setInput('Transfer fee (K, optional)','2');await button('Loans received','radio');await screenshot('ux-income-fee');await button('Save transaction');await until('document.body.innerText.includes("Expenses: K13.00")','Income fee missing');
 assert.equal((await api('budget')).entries.filter(e=>e.fee_amount>0).length,2);
 await go('/dashboard');await until('document.body.innerText.includes("This month’s spending")&&document.body.innerText.includes("K13.00")','Home spending chart disagrees with entries');await evaluate(`Array.from(document.querySelectorAll('[role=heading]')).find(e=>e.textContent==='This month’s spending').scrollIntoView({block:'start'})`);await screenshot('ux-home-spending');
 await go('/budget');await button('View planned budget');await until('document.body.innerText.includes("Plan another period")','Additional period action missing');assert.equal(await evaluate('Array.from(document.querySelectorAll("input")).find(e=>e.getAttribute("aria-label")==="Food & groceries allocation (K)").value'),'400');
 // Money locations: real forms, the same entries and server-derived balances.
 await go('/budget');await until('document.body.innerText.includes("My Money Locations")','Money locations section missing');
 const initialMoneyReport=await api('budget');
 await button('Add money location');await setInput('Opening balance (K)','500');failNext='create_location';await button('Save money location');
 await until('document.body.innerText.includes("We could not connect")','Location save failure not shown');
 await button('Save money location');await until('document.body.innerText.includes("K500.00")&&!document.body.innerText.includes("Opening balance (K)")','Opening balance not displayed');
 assert.equal((await api('budget')).entries.length,initialMoneyReport.entries.length);
 assert.equal((await api('budget')).available,500);
 await button('Add money location');await button('○ Bank account');await setInput('Bank name','FNB Savings');await button('Lilac','radio');await button('Save money location');
 await until('document.body.innerText.includes("FNB Savings")&&!document.body.innerText.includes("Bank name")','Bank not saved');
 let locationData=await api('budget');const uiBank=locationData.locations.find(l=>l.provider==='FNB Savings');assert.equal(uiBank.colour,'#e4def1');
 await button('Add entry to MTN MoMo');await until('document.body.innerText.includes("Amount (K)")','Location entry navigation failed');
 assert(await evaluate(`Array.from(document.querySelectorAll('[role=radio]')).some(e=>e.getAttribute('aria-checked')==='true'&&e.textContent.includes('MTN MoMo'))`),'Tapped wallet not preselected');
 await setInput('Amount (K)','100');await button('Food & groceries','radio');await button('Save transaction');
 await until('document.body.innerText.includes("Total Available Money")','Linked expense not saved');assert.equal((await api('budget')).available,400);
 await button('Add entry to MTN MoMo');await button('○ Income');await setInput('Amount (K)','300');await button('Family & gifts','radio');await button('Save transaction');
 await until('document.body.innerText.includes("Total Available Money")','Linked income not saved');assert.equal((await api('budget')).available,700);
 await button('Add entry to MTN MoMo');await button('Moving between my own accounts','checkbox');await button('Destination: FNB Savings · K0.00','radio');await setInput('Amount (K)','200');await setInput('Transfer fee (K, optional)','2');await button('Save transaction');
 await until('document.body.innerText.includes("Total Available Money")','Linked transfer not saved');locationData=await api('budget');assert.equal(locationData.available,698);assert.equal(locationData.locations.find(l=>l.id===uiBank.id).balance,200);
 await button('Correct a balance');await button('Cash · K0.00','radio');await setInput('Correct balance (K)','450');await setInput('Reason (optional)','Cash counted');await button('Save correction');
 await until('document.body.innerText.includes("Total Available Money")&&!document.body.innerText.includes("Correct balance (K)")','Correction not saved');assert.equal((await api('budget')).available,1148);
 await button('Balance history');await until('document.body.innerText.includes("Cash counted")','Audit history missing');await button('Hide balance history');
 for(const theme of ['light','dark']) {
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
  await evaluate(`Array.from(document.querySelectorAll('[dir=auto]')).find(e=>e.textContent==='My Money Locations').scrollIntoView({block:'start'})`);await delay(200);
  assert(await evaluate('document.documentElement.scrollWidth<=321'),'Money locations overflow');await screenshot('money-locations-'+theme);
 }

 await button('Add money location');await button('● Mobile Money');await button('○ Other provider');await setInput('Mobile money provider name','Zamtel Kwacha');await button('Peach','radio');await button('Save money location');
 await until('document.body.innerText.includes("Zamtel Kwacha")&&!document.body.innerText.includes("Opening balance (K)")','Custom provider not saved');
 const customProviderData=await api('budget');const customProviderLocation=customProviderData.locations.find(l=>l.provider==='Zamtel Kwacha');assert.equal(customProviderLocation.colour,'#f1dfd3');
 await button('Delete a location');await button('Zamtel Kwacha · K0.00','radio');await button('Confirm deletion');
 await until(`!document.querySelector('[aria-label="Add entry to Zamtel Kwacha"]')&&!document.body.innerText.includes("Confirm deletion")`,'Deleted location still visible');
 assert.equal((await api('budget')).locations.find(l=>l.id===customProviderLocation.id).active,false);assert.equal((await api('budget')).available,customProviderData.available);
 // Finish remaining curriculum through the same RPC, then exercise the final player and comparison UI.
 for(let mi=2;mi<=6;mi++){
  for(let li=1;li<=4;li++){const key=`lesson-${mi}-${li}`;if(!(await api('snapshot')).lessons[key]?.completed)await completeLesson(key);}
  let d=await api('begin_assessment',{key:'challenge-'+mi});for(const q of d.questions)d.attempt=await api('answer',{attempt:d.attempt.id,revision:d.attempt.revision,question:q.id,option:answerKeys.find(k=>k.question_id===q.id).correct_option_id});await api('submit',{attempt:d.attempt.id,revision:d.attempt.revision});
 }
 await go('/final-assessment');await button('Start Assessment');await answerAssessment('final',15);await screenshot('08-final-results');await button('View learning comparison');await until('document.body.innerText.includes("+44.4 percentage points")','Comparison delta incorrect');await screenshot('09-learning-comparison');
 assert(await evaluate('document.documentElement.scrollWidth<=321'),'Comparison horizontal overflow');
 await evaluate(`document.querySelectorAll('[dir=auto]').forEach(e=>{const s=getComputedStyle(e);e.style.fontSize=(parseFloat(s.fontSize)*1.35)+'px';e.style.lineHeight=(parseFloat(s.lineHeight)*1.35)+'px';})`);assert(await evaluate('document.documentElement.scrollWidth<=321'),'Large text horizontal overflow');await screenshot('10-comparison-large-text');
 // Visual restoration: all major learning and finance surfaces in both themes at 320px.
 for(const theme of ['light','dark']) {
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme}]});
  for(const [name,route,ready] of [['learning','/learn','Build your financial confidence'],['module','/learn/module/module-1','Module challenge'],['lesson','/learn/lesson/lesson-1-1?play=1','Stage '],['budget','/budget','TRACKED NET CASH FLOW'],['entry','/budget/add','Amount (K)'],['plan','/budget/create','Planned income (K)'],['knowledge','/knowledge-profile','Correct answers in this assessment'],['comparison','/learning-comparison','+44.4 percentage points']]) {
   await go(route);await until('document.body.innerText.includes('+JSON.stringify(ready)+')','Visual review screen missing: '+name);
   await evaluate('document.querySelectorAll("div").forEach(e=>{if(e.scrollTop)e.scrollTop=0})');await delay(150);
   assert(await evaluate('document.documentElement.scrollWidth<=321'),theme+' '+name+' overflow');await screenshot('visual-'+name+'-'+theme);
  }
 }
 assert.equal(exceptions.length,0,JSON.stringify(exceptions));console.log('PASS: actual screens + SQL: diagnostic, recommendations, challenge 5/8 fail and 6/8 pass, history, editable allocation, saved completion, lesson-to-budget return, budget and transaction edits/deletions, income/transfers/fees, money-location openings/preselection/transfers/corrections/history/retry, chart refresh and empty states, dark/light charts, failed transaction retry, consent and insights, 390/320px layouts. No live Supabase used.');
})().catch(e=>{console.error(e);console.error('Browser exceptions',JSON.stringify(exceptions));process.exitCode=1;}).finally(async()=>{try{if(socket?.readyState===1)await send('Browser.close');}catch{}socket?.close();browser?.kill();server.close();await db.close();});
