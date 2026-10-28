const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    throw new Error('Unexpected import ' + name);
  }, Promise, Date, Map, Set, Error, console });
  return module.exports;
}
const database = { assessment_attempts: [], assessment_answers: [], assessment_questions: [], lesson_progress: [] };
const calls = [];
let failAnswers = false;
let enforcePrivileges = true;
const supabase = { from(table) {
  const filters = [];
  let operation = 'select', values, conflict, one = false;
  const q = {
    select() { return q; },
    eq(key, value) { filters.push(row => row[key] === value); return q; },
    is(key, value) { filters.push(row => row[key] === value); return q; },
    order() { return q; }, limit() { return q; },
    maybeSingle() { one = true; return q; }, single() { one = true; return q; },
    insert(value) { operation = 'insert'; values = value; return q; },
    update(value) { operation = 'update'; values = value; return q; },
    upsert(value, options) { operation = 'upsert'; values = value; conflict = options.onConflict.split(','); return q; },
    then(resolve, reject) {
      return Promise.resolve().then(() => {
        calls.push({ table, operation });
        if (failAnswers && table === 'assessment_answers' && (operation === 'insert' || operation === 'update')) return { data: null, error: new Error('write failed') };
        const grants = {
          assessment_attempts: { insert: ['user_id', 'assessment_id'], update: [] },
          assessment_answers: { insert: ['attempt_id', 'question_id', 'selected_option_id'], update: ['selected_option_id'] },
          lesson_progress: { insert: [], update: [], upsert: [] },
        };
        if (enforcePrivileges && operation !== 'select' && Object.keys(values).some(key => !(grants[table]?.[operation] || []).includes(key))) {
          return { data: null, error: { code: '42501', message: 'permission denied' } };
        }
        let rows = database[table].filter(row => filters.every(filter => filter(row)));
        if (operation === 'insert') {
          if (table === 'assessment_answers' && database[table].some(row => row.attempt_id === values.attempt_id && row.question_id === values.question_id)) {
            return { data: null, error: { code: '23505', message: 'duplicate answer' } };
          }
          const row = { id: 'id-' + database[table].length, completed_at: null, ...values };
          database[table].push(row); rows = [row];
        } else if (operation === 'upsert') {
          let row = database[table].find(row => conflict.every(key => row[key] === values[key]));
          if (row) Object.assign(row, values);
          else { row = { id: 'id-' + database[table].length, ...values }; database[table].push(row); }
          rows = [row];
        } else if (operation === 'update') rows.forEach(row => Object.assign(row, values));
        return { data: one ? rows[0] ?? null : rows, error: null, count: rows.length };
      }).then(resolve, reject);
    },
  };
  return q;
} };
async function serviceChecks() {
  const service = load('services/assessment-attempts.ts', { '@/lib/supabase': { supabase } });
  const progress = load('services/progress.ts', { '@/lib/supabase': { supabase } });
  const [a, b] = await Promise.all([service.createAssessmentAttempt('alice', 'assessment'), service.createAssessmentAttempt('alice', 'assessment')]);
  assert.equal(a.id, b.id);
  assert.equal(database.assessment_attempts.length, 1);
  database.assessment_questions.push({ id: 'q1', assessment_id: 'assessment' }, { id: 'q2', assessment_id: 'assessment' }, { id: 'other', assessment_id: 'other-assessment' });
  await assert.rejects(service.saveAssessmentAnswer('bob', { attempt_id: a.id, question_id: 'q1', selected_option_id: 'o1' }), /your account/);
  await assert.rejects(service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'other', selected_option_id: 'o1' }), /does not belong/);
  await assert.rejects(service.submitAssessmentAttempt('alice', a.id), /every assessment question/);
  await Promise.all([service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'q1', selected_option_id: 'o1' }), service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'q1', selected_option_id: 'o2' })]);
  assert.equal(database.assessment_answers.length, 1);
  failAnswers = true;
  await assert.rejects(service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'q2', selected_option_id: 'o3' }), /write failed/);
  failAnswers = false;
  await service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'q2', selected_option_id: 'o3' });
  await assert.rejects(service.submitAssessmentAttempt('alice', a.id), /coming soon/);
  await assert.rejects(progress.completeLesson('alice', 'lesson'), /coming soon/);
  enforcePrivileges = false;
  await service.submitAssessmentAttempt('alice', a.id);
  const updates = calls.filter(call => call.operation === 'update').length;
  await service.submitAssessmentAttempt('alice', a.id);
  assert.equal(calls.filter(call => call.operation === 'update').length, updates);
  await assert.rejects(service.saveAssessmentAnswer('alice', { attempt_id: a.id, question_id: 'q1', selected_option_id: 'o1' }), /already been submitted/);
  await Promise.all([progress.completeLesson('alice', 'lesson'), progress.completeLesson('alice', 'lesson')]);
  assert.equal(database.lesson_progress.length, 1);
  const completedAt = database.lesson_progress[0].completed_at;
  await progress.completeLesson('alice', 'lesson');
  assert.equal(database.lesson_progress[0].completed_at, completedAt);
}

// Minimal hook lifecycle harness: deferred I/O verifies stale responses and save ordering.
function harness(services) {
  let slots = [], index = 0, effects = [], dirty = false, latest, args;
  const changed = (a, b) => !a || a.length !== b.length || a.some((value, i) => value !== b[i]);
  const react = {
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; dirty = true; }];
    },
    useRef(initial) { const i = index++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = index++; if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: fn, deps }; return slots[i].value; },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const old = slots[i]; slots[i] = { deps };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const hook = load('hooks/use-assessment-attempt.ts', { react, '@/services/assessment-attempts': services }).useAssessmentAttempt;
  const render = (...next) => {
    if (next.length) args = next;
    index = 0; dirty = false; latest = hook(...args);
    const pending = effects; effects = []; pending.forEach(effect => effect());
    return latest;
  };
  return { render, get: () => latest, async settle() {
    for (let i = 0; i < 15; i++) { await Promise.resolve(); if (dirty) render(); }
    return latest;
  } };
}
async function hookChecks() {
  let resolveSave, rejectSave, saves = 0;
  const h = harness({
    createAssessmentAttempt: async (user, assessment) => ({ id: user + assessment }),
    getAssessmentResults: async (user, id) => ({ attempt: { id }, answers: [{ question_id: 'q1', selected_option_id: 'saved' }] }),
    saveAssessmentAnswer: () => { saves++; return new Promise((resolve, reject) => { resolveSave = resolve; rejectSave = reject; }); },
    submitAssessmentAttempt: async () => { throw new Error('not part of this test'); },
  });
  h.render('alice', 'assessment');
  assert.equal((await h.settle()).answers.q1, 'saved');
  const save = h.get().saveAnswer('q1', 'new');
  await h.get().saveAnswer('q1', 'duplicate');
  assert.equal(saves, 1);
  assert.equal((await h.settle()).answers.q1, 'saved');
  rejectSave(new Error('offline')); await save;
  assert.equal((await h.settle()).answers.q1, 'saved');
  assert.equal(h.get().error.message, 'offline');
  const pending = h.get().saveAnswer('q1', 'new');
  h.render('bob', 'assessment');
  await h.settle();
  resolveSave({ selected_option_id: 'new' }); await pending;
  assert.equal((await h.settle()).answers.q1, 'saved');
  assert.equal(h.get().error, null);
}
function messageChecks() {
  const { describeSupabaseError } = load('lib/supabase-diagnostics.ts', {});
  assert.equal(describeSupabaseError({ code: '42501', message: 'permission denied for relation lesson_progress' }), 'This action is unavailable right now. Please try again later.');
  assert.equal(describeSupabaseError({ code: 'PGRST200', message: 'schema cache relation details' }), 'We could not load this information. Please try again.');
  assert.equal(describeSupabaseError(new Error('Network request failed')), 'We could not connect. Check your internet connection and try again.');
  assert.equal(describeSupabaseError(new Error('internal backend stack trace'), 'Please try again later.'), 'Please try again later.');
  assert.equal(describeSupabaseError(new Error('Invalid login credentials')), 'The email or password is incorrect.');
  const message = 'Assessment submission is coming soon. Your saved answers are still available.';
  assert.equal(describeSupabaseError(new Error(message)), message);
}
(async () => {
  messageChecks(); await serviceChecks(); await hookChecks();
  console.log('Debug regression checks passed: owned attempts, resume, failed-save state, duplicate writes, incomplete/repeated submission, account changes and lesson completion races.');
})().catch(error => { console.error(error); process.exitCode = 1; });
