const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {PGlite}=require(process.env.FINLIT_PGLITE_PATH||'@electric-sql/pglite');
const {setup,migrate,files}=require('./test-database.cjs');const db=new PGlite();
const migration=files().find(f=>f.includes('knowledge_assessment_system'));
const sql=async(q,p)=>(await db.query(q,p)).rows;
async function as(id){await db.exec('reset role');await sql("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');}
const api=async(action,payload={})=>(await sql('select public.finlit_api($1,$2::jsonb) v',[action,JSON.stringify(payload)]))[0].v;
let keys;
async function take(pattern){let d=await api('begin_assessment',{key:'diagnostic'});for(let i=0;i<18;i++){const q=d.questions[i],correct=keys.find(k=>k.question_id===q.id).correct_option_id;d.attempt=await api('answer',{attempt:d.attempt.id,revision:d.attempt.revision,question:q.id,option:i%3<pattern[Math.floor(i/3)]?correct:q.options.find(o=>o.id!==correct).id});}return api('submit',{attempt:d.attempt.id,revision:d.attempt.revision});}
(async()=>{
 await setup(db,{through:'20261102215255_index_assessment_composite_foreign_keys.sql'});
 const legacy=randomUUID(),historical=randomUUID();
 await sql('insert into auth.users(id) values($1),($2)',[legacy,historical]);
 await sql("insert into lesson_progress(user_id,lesson_id,player_state) select $1,id,'{\"stage\":1}' from lessons where content_key='lesson-1-1'",[legacy]);
 const old=(await sql("insert into assessment_attempts(user_id,assessment_id,score,completed_at,topic_scores) select $1,id,4,now(),'{\"module-1\":{\"correct\":1,\"total\":2}}' from assessments where content_key='diagnostic' returning id",[historical]))[0].id;
 await migrate(db,migration);keys=await sql('select * from assessment_answer_keys');
 await as(legacy);assert.equal((await api('journey')).legacy,true);assert.equal((await api('journey')).required,false);assert.equal((await api('lesson',{key:'lesson-1-1'})).id,'lesson-1-1');
 const late=await take([1,1,1,1,1,1]);assert.equal(late.analysis.classification,'late_baseline');
 await as(historical);assert.equal((await api('journey')).baseline.id,old);assert.equal((await api('journey')).required,false);assert.equal((await api('begin_assessment',{key:'diagnostic'})).completedAttempt,old);
 await db.exec('reset role');await migrate(db,migration);await as(historical);assert.equal((await api('journey')).baseline.id,old,'Replay preserves original baseline');
 const patterns=[[3,3,3,3,3,3],[0,0,0,0,0,0],[3,1,3,3,3,3],[1,1,3,3,3,3],[3,1,2,0,2,1]];
 for(const pattern of patterns){await db.exec('reset role');const id=randomUUID();await sql('insert into auth.users(id) values($1)',[id]);await as(id);
  assert.equal((await api('journey')).required,true);const budget=await api('budget');const cat=budget.categories.find(c=>c.entry_type==='expense');await api('save_budget',{start:'2026-01-01',end:'2026-01-31',income:100,allocations:{[cat.id]:50},revision:0});
  await api('entry',{request:randomUUID(),date:'2026-01-01',amount:10,type:'expense',category:cat.id});
  const r=await take(pattern);assert.equal(Number(r.analysis.score),pattern.reduce((a,b)=>a+b,0));assert.equal(r.analysis.total,18);assert.equal(r.attempt.passed,null);
  pattern.forEach((n,i)=>assert.deepEqual(r.analysis.scores['module-'+(i+1)],{correct:n,total:3}));
  const expected=pattern.map((n,i)=>({n,key:'module-'+(i+1)})).filter(x=>x.n<3).sort((a,b)=>a.n-b.n||a.key.localeCompare(b.key)).map(x=>x.key);
  const journey=await api('journey');assert.deepEqual(journey.priorities.map(p=>p.key),expected);assert.deepEqual((await api('journey')).priorities,journey.priorities);
  assert.equal((await api('snapshot')).modules.filter(m=>m.completed).length,0,'Diagnostic does not award module mastery');
  await assert.rejects(()=>api('lesson',{key:'lesson-2-1'}),/preceding/);await assert.rejects(()=>api('assessment',{key:'final'}),/all 24/);
  await assert.rejects(()=>sql('select * from assessment_answer_keys'),/permission denied/);await assert.rejects(()=>api('result',{attempt:late.attempt.id}),/unavailable/);
 }
 // Late and historical profiles must not produce an improvement score even with a final result.
 await db.exec('reset role');await sql("insert into assessment_attempts(user_id,assessment_id,score,completed_at) select $1,id,12,now() from assessments where content_key='final-v1'",[legacy]);await as(legacy);assert.equal((await api('journey')).comparison.comparable,false);assert.equal((await api('journey')).comparison.correctDifference,null);
 await db.exec('reset role');await sql("update assessments set comparison_group='different-version' where content_key='final-v1'");await as(legacy);assert.equal((await api('journey')).comparison.comparable,false);
 console.log('PASS: five score patterns, deterministic priorities, baseline immutability, legacy progress, historical 12-question results, late-assessment limitations, independent budgets and cross-account security.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
