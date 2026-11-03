const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const load=require('./load-typescript.cjs');
const c={...load('content/learning.ts'),...load('content/authored.ts')},p=load('content/progression.ts'),b=load('content/budget-rules.ts');
const {PGlite}=require(process.env.FINLIT_PGLITE_PATH||'@electric-sql/pglite');
const alice='10000000-0000-4000-a000-000000000001',bob='10000000-0000-4000-a000-000000000002';
const db=new PGlite();
const {setup,migrate,files}=require('./test-database.cjs');
const migrations=files().filter(f=>f.includes('knowledge_assessment_system'));
const {forms}=require('./knowledge-content.cjs');
async function query(sql,args){return (await db.query(sql,args)).rows;}
async function as(user){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user??'']);await db.exec('set role '+(user?'authenticated':'anon'));}
async function api(action,payload={}){return(await query('select public.finlit_api($1,$2::jsonb) value',[action,JSON.stringify(payload)]))[0].value;}
async function rejected(action,pattern){await assert.rejects(action,pattern);}
async function advanceLesson(key){
 const lesson=await api('lesson',{key});let record=c.newLessonRecord(lesson.version);
 const save=async(next)=>{const saved=await api('save_lesson',{key,record:next,expected:record});record=saved;return saved;};
 const act=async type=>save(c.transition(lesson,record,{type}));
 await rejected(()=>save({...record,stage:6,maxStage:6,completed:true}),/Stages|checkpoint|practice/);
 await act('next');await act('next');await act('next');
 if(lesson.practice.kind==='allocation'){
  await rejected(()=>save({...record,stage:4,maxStage:4,practiceSubmitted:true,practice:'{}'}),/allocation/);
  const bad=Object.fromEntries(lesson.practice.allocation.fields.map(f=>[f.id,String(f.minimum)]));bad.food='-1';
  await rejected(()=>save({...record,stage:4,maxStage:4,practiceSubmitted:true,practice:JSON.stringify(bad)}),/allocation/);
 }
 record=await save({...record,practice:lesson.practice.kind==='allocation'?JSON.stringify(Object.fromEntries(lesson.practice.allocation.fields.map(f=>[f.id,String(f.minimum)]))):String(lesson.practice.correct)});await act('submit-practice');await act('next');
 for(let i=0;i<3;i++){await save({...record,answers:record.answers.map((v,j)=>j===i?lesson.checkpoint[i].correct:v)});await act('check-answer');await act('next');}
 assert.equal(record.stage,6);assert.equal(record.completed,false);
 const old=record;await act('finish');assert.equal(record.completed,true);
 assert.deepEqual(await api('save_lesson',{key,record,expected:old}),record,'Lost-response completion retry is idempotent');
 const review={...record,stage:0};await save(review);assert(record.completed);
 await rejected(()=>api('save_lesson',{key,record:{...record,completed:false},expected:record}),/cannot be reset/);
 return record;
}
async function take(key,correctCount){
 let data=await api('begin_assessment',{key});assert(data.questions.length>0);
 assert.equal((await api('begin_assessment',{key})).attempt.id,data.attempt.id,'Resume coalesces attempt');
 await rejected(()=>api('submit',{attempt:data.attempt.id,revision:data.attempt.revision}),/every question/);
 await rejected(()=>api('result',{attempt:data.attempt.id}),/Submit/);
 await db.exec('reset role');const keys=await query('select * from public.assessment_answer_keys');await as(alice);
 for(let i=0;i<data.questions.length;i++){
  const q=data.questions[i],correct=keys.find(k=>k.question_id===q.id).correct_option_id;
  const option=i<correctCount?correct:q.options.find(o=>o.id!==correct).id;
  const args={attempt:data.attempt.id,question:q.id,option,revision:data.attempt.revision};
  data.attempt=await api('answer',args);
  assert.equal((await api('answer',args)).revision,data.attempt.revision,'Answer retry does not duplicate mutation');
 }
 const result=await api('submit',{attempt:data.attempt.id,revision:data.attempt.revision});
 assert.equal(result.attempt.score,correctCount);assert.equal(result.feedback.length,data.questions.length);
 assert.deepEqual(await api('submit',{attempt:data.attempt.id,revision:0}),result,'Submission retry returns saved result');
 await rejected(()=>api('answer',{attempt:data.attempt.id,question:data.questions[0].id,option:data.questions[0].options[0].id,revision:result.attempt.revision}),/already submitted/);
 return result;
}
(async()=>{
 assert.equal(c.authoredLessons.length,24);assert.equal(c.curriculum.length,6);
 assert.equal(new Set(c.authoredLessons.flatMap(l=>l.checkpoint.map(q=>q.id))).size,72);
 for(const l of c.authoredLessons){assert.equal(l.checkpoint.length,3);assert(l.references.length>=2);assert(l.situation.body.length>100);assert(l.concept.introduction.length>200);assert(l.example.steps.length>=3);assert(l.takeaways.length>=2&&l.takeaways.length<=3);assert.equal(l.sourceStatus,'reviewed');for(const q of l.checkpoint){assert(q.options[q.correct]);assert(q.options.every(o=>o.feedback.length>10));}}
 assert.equal(c.sampleLesson.practice.correct,1500-1300-80);
 const allocationLesson=c.authoredLessons.find(l=>l.id==='lesson-2-2');
 const allocated={accommodation:'600',food:'120',transport:'60',data:'30',materials:'20'};
 assert(c.validPractice(allocationLesson,JSON.stringify(allocated)));
 assert(c.allocationReview(allocationLesson,JSON.stringify(allocated)).correct);
 assert(c.allocationReview(allocationLesson,JSON.stringify({...allocated,food:'190'})).correct,'Different feasible allocations are accepted');
 assert.equal(c.allocationReview(allocationLesson,JSON.stringify({...allocated,food:'191'})).correct,false,'Cannot allocate expected money');
 assert.equal(c.allocationReview(allocationLesson,JSON.stringify({...allocated,food:'0'})).correct,false,'Unfunded essentials get specific feedback');
 assert.equal(c.validPractice(allocationLesson,JSON.stringify({...allocated,food:120})),false);
 assert.equal(c.validPractice(allocationLesson,'invalid'),false);
 assert.equal(c.validPractice(allocationLesson,JSON.stringify({...allocated,food:'-1'})),false);
 assert.equal(b.validDate('2026-02-30'),false);assert.equal(b.validDate('2028-02-29'),true);
 const plan={id:'p',period_start:'2026-10-01',period_end:'2026-10-31',planned_income:100,allocations:{food:100},revision:1};
 const entries=[{id:'a',category_id:'food',entry_type:'expense',amount:80,occurred_on:'2026-10-10'},{id:'b',category_id:'food',entry_type:'transfer',amount:50,occurred_on:'2026-10-10'},{id:'c',category_id:'food',entry_type:'expense',amount:100,occurred_on:'2026-09-10'}];
 const fixture={plans:[plan],entries,categories:[{id:'food',name:'Food',entry_type:'expense'}],insights:false};
 assert.equal(b.budgetTotals(plan,entries).spent,80);assert.equal(b.budgetInsights(fixture,plan).length,0);fixture.insights=true;assert.equal(b.budgetInsights(fixture,plan)[0].id,'near-food');entries[0].amount=120;assert.equal(b.budgetInsights(fixture,plan)[0].id,'over-food');
 await setup(db);
 // Repeat migrations against the same data to check idempotency before learner records exist.
 for(const f of migrations)await migrate(db,f);
 assert.equal((await query('select count(*)::int n from public.lessons where is_published'))[0].n,24);
 await db.query('insert into auth.users(id) values($1),($2)',[alice,bob]);
 await as(null);await rejected(()=>api('snapshot'),/permission denied/);
 await as(alice);await rejected(()=>query('select * from assessment_answer_keys'),/permission denied/);await rejected(()=>query('select feedback_text from assessment_questions'),/permission denied/);
 await rejected(()=>query('insert into module_progress(user_id,module_id,status) select $1,id,\'completed\' from modules limit 1',[alice]),/permission denied/);
 await rejected(()=>api('lesson',{key:'lesson-2-1'}),/initial assessment|preceding/);
 await rejected(()=>api('begin_assessment',{key:'challenge-1'}),/initial assessment|four lessons/);
 assert.equal((await api('journey')).required,true);
 await rejected(()=>api('lesson',{key:'lesson-1-1'}),/initial assessment/);
 await rejected(()=>api('assessment',{key:'final'}),/all 24/);
 const beforeBudget=await api('budget');assert(beforeBudget.categories.length>0,'Budget independent of diagnostic');
 const interrupted=await api('begin_assessment',{key:'diagnostic'});assert.equal(interrupted.questions.length,18);
 const first=interrupted.questions[0];await api('answer',{attempt:interrupted.attempt.id,question:first.id,option:first.options[0].id,revision:0});
 const resumed=await api('begin_assessment',{key:'diagnostic'});assert.equal(resumed.attempt.id,interrupted.attempt.id);assert.equal(resumed.answers[first.id],first.options[0].id);
 const diagnostic=await take('diagnostic',7);assert.equal(diagnostic.attempt.passed,null);
 assert.equal(Object.keys(diagnostic.attempt.topic_scores).length,6);
 assert.equal(diagnostic.analysis.total,18);assert.equal(diagnostic.analysis.percentage,38.9);assert.equal(diagnostic.analysis.classification,'pre_learning');
 assert.equal((await api('journey')).required,false);
 assert.equal((await api('begin_assessment',{key:'diagnostic'})).completedAttempt,diagnostic.attempt.id);
 assert.equal((await api('journey')).baseline.id,diagnostic.attempt.id);
 await rejected(()=>query('update assessment_attempts set score=18 where id=$1',[diagnostic.attempt.id]),/permission denied/);
 await rejected(()=>query('update learner_assessment_state set baseline_attempt_id=null'),/permission denied/);
 await rejected(()=>query("select finlit_private.curriculum_api_v1('lesson','{}')"),/permission denied/);
 for(let mi=1;mi<=6;mi++){
  for(let li=1;li<=4;li++)await advanceLesson(`lesson-${mi}-${li}`);
  if(mi===1){const fail=await take('challenge-1',5);assert.equal(fail.attempt.passed,false);await rejected(()=>api('lesson',{key:'lesson-2-1'}),/preceding/);}
  const pass=await take('challenge-'+mi,6);assert.equal(pass.attempt.passed,true);
  const snapshot=await api('snapshot');assert(snapshot.modules.find(m=>m.key==='module-'+mi).completed);
  if(mi<6)assert(p.moduleAvailable('module-'+(mi+1),snapshot));
 }
 const snapshot=await api('snapshot');assert.equal(Object.values(snapshot.lessons).filter(l=>l.completed).length,24);assert.equal(snapshot.modules.filter(m=>m.completed).length,6);assert.equal(p.recommendation(snapshot).module,undefined);
 assert.equal((await api('journey')).finalAvailable,true);
 const final=await take('final',15);assert.equal(final.attempt.passed,null);assert.equal(final.analysis.total,18);
 const journey=await api('journey');assert.equal(journey.baseline.id,diagnostic.attempt.id);assert.equal(journey.final.id,final.attempt.id);assert(journey.comparison.comparable);assert.equal(journey.comparison.correctDifference,8);assert.equal(journey.comparison.percentagePointDifference,44.4);
 assert.equal((await api('begin_assessment',{key:'final'})).completedAttempt,final.attempt.id);
 const history=await api('assessment',{key:'challenge-1'});assert.equal(history.history.length,2);
 // A later failed retake cannot erase prior mastery.
 await take('challenge-1',0);assert((await api('snapshot')).modules.find(m=>m.key==='module-1').completed);
 let data=await api('budget');assert.equal(data.entries.length,0);assert.equal(data.insights,false);
 const category=data.categories.find(c=>c.entry_type==='expense'),income=data.categories.find(c=>c.entry_type==='income');
 const saved=await api('save_budget',{start:'2026-10-01',end:'2026-10-31',income:1000,allocations:{[category.id]:300},revision:0});
 await rejected(()=>api('save_budget',{start:'2026-10-15',end:'2026-11-15',income:1000,allocations:{},revision:0}),/overlap/);
 const edit={start:saved.period_start,end:saved.period_end,income:900,allocations:{[category.id]:400},revision:saved.revision};await api('save_budget',edit);await rejected(()=>api('save_budget',{...edit,income:700}),/another view/);
 const transaction={type:'expense',amount:125.50,category:category.id,date:'2026-10-10',description:'Test only',request:randomUUID()};
 const entry=await api('entry',transaction);assert.equal((await api('entry',transaction)).id,entry.id);await rejected(()=>api('entry',{...transaction,amount:999}),/already used/);
 await rejected(()=>api('entry',{...transaction,request:randomUUID(),category:income.id}),/category/);
 await rejected(()=>api('entry',{...transaction,request:randomUUID(),amount:-1}),/positive/);
 assert.equal(await api('consent',{enabled:true}),true);assert.equal((await api('budget')).insights,true);await api('consent',{enabled:false});
 await as(bob);assert.equal((await api('snapshot')).modules.filter(m=>m.completed).length,0);assert.equal((await api('budget')).entries.length,0);assert.equal((await query('select * from lesson_progress')).length,0);assert.equal((await query('select * from budget_plans')).length,0);
 await rejected(()=>api('result',{attempt:diagnostic.attempt.id}),/unavailable/);
 await rejected(()=>api('answer',{attempt:diagnostic.attempt.id,question:randomUUID(),option:randomUUID(),revision:0}),/unavailable/);
 await as(alice);const key='lesson-1-1',r=(await api('snapshot')).lessons[key];await api('save_lesson',{key,expected:r,record:{...r,stage:1}});await rejected(()=>api('save_lesson',{key,expected:r,record:{...r,stage:2}}),/another view/);
 await db.exec('reset role');for(const f of migrations)await migrate(db,f);await as(alice);assert.equal((await api('snapshot')).modules.length,6);
 assert.equal(new Set(forms.flatMap(f=>f.questions.map(q=>q.prompt))).size,36);
 for(const form of forms)for(let i=1;i<=6;i++){const qs=form.questions.filter(q=>q.topic==='module-'+i);assert.equal(qs.length,3);assert.deepEqual(qs.map(q=>q.kind),['conceptual','application','decision']);}
 console.log('PASS: 24 lessons, 72 checkpoints, 6 challenges, diagnostic, seven-stage progression, 5/8 fail and 6/8 pass, retake history, immutable completion, idempotent saves, stale writes, RLS/account isolation, budget periods, categories, amounts, consent and insight rules. Migrations repeat safely on the disposable repository-schema fixture.');
})().catch(e=>{console.error(e.message);if(e.query)console.error(e.query.slice(0,1200));process.exitCode=1;}).finally(()=>db.close());
