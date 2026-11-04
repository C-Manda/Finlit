// Node 22+. Isolated UI fixture; uses the actual player and storage service, with a test account and simulated save failures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const project = path.resolve(path.dirname(process.argv[1]), '..');
const root = path.join(project, '.expo', 'lesson-review');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
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
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.ttf') ? 'font/ttf' : 'text/html');
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
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
  const body = await evaluate('document.body.innerText');
  throw new Error(message + '\n' + body.slice(0, 1600));
}
async function button(text, role = 'button') {
  const selector = '[role="' + role + '"]';
  const target = text.replace(/^[●○]\s*/, '');
  const condition = role === 'radio' ? 'el.textContent.trim().endsWith(' + JSON.stringify(target) + ')' : 'el.textContent.trim() === ' + JSON.stringify(text);
  const find = 'Array.from(document.querySelectorAll(' + JSON.stringify(selector) + ')).find(el => ' + condition + ')';
  await until('!!(' + find + ')', 'Missing control: ' + text);
  const rect = await evaluate('(() => {const e=' + find + ';e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,disabled:e.getAttribute("aria-disabled")};})()');
  assert.notEqual(rect.disabled, 'true', text + ' should be enabled');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await delay(150);
}
async function input(value) {
  await evaluate('(() => {const e=document.querySelector("input");e.focus();e.select();})()');
  await send('Input.insertText', { text: value });
  await delay(100);
}
async function screenshot(name) {
  const learnerCopy = await evaluate('document.body.innerText');
  assert.doesNotMatch(learnerCopy, /development sample|sources? (?:not yet validated|await validation)|published module|secure server grading|curriculum preview|design target|sample progress|sample lesson/i, 'Developer copy appeared in the learner flow');
  const output = await send('Page.captureScreenshot', { format: 'png' });
  fs.mkdirSync(path.join(root, 'screens'), { recursive: true });
  fs.writeFileSync(path.join(root, 'screens', name + '.png'), Buffer.from(output.data, 'base64'));
}
const req = require('node:module').createRequire(path.join(project, 'package.json'));
const Metro = req('metro');
const { getDefaultConfig } = req('expo/metro-config');
async function prepareFixture() {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'entry.js'), "import React, { useEffect, useRef, useState } from \u0027react\u0027;\nimport { AppRegistry, Text } from \u0027react-native\u0027;\nimport { SafeAreaProvider } from \u0027react-native-safe-area-context\u0027;\nimport { LessonPlayer } from \u0027@/components/lesson-player\u0027;\nimport { newLessonRecord } from \u0027@/content/learning\u0027;\nimport { sampleLesson } from \u0027@/content/authored\u0027;\nimport { loadSampleProgress, saveSampleProgress } from \u0027@/services/sample-progress\u0027;\n\nfunction Review() {\n  const [record, setRecord] = useState(null);\n  const [saving, setSaving] = useState(false);\n  const [error, setError] = useState(\u0027\u0027);\n  const [exited, setExited] = useState(false);\n  const failed = useRef(null);\n  const busy = useRef(false);\n  const load = () =\u003e loadSampleProgress(\u0027browser-test\u0027).then(progress =\u003e setRecord(progress.lessons[sampleLesson.id] ?? newLessonRecord(sampleLesson.version)));\n  useEffect(() =\u003e { void load(); }, []);\n  window.__reviewRecord = record;\n  const save = async (next) =\u003e {\n    if (busy.current) return false;\n    busy.current = true; setSaving(true);\n    try {\n      if (window.__failSave) throw new Error(\u0027Simulated unavailable storage\u0027);\n      const progress = await saveSampleProgress(\u0027browser-test\u0027, sampleLesson.id, next, record);\n      setRecord(progress.lessons[sampleLesson.id]); failed.current = null; setError(\u0027\u0027); return true;\n    } catch {\n      failed.current = next; setError(\u0027Progress was not saved. Your answer is still here. Please try saving again.\u0027); return false;\n    } finally { busy.current = false; setSaving(false); }\n  };\n  return \u003cSafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}\u003e\n    {exited ? \u003cText\u003eReturned to module\u003c/Text\u003e : record ? \u003cLessonPlayer lesson={sampleLesson} record={record} saved={!!record.maxStage} saving={saving} saveError={error}\n      onSave={save} onRetrySave={() =\u003e save(failed.current)} onReload={() =\u003e void load()} onExit={() =\u003e setExited(true)} /\u003e : \u003cText\u003eLoading fixture\u003c/Text\u003e}\n  \u003c/SafeAreaProvider\u003e;\n}\nAppRegistry.registerComponent(\u0027LessonReview\u0027, () =\u003e Review);\nAppRegistry.runApplication(\u0027LessonReview\u0027, { rootTag: document.getElementById(\u0027root\u0027) });\n");
  fs.writeFileSync(path.join(root, 'index.html'), "\u003c!doctype html\u003e\u003chtml lang=\"en\"\u003e\u003chead\u003e\u003cmeta charset=\"utf-8\"\u003e\u003cmeta name=\"viewport\" content=\"width=device-width,initial-scale=1\"\u003e\u003ctitle\u003eFinlit isolated lesson review\u003c/title\u003e\u003cstyle\u003ehtml,body,#root{height:100%;margin:0}body{font-family:Arial,sans-serif}#root{display:flex}\u003c/style\u003e\u003c/head\u003e\u003cbody\u003e\u003cdiv id=\"root\"\u003e\u003c/div\u003e\u003cscript src=\"/bundle.js\"\u003e\u003c/script\u003e\u003c/body\u003e\u003c/html\u003e");
  const config = getDefaultConfig(project);
  config.watchFolders = [project];

  config.resolver.nodeModulesPaths = [path.join(project, 'node_modules')];
  config.resolver.extraNodeModules = { 'expo-asset': path.dirname(req.resolve('expo-asset/package.json', { paths: [path.dirname(req.resolve('expo/package.json'))] })) };
  config.resolver.resolveRequest = (context, name, platform) => context.resolveRequest({ ...context, preferNativePlatform: platform !== 'web', mainFields: platform === 'web' ? ['browser', 'module', 'main'] : context.mainFields }, name === 'react-native' && platform === 'web' ? 'react-native-web' : name.startsWith('@/') ? path.join(project, name.slice(2)) : name, platform);
  config.maxWorkers = 2;
  await Metro.runBuild(config, { entry: '.expo/lesson-review/entry.js', out: path.join(root, 'bundle.js'), platform: 'web', dev: true, minify: false });
  console.log('Review fixture bundled from the real lesson component and storage service.');

}
(async () => {
  await prepareFixture();
  await new Promise(resolve => server.listen(4390, '127.0.0.1', resolve));
  browser = spawn(process.env.FINLIT_BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--no-sandbox','--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-extensions','--remote-debugging-port=9328','--user-data-dir=' + path.join(root, 'browser-profile-' + Date.now()), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let pages;
  for (let i = 0; i < 100; i++) {
    try { pages = await (await fetch('http://127.0.0.1:9328/json/list')).json(); if (pages.length) break; } catch {}
    await delay(100);
  }
  assert(pages?.length, 'Browser debug port unavailable');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const p = pending.get(data.id); pending.delete(data.id);
      if (data.error) p.reject(new Error(JSON.stringify(data.error))); else p.resolve(data.result);
    }
    if (data.method === 'Runtime.exceptionThrown') exceptions.push(data.params.exceptionDetails);
  });
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:4390/' });
  await until('!!window.__reviewRecord', 'Fixture did not render');
  await evaluate('document.fonts.ready');
  await screenshot('01-situation-390');
  await evaluate('localStorage.clear()');
  await button('○ The costs she needs to cover this month', 'radio');
  await button('Explore the concept');
  await until('window.__reviewRecord.stage===1', 'Concept did not open');
  await button('Explore this term +');
  await until('document.body.innerText.includes("Only funds that can actually be used should support immediate decisions.")', 'Definition did not expand');
  await button('Show worked example');
  await until('window.__reviewRecord.stage===2', 'Example did not open');
  await screenshot('02-worked-example');
  await button('Try the practice');
  assert.equal(await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(e=>e.textContent==="Check answer").getAttribute("aria-disabled")'), 'true');
  await input('200');
  await evaluate('window.__failSave=true');
  await button('Check answer');
  await until('document.body.innerText.includes("Progress was not saved")', 'Save failure was hidden');
  assert.equal(await evaluate('window.__reviewRecord.stage'), 3);
  assert.equal(await evaluate('document.querySelector("input").value'), '200');
  await screenshot('03-save-retry');
  await evaluate('window.__failSave=false');
  await button('Retry saving progress');
  await until('window.__reviewRecord.stage===4', 'Retry did not save and advance');
  await until('document.body.innerText.includes("Your answer leaves more than K120")', 'Wrong-answer feedback missing');
  await button('Try the practice again');
  await input('120');
  await button('Check answer');
  await until('document.body.innerText.includes("You accounted for the new cost")', 'Correct feedback missing');
  await button('Start checkpoint');
  await button('To guarantee that no unexpected costs occur', 'radio');
  assert.equal(await evaluate('window.__reviewRecord.checked[0]'), false);
  await button('Check answer');
  await until('window.__reviewRecord.checked[0]', 'Question was not checked');
  await screenshot('04-checkpoint-feedback');
  await send('Page.reload');
  await until('window.__reviewRecord?.stage===5 && window.__reviewRecord?.checked[0]', 'Submitted checkpoint did not resume after reload');
  assert.equal(await evaluate('window.__reviewRecord.answers[0]'), 0);
  await button('Next question');
  await button('K250', 'radio'); await button('Check answer'); await button('Next question');
  await button('Check for a lower-cost option or decline while keeping needed costs covered', 'radio');
  await button('Check answer'); await button('View lesson summary');
  assert.equal(await evaluate('window.__reviewRecord.completed'), false);
  await evaluate('window.__failSave=true'); await button('Complete lesson');
  await until('document.body.innerText.includes("Progress was not saved")', 'Completion failure missing');
  assert.equal(await evaluate('window.__reviewRecord.completed'), false);
  await evaluate('window.__failSave=false'); await button('Retry saving progress');
  await until('window.__reviewRecord.completed && document.body.innerText.includes("Lesson complete")', 'Completion was not confirmed after successful save');
  await screenshot('05-summary-complete');
  await send('Page.reload');
  await until('window.__reviewRecord?.completed', 'Completion did not survive reload');
  await button('Review this lesson');
  await until('window.__reviewRecord.stage===0', 'Review did not open');
  assert.equal(await evaluate('window.__reviewRecord.completed'), true);
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  await evaluate('document.querySelectorAll("[dir=auto]").forEach(e=>{const c=getComputedStyle(e);e.style.fontSize=(parseFloat(c.fontSize)*1.5)+"px";e.style.lineHeight=(parseFloat(c.lineHeight)*1.5)+"px";})');
  await screenshot('06-narrow-large-text');
  assert(await evaluate('document.documentElement.scrollWidth<=321'), 'Horizontal overflow at narrow width');
  const before = await evaluate('Array.from(document.querySelectorAll("[aria-label]")).find(e=>e.getAttribute("aria-label")==="Save and close lesson").getBoundingClientRect().top');
  await evaluate('document.querySelector("[role=radio]").scrollIntoView({block:"center"})');
  const after = await evaluate('Array.from(document.querySelectorAll("[aria-label]")).find(e=>e.getAttribute("aria-label")==="Save and close lesson").getBoundingClientRect().top');
  assert.equal(after, before, 'Header moved while scrolling content');
  await button('Explore the concept');
  assert.equal(await evaluate('window.__reviewRecord.completed'), true);
  if (fs.existsSync(path.join(root, 'app-export'))) {
    await send('Page.navigate', { url: 'http://127.0.0.1:4390/learn/lesson/sample-budgeting-1?play=1' });
    await until('location.pathname === "/" && document.body.innerText.includes("Build better")', 'Protected sample route did not return an anonymous user to the welcome screen');
    await button('Get started');
    await until('location.pathname === "/login" && document.body.innerText.includes("Welcome back")', 'Login screen did not open');
    await screenshot('07-production-login-guard');
  }
  assert.equal(exceptions.length, 0, 'Browser runtime exceptions: ' + JSON.stringify(exceptions));
  console.log('Browser checks passed: seven stages, reflection, glossary expansion, numeric validation, wrong/correct feedback, failed save and retry, checkpoint explanations, reload/resume, failed completion, confirmed completion, review preservation, 390/320px layouts and large-text scrolling. No runtime exceptions.');
})().catch(error => { console.error(error); console.error('Runtime exceptions', JSON.stringify(exceptions)); process.exitCode = 1; }).finally(async () => {
  try { if (socket?.readyState === 1) await send('Browser.close'); } catch {}
  socket?.close(); browser?.kill(); server.close();
});
