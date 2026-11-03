const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, { module, exports: module.exports, require: name => {
    if (name in imports) return imports[name];
    throw new Error('Unexpected import: ' + name);
  }, console, Promise }, { filename: path });
  return module.exports;
}
const c = { ...require('./load-typescript.cjs')('content/learning.ts'), ...require('./load-typescript.cjs')('content/authored.ts') };
const parse = c.parseProgress; c.parseProgress = raw => parse(raw,c.authoredLessons);
const lesson = c.sampleLesson;
assert.equal(c.curriculum.length, 6);
assert.equal(new Set(c.curriculum.flatMap(m => m.lessons.map(l => l.id))).size, 24);
assert(c.curriculum.every(m => m.lessons.length === 4));
assert.equal(c.authoredLessons.length, 24, 'Every lesson has teaching content');
assert.equal(lesson.checkpoint.length, 3);
assert.equal(lesson.sourceStatus, 'reviewed');
assert(lesson.references.length >= 2);
assert(lesson.estimatedMinutes >= 9 && lesson.estimatedMinutes <= 12);
assert.equal(c.LEARNING_RULES.challengeQuestions, 8);
assert.equal(c.LEARNING_RULES.challengePassScore, 6);
assert.equal(lesson.example.rows.reduce((a, b) => a + b.amount, 0), 1300);
assert.equal(lesson.practice.correct, 1500 - 1300 - 80);
for (const value of ['', ' ', '-1', 'NaN', 'Infinity', '1,000', 'K120', '1e3', '1.234']) assert.equal(c.numericAnswer(value), null, value);
assert.equal(c.numericAnswer('120.00'), 120);
let r = c.newLessonRecord(lesson.version);
const act = type => { r = c.transition(lesson, r, { type }); };
act('finish');
assert(!r.completed);
act('next'); act('next'); act('next');
assert.equal(r.stage, 3);
act('next'); act('submit-practice');
assert.equal(r.stage, 3, 'Practice cannot be skipped');
r.practice = '200'; act('submit-practice');
assert.equal(r.stage, 4);
assert(r.practiceSubmitted);
act('retry-practice');
assert.equal(r.stage, 3);
assert(!r.practiceSubmitted);
r.practice = '120'; act('submit-practice'); act('next');
assert.equal(r.stage, 5);
act('next'); act('check-answer');
assert.equal(r.checkpointIndex, 0);
assert(!r.checked[0], 'Unanswered checkpoint cannot be checked');
for (let i = 0; i < 3; i++) {
  r.answers[i] = i === 0 ? 0 : lesson.checkpoint[i].correct;
  act('next'); // Selection alone does not advance or reveal.
  assert.equal(r.checkpointIndex, i);
  act('check-answer');
  assert(r.checked[i]);
  if (i === 0) { act('previous'); assert.equal(r.stage, 4); act('next'); assert(r.checked[0]); }
  act('next');
}
assert.equal(r.stage, 6);
assert(!r.completed, 'Summary requires explicit completion save');
assert.equal(c.score(lesson, r), 2);
act('finish');
assert(r.completed);
act('review');
assert.equal(r.stage, 0);
assert(r.completed, 'Review preserves completion');
act('next'); act('next'); act('next'); act('next');
act('retry-practice');
assert(r.completed && r.practiceSubmitted, 'Review cannot reset submitted work');
assert.throws(() => c.parseProgress('{'));
assert.throws(() => c.parseProgress('[]'));
assert.throws(() => c.parseProgress('{"lessons":[]}'));
assert.throws(() => c.validateRecord(lesson, { ...c.newLessonRecord(2), stage: 6, maxStage: 6 }));
assert.equal(Object.keys(c.parseProgress(JSON.stringify({ lessons: { [lesson.id]: { version: 1 } } })).lessons).length, 0);

const storage = new Map();
let fail = false;
const service = load('services/sample-progress.ts', {
  'react-native': { Platform: { OS: 'android' } },
  'expo-secure-store': {
    getItemAsync: async key => storage.get(key) ?? null,
    setItemAsync: async (key, value) => { if (fail) throw new Error('disk full'); storage.set(key, value); },
  },
  '@/content/learning': c, '@/content/authored': c,
});
(async () => {
  let saved = c.newLessonRecord(2);
  let next = c.transition(lesson, saved, { type: 'next' });
  await service.saveSampleProgress('alice', lesson.id, next, saved);
  assert.equal((await service.loadSampleProgress('alice')).lessons[lesson.id].stage, 1);
  assert.equal(Object.keys((await service.loadSampleProgress('bob')).lessons).length, 0);
  await assert.rejects(service.saveSampleProgress('alice', lesson.id, next, saved), /another view/);
  saved = next; next = c.transition(lesson, saved, { type: 'next' });
  fail = true;
  await assert.rejects(service.saveSampleProgress('alice', lesson.id, next, saved), /disk full/);
  assert.equal((await service.loadSampleProgress('alice')).lessons[lesson.id].stage, 1);
  fail = false;
  await service.saveSampleProgress('alice', lesson.id, next, saved);
  assert.equal((await service.loadSampleProgress('alice')).lessons[lesson.id].stage, 2);
  const full = { ...r, stage: 6 };
  await service.saveSampleProgress('alice', lesson.id, full, next);
  await assert.rejects(service.saveSampleProgress('alice', lesson.id, { ...full, completed: false }, full), /cannot be reset/);
  await service.saveSampleProgress('alice', lesson.id, { ...full, stage: 0 }, full);
  const restored = (await service.loadSampleProgress('alice')).lessons[lesson.id];
  assert(restored.completed);
  assert.equal(restored.stage, 0);
  assert.equal(restored.answers[0], 0);
  for (const value of storage.values()) assert(Buffer.byteLength(value) < 2048);
  console.log('Learning checks passed: 24 authored lessons, seven-stage gates, checked feedback, back/review, math, validation, restore, account isolation, failed saves, stale-write rejection, completion preservation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
