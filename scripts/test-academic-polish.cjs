const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.FINLIT_PGLITE_PATH || '@electric-sql/pglite');
const { setup, migrate, files } = require('./test-database.cjs');
const load = require('./load-typescript.cjs');
const { authoredLessons } = load('content/authored.ts');
const { forms } = require('./knowledge-content.cjs');
const patch = files().find(f => f.endsWith('_academic_content_polish.sql'));
const previous = files()[files().indexOf(patch) - 1];
(async () => {
 const db = new PGlite();
 try {
  await setup(db, { through: previous });
  const rows = async sql => (await db.query(sql)).rows;
  const lessonRows = () => rows('select content_key,revision,structured_content from public.lessons where is_published order by content_key');
  const options = () => rows(`select o.*, k.correct_option_id, a.content_key, q.sort_order question_order from public.assessment_options o join public.assessment_questions q on q.id=o.question_id join public.assessments a on a.id=q.assessment_id join public.assessment_answer_keys k on k.question_id=q.id order by o.id`);
  const questions = () => rows('select * from public.assessment_questions order by id');
  const keys = () => rows('select * from public.assessment_answer_keys order by question_id');
  const before = await lessonRows(), beforeOptions = await options(), beforeQuestions = await questions(), beforeKeys = await keys();
  fs.writeFileSync('/tmp/finlit-academic-before-hashes.json', JSON.stringify(await rows('select content_key,md5(structured_content::text) hash from public.lessons where is_published order by content_key')));
  // Both a changed bank and a changed curriculum must abort without partial writes.
  const victim = beforeOptions.find(o => o.content_key === 'diagnostic-v2' && o.question_order === 3 && o.id !== o.correct_option_id);
  await db.query('update public.assessment_options set option_text=$1 where id=$2', ['Changed bank', victim.id]);
  await assert.rejects(() => migrate(db, patch), /Expected 20 original incorrect options/); await db.exec('rollback');
  assert.deepEqual(await lessonRows(), before);
  await db.query('update public.assessment_options set option_text=$1 where id=$2', [victim.option_text, victim.id]);
  await db.exec("update public.lessons set revision=99 where content_key='lesson-1-1'");
  await assert.rejects(() => migrate(db, patch), /expected 24 original lesson revisions/); await db.exec('rollback');
  await db.exec("update public.lessons set revision=1 where content_key='lesson-1-1'");
  // Create genuine learner records with the real API, then prove the safeguard is atomic.
  await db.exec("insert into auth.users(id) values('10000000-0000-4000-a000-000000000001'); select set_config('request.jwt.claim.sub','10000000-0000-4000-a000-000000000001',false)");
  const api = async (action, payload={}) => (await db.query('select public.finlit_api($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;
  const start = await api('begin_assessment', { key: 'diagnostic' });
  assert(start);
  await assert.rejects(() => migrate(db, patch), /requires a new content version/); await db.exec('rollback');
  assert.deepEqual(await lessonRows(), before);
  assert.deepEqual(await options(), beforeOptions);
  await db.exec("delete from public.assessment_attempts; insert into public.lesson_progress(user_id,lesson_id) select '10000000-0000-4000-a000-000000000001',id from public.lessons where content_key='lesson-1-1'");
  await assert.rejects(() => migrate(db, patch), /requires a new content version/); await db.exec('rollback');
  assert.deepEqual(await lessonRows(), before);
  assert.deepEqual(await options(), beforeOptions);
  // Disposal of test fixture only, never live data.
  await db.exec("delete from auth.users where id='10000000-0000-4000-a000-000000000001'");
  await migrate(db, patch);
  const after = await lessonRows(); assert.equal(after.length, 24);
  for (const row of after) {
   const canonical = authoredLessons.find(l => l.id === row.content_key);
   assert.deepEqual(row.structured_content, JSON.parse(JSON.stringify(canonical)), row.content_key+' must match authoring source');
   assert.equal(row.revision, canonical.version);
   const old = before.find(l => l.content_key === row.content_key);
   assert.equal(row.revision, old.revision+1);
   assert.deepEqual(row.structured_content.checkpoint, old.structured_content.checkpoint);
   assert.equal(row.structured_content.practice.correct, old.structured_content.practice.correct);
   assert.equal(row.structured_content.practice.kind, old.structured_content.practice.kind);
  }
  assert.deepEqual(await questions(), beforeQuestions); assert.deepEqual(await keys(), beforeKeys);
  const afterOptions = await options(); let changed = 0;
  for (let i=0;i<beforeOptions.length;i++) {
   const old = beforeOptions[i], next = afterOptions[i];
   if (old.option_text !== next.option_text) { changed++; assert.notEqual(old.id,old.correct_option_id); }
   assert.deepEqual({...next,option_text:old.option_text},old);
  }
  assert.equal(changed,20);
  for (const form of forms) for (let i=0;i<form.questions.length;i++) {
   const opts = afterOptions.filter(o=>o.content_key===form.key&&o.question_order===i+1);
   assert.deepEqual(opts.map(o=>o.option_text).sort(),[...form.questions[i].options].sort());
  }
  await assert.rejects(() => migrate(db,patch), /expected 24 original lesson revisions/); await db.exec('rollback');
  assert.deepEqual(await lessonRows(),after);
  const counts=await rows(`select a.content_key,count(q.id)::int n from public.assessments a join public.assessment_questions q on q.assessment_id=a.id where a.is_published group by a.content_key`);
  assert.equal(counts.filter(x=>x.n===8).length,6); assert.equal(counts.filter(x=>x.n===18).length,2);
  fs.writeFileSync('/tmp/finlit-academic-after-hashes.json', JSON.stringify(await rows('select content_key,md5(structured_content::text) hash from public.lessons where is_published order by content_key')));
  fs.writeFileSync('/tmp/finlit-academic-expected.json',JSON.stringify({lessons:after,options:afterOptions}));
  const {execFileSync}=require('node:child_process');
  const temp=fs.mkdtempSync('/tmp/finlit-polish-seeds-');
  try {
   for(const name of ['curriculum','knowledge']) {
    const file=temp+'/'+name+'.sql';fs.writeFileSync(file,'');
    execFileSync(process.execPath,['scripts/generate-'+name+'.cjs',file]);
    await db.exec(fs.readFileSync(file,'utf8'));
    assert.throws(()=>execFileSync(process.execPath,['scripts/generate-'+name+'.cjs',file],{stdio:'pipe'}),/existing migrations are immutable/);
   }
   assert.deepEqual(await lessonRows(),after);
   assert.deepEqual(await options(),afterOptions);
   assert.equal((await rows("select is_published from public.assessments where content_key='diagnostic'"))[0].is_published,false);
  } finally {fs.rmSync(temp,{recursive:true});}
  console.log('Academic patch passed: canonical parity, 24 revisions, 20 distractors, unchanged questions/keys, atomic drift/learner/replay guards.');
 } finally { await db.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
