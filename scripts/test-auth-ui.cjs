// Node 22+, Chromium/Edge. Run Expo web on FINLIT_TEST_URL (default localhost:8084).
// Every Supabase request is intercepted. No real email, account update or database call is sent.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { spawn } = require('node:child_process');
const http = require('node:http');
const root = path.resolve(path.dirname(process.argv[1]), '../.expo/auth-review');
const exportRoot = process.env.FINLIT_TEST_EXPORT ? path.resolve(process.env.FINLIT_TEST_EXPORT) : null;
const base = exportRoot ? 'http://127.0.0.1:4392' : process.env.FINLIT_TEST_URL || 'http://localhost:8084';
let server;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fakeEmail = 'learner@example.invalid';
const fakePassword = 'Finlit-Test-123!';
const user = { id: '00000000-0000-4000-8000-000000000001', email: fakeEmail, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Finlit Learner' }, identities: [], created_at: '2026-01-01T00:00:00Z' };
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const jwt = encode({ alg: 'HS256', typ: 'JWT' }) + '.' + encode({ sub: user.id, email: fakeEmail, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+3600, iat: Math.floor(Date.now()/1000) }) + '.' + Buffer.from('fixture-only-signature').toString('base64url');
let initialRequired=false;
let emailMode = 'success', updateMode = 'success', validRecovery = true;
let browser, socket, seq = 0;
const pending = new Map(), exceptions = [], requests = [];
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
async function until(expression, message) {
  for (const deadline=Date.now()+20000;Date.now()<deadline;) { if (await evaluate('!!document.body && (' + expression + ')')) return; await delay(100); }
  throw new Error(message + '\n' + (await evaluate('document.body.innerText')).slice(0,1400));
}
function control(name) {
  return 'Array.from(document.querySelectorAll("[role=button],button")).filter(e=>e.getClientRects().length>0).find(e=>e.getAttribute("aria-label")===' + JSON.stringify(name) + '||e.textContent.trim()===' + JSON.stringify(name) + ')';
}
async function button(name) {
  const find = control(name);
  await until('!!(' + find + ')', 'Missing button: '+name);
  const rect = await evaluate('(()=>{const e='+find+';e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,disabled:e.getAttribute("aria-disabled")};})()');
  assert.notEqual(rect.disabled,'true',name+' is disabled');
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:rect.x,y:rect.y});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:rect.x,y:rect.y});
  await delay(100);
}
function field(label) { return 'Array.from(document.querySelectorAll("input")).filter(e=>e.getClientRects().length>0).find(e=>e.getAttribute("aria-label")==='+JSON.stringify(label)+')'; }
async function input(label,value) {
  await until('!!('+field(label)+')','Missing field '+label);
  await evaluate('('+field(label)+').focus()');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',windowsVirtualKeyCode:65,modifiers:2,commands:['selectAll']});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:2});
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Backspace',code:'Backspace'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Backspace',code:'Backspace'});
  await send('Input.insertText',{text:value}); await delay(80);
}
async function shot(name) {
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Horizontal overflow');
  const body=await evaluate('document.body.innerText');
  assert.doesNotMatch(body,/development sample|sources not yet validated|published module|secure server grading|database schema|Supabase/i);
  const output=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(root,name+'.png'),Buffer.from(output.data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await delay(150);
  assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'Dark theme horizontal overflow');
  const dark=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(root,name+'-dark.png'),Buffer.from(dark.data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'light'}]});await delay(100);
}
async function fulfill(event) {
  const req=event.request, url=new URL(req.url);
  requests.push({path:url.pathname,method:req.method,body:req.postData});
  let status=200, data={};
  if(req.method==='OPTIONS') data={};
  else if(url.pathname==='/auth/v1/recover') {
    if(emailMode==='rate') {status=429;data={code:'over_email_send_rate_limit',msg:'Fixture rate limit'};}
    if(emailMode==='slow') await delay(700);
  } else if(url.pathname==='/auth/v1/user' && req.method==='GET') {
    if(validRecovery) data=user; else {status=401;data={code:'bad_jwt',msg:'Fixture invalid token'};}
  } else if(url.pathname==='/auth/v1/user' && req.method==='PUT') {
    if(updateMode==='weak') {status=422;data={code:'weak_password',msg:'Fixture weak password'};} else data=user;
  } else if(url.pathname==='/auth/v1/signup') {
    data={user,session:null};
  } else if(url.pathname==='/auth/v1/token' && url.searchParams.get('grant_type')==='password') {
    data={access_token:jwt,refresh_token:'fixture-refresh-token',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user};
  } else if(url.pathname==='/rest/v1/rpc/finlit_api') {
    const action=JSON.parse(req.postData||'{}').p_action;
    if(action==='snapshot')data={lessons:{},modules:[],diagnostic:null};
    else if(action==='journey')data={required:initialRequired,legacy:!initialRequired,baseline:null,final:null,finalAvailable:false,priorities:[],comparison:{available:false,comparable:false}};
    else if(action==='assessment'){const form=require('./knowledge-content.cjs').forms[0];data={assessment:{id:'fixture',title:form.title,assessment_type:'diagnostic',content_key:form.key},attempt:null,answers:{},history:[],questions:form.questions.map((q,i)=>({id:'question-'+i,prompt:q.prompt,topic:q.topic,options:q.options.map((text,j)=>({id:'option-'+i+'-'+j,text}))}))};}
    else if(action==='budget')data={plans:[],entries:[],categories:[{id:'10000000-0000-4000-a000-000000000099',name:'Food & groceries',entry_type:'expense'}],insights:false};
    else {status=400;data={code:'fixture_denied',message:'Unexpected learning action in auth test'};}
  } else if(url.pathname.startsWith('/rest/v1/')) data=[];
  else if(url.pathname!=='/auth/v1/logout') {status=400;data={code:'fixture_denied',msg:'Unmocked API call blocked'};}
  await send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:status,responseHeaders:[
    {name:'content-type',value:'application/json'},{name:'access-control-allow-origin',value:'*'},
    {name:'x-supabase-api-version',value:'2024-01-01'},{name:'access-control-expose-headers',value:'x-supabase-api-version'},
    {name:'access-control-allow-headers',value:'*'},{name:'access-control-allow-methods',value:'GET,POST,PUT,DELETE,OPTIONS'},
  ],body:Buffer.from(JSON.stringify(data)).toString('base64')});
}
(async()=>{
  fs.mkdirSync(root,{recursive:true});
  if (exportRoot) {
    assert(fs.existsSync(path.join(exportRoot, 'index.html')), 'Export the web app before running this check');
    server = http.createServer((req, res) => {
      const relative = decodeURIComponent(new URL(req.url, base).pathname).replace(/^\/+/, '');
      const candidates = [relative, relative + '.html', path.join(relative, 'index.html')];
      let file;
      for (const candidate of candidates) {
        const resolved = path.resolve(exportRoot, candidate);
        if (resolved.startsWith(exportRoot + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) { file = resolved; break; }
      }
      if (!file && !path.extname(relative)) file = path.join(exportRoot, 'index.html');
      if (!file) { res.writeHead(404); res.end(); return; }
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      res.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(4392, '127.0.0.1', resolve));
  }
  const health=await fetch(base,{signal:AbortSignal.timeout(20000)}); assert(health.ok,'Start Expo web before running this test');
  browser=spawn(process.env.FINLIT_BROWSER_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
    '--no-sandbox','--headless=new','--disable-gpu','--no-first-run','--disable-background-networking','--disable-extensions','--disable-features=msImplicitSignin',
    '--remote-debugging-port=9329','--user-data-dir='+path.join(root,'profile-'+Date.now()),'about:blank',
  ],{windowsHide:true,stdio:'ignore'});
  let pages;
  for(let i=0;i<100;i++){try{pages=await(await fetch('http://127.0.0.1:9329/json/list')).json();if(pages.length)break;}catch{}await delay(100);}
  assert(pages?.length,'Browser debug port unavailable');
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
  socket.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.id&&pending.has(data.id)){const p=pending.get(data.id);pending.delete(data.id);if(data.error)p.reject(new Error(JSON.stringify(data.error)));else p.resolve(data.result);}
    if(data.method==='Runtime.exceptionThrown')exceptions.push(data.params.exceptionDetails.text);
    if(data.method==='Fetch.requestPaused')void fulfill(data.params).catch(error=>exceptions.push(String(error)));
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*supabase.co/*',requestStage:'Request'}]});
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await send('Page.navigate',{url:base+'/login'});
  await until('document.body.innerText.includes("Welcome back")','Login did not render');
  await input('Email address',fakeEmail);await input('Password',fakePassword);
  assert.equal(await evaluate(field('Password')+'.type'),'password');
  await button('Show password');
  assert.equal(await evaluate(field('Password')+'.type'),'text');
  assert.equal(await evaluate(field('Password')+'.value'),fakePassword);
  await button('Hide password');
  assert.equal(await evaluate(field('Password')+'.type'),'password');
  await shot('01-login');
  await button('New here? Create account'); assert.equal(await evaluate(field('Password')+'.type'),'password');
  await button('Already have an account? Log in'); await button('Forgot password?');
  await until('document.body.innerText.includes("Forgot your password?")','Forgot page did not render');
  assert.equal(await evaluate(field('Email address')+'.value'),fakeEmail);
  await input('Email address','not-an-email');await button('Send reset link');
  await until('document.body.innerText.includes("Enter a valid email address")','Invalid email was accepted');
  assert.equal(requests.filter(r=>r.path==='/auth/v1/recover'&&r.method==='POST').length,0);
  await input('Email address',fakeEmail);emailMode='rate';await button('Send reset link');
  await until('document.body.innerText.includes("Please wait a minute")','Rate limit was hidden');
  emailMode='slow';
  const before=requests.filter(r=>r.path==='/auth/v1/recover'&&r.method==='POST').length;
  await evaluate('(()=>{const e='+control('Send reset link')+';e.click();e.click();})()');
  await until('document.body.innerText.includes("Check your inbox")','Recovery confirmation missing');
  assert.equal(requests.filter(r=>r.path==='/auth/v1/recover'&&r.method==='POST').length,before+1);
  assert(await evaluate('document.body.innerText.includes("If an account uses")'),'Email confirmation reveals account existence');
  await shot('02-forgot-confirmation');
  await send('Page.navigate',{url:base+'/reset-password'});
  await until('document.body.innerText.includes("Request a new link")','Missing link not handled');
  assert.equal(await evaluate('!!('+field('New password')+')'),false);
  await send('Page.navigate',{url:base+'/reset-password#type=recovery&access_token='+encodeURIComponent(jwt)+'&refresh_token=fixture-refresh-token'});
  await until('document.body.innerText.includes("Choose a new password")','Valid recovery did not open the form');
  assert.equal(await evaluate('location.hash'),'');
  assert.equal(await evaluate('location.pathname'),'/reset-password');
  await input('New password','short');await input('Confirm password','short');await button('Save new password');
  await until('document.body.innerText.includes("Use at least 8 characters")','Short password was accepted');
  await input('New password',fakePassword);await input('Confirm password','Different-Test-123!');await button('Save new password');
  await until('document.body.innerText.includes("Your passwords do not match")','Mismatch was accepted');
  await input('Confirm password',fakePassword);
  await button('Show new password');assert.equal(await evaluate(field('New password')+'.type'),'text');
  assert.equal(await evaluate(field('Confirm password')+'.type'),'password');
  await button('Show confirm password');assert.equal(await evaluate(field('Confirm password')+'.value'),fakePassword);
  await button('Hide new password');await button('Hide confirm password');
  await shot('03-new-password');
  updateMode='weak';await button('Save new password');
  await until('document.body.innerText.includes("Choose a stronger password")','Server rejection was hidden');
  assert.equal(await evaluate(field('New password')+'.value'),fakePassword);
  updateMode='success';await button('Save new password');
  await until('document.body.innerText.includes("Password updated")','Successful password update not confirmed');
  await shot('04-password-updated');
  await button('Continue to Finlit');
  await until('location.pathname==="/dashboard"','Recovery did not finish at dashboard');
  await shot('05-dashboard-clean-copy');
  await send('Page.navigate',{url:base+'/reset-password'});
  await until('document.body.innerText.includes("Request a new link")','Ordinary session incorrectly treated as recovery');
  assert.equal(await evaluate('!!('+field('New password')+')'),false);
  await evaluate('localStorage.clear()');validRecovery=false;
  // Start a fresh document: clearing storage does not clear the SDK's in-memory session.
  await send('Page.navigate',{url:'about:blank'});
  await until('location.href==="about:blank"','Could not close the prior signed-in document');
  await send('Page.navigate',{url:base+'/reset-password#type=recovery&access_token='+encodeURIComponent(jwt)+'&refresh_token=expired-fixture'});
  await until('document.body.innerText.includes("expired or is no longer valid")','Expired link was not explained');
  assert.equal(await evaluate('!!('+field('New password')+')'),false);
  await button('Request a new link');
  await until('document.body.innerText.includes("Forgot your password?")','New-link request is blocked');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  await shot('06-forgot-narrow');
  validRecovery=true;await button('Back to log in');
  await until('!!('+field('Email address')+')','Back to login failed');
  await input('Email address',fakeEmail);await input('Password',fakePassword);await button('Log in');
  await until('location.pathname==="/dashboard"','Normal sign-in no longer works');
  // Exercise the shared navigation and the retired deep links with the real exported app.
  const navigation = ['Home','Learn','Budget','Profile'];
  async function checkNavigation() {
    await until('!!('+control('Home')+')','Navigation did not render');
    const labels = await evaluate('Array.from(document.querySelectorAll("[role=button][aria-label]")).filter(e=>e.getClientRects().length>0).map(e=>e.getAttribute("aria-label"))');
    assert.deepEqual(labels.filter(label=>navigation.includes(label)),navigation);
    assert(!labels.includes('Loan'),'Retired Loan tab is still visible');
    assert(!await evaluate('Array.from(document.querySelectorAll("a")).some(e=>e.getClientRects().length>0&&/loan-calculator|loan\\/result/.test(e.getAttribute("href")||""))'),'Calculator shortcut remains');
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await until('document.body.innerText.includes("0% complete")','Home progress did not load');
  assert(await evaluate('document.body.innerText.includes("master today?")'),'Home mockup heading missing');
  assert(!await evaluate('document.body.innerText.includes("Build your financial confidence")'),'Home still duplicates Learn');
  await shot('home-dashboard-390');
  await until('document.body.innerText.includes("This month’s spending")','Home budget chart missing');
  await evaluate(`Array.from(document.querySelectorAll('[role=heading]')).find(e=>e.textContent==='This month’s spending').scrollIntoView({block:'start'})`);await shot('home-budget-chart');
  await evaluate('document.querySelectorAll("div").forEach(e=>{if(e.scrollTop)e.scrollTop=0})');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'),'Home overflows at 320px');
  await shot('home-dashboard-320');
  await button('View all modules');
  await until('location.pathname==="/learn" && document.body.innerText.includes("Build your financial confidence")','View all did not open Learn');
  await button('Home');
  await until('document.body.innerText.includes("0% complete")','Home did not reload');
  await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(e=>e.getAttribute("aria-label")?.startsWith("Start lesson:")).click()');
  await until('location.pathname.startsWith("/learn/lesson/")','Featured lesson link failed');
  await send('Page.navigate',{url:base+'/dashboard'});
  await until('document.body.innerText.includes("0% complete")','Home did not reload after lesson');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await checkNavigation();await shot('07-four-item-navigation');
  await button('Budget');await until('location.pathname==="/budget"','Budget navigation failed');
  await until('document.body.innerText.includes("No budget yet")','Genuine budget empty state missing');
  assert(!await evaluate('document.body.innerText.includes("K780")'),'Fictional personal budget returned');
  await button('Create a budget');await until('location.pathname==="/budget/create"','Budget creation navigation failed');
  await input('Planned income (K)','725');
  assert.equal(await evaluate(field('Planned income (K)')+'.value'),'725','Budget form input regressed');
  await send('Page.navigate',{url:base+'/dashboard'});
  await until('!!('+control('Learn')+')','Dashboard navigation missing');
  await button('Learn');await until('location.pathname==="/learn"','Learning navigation failed');
  await until('document.body.innerText.includes("Borrowing and Debt")','Borrowing module missing');
  await evaluate('Array.from(document.querySelectorAll("[role=button]")).find(e=>e.getClientRects().length>0&&e.getAttribute("aria-label")==="Borrowing and Debt Management. Locked").click()');
  await until('location.pathname==="/learn/module/module-4"','Borrowing module link failed');
  await until('document.body.innerText.includes("Understanding borrowing")','Borrowing lessons did not finish loading');
  const borrowing = await evaluate('document.body.innerText');
  for(const title of ['Understanding borrowing','Interest, Fees and Repayment','Borrowing Affordability','Managing debt responsibly'])assert(borrowing.includes(title),'Missing borrowing lesson: '+title);
  for(const route of ['/loan-calculator','/loan/result']) {
    await send('Page.navigate',{url:base+route});
    await until('location.pathname==="/learn"','Retired route did not redirect: '+route);
    await until('!!('+control('Budget')+')','Learning navigation missing after redirect');
    await checkNavigation();
    assert(!await evaluate('document.body.innerText.includes("Explore an example loan")'),'Calculator rendered through old link');
  }
  await button('Home');await until('location.pathname==="/dashboard"','Home navigation failed');
  await button('Profile');await until('location.pathname==="/profile"','Profile navigation failed');
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});
  await checkNavigation();await shot('08-four-item-navigation-narrow');
  // A confirmed first-time account must reach the assessment, while Budget stays independent.
  await button('Log out');await until('!!('+control('Get started')+')','Logout failed');await button('Get started');
  await button('New here? Create account');await input('Full name','Finlit Learner');await input('Email address',fakeEmail);await input('Password',fakePassword);await button('Create account');
  await until('document.body.innerText.includes("Check your email")','Registration confirmation missing');
  initialRequired=true;await input('Password',fakePassword);await button('Log in');
  await until('location.pathname==="/diagnostic" && document.body.innerText.includes("18 questions")','First-time login did not reach diagnostic');await shot('09-first-time-assessment');
  await button('Open Budget Tracker');await until('location.pathname==="/budget" && document.body.innerText.includes("No budget yet")','First-time budget blocked');
  await send('Page.navigate',{url:base+'/learn/lesson/lesson-1-1'});await until('location.pathname==="/diagnostic"','Direct lesson URL bypassed initial assessment');
  assert.equal(exceptions.length,0,'Browser runtime exception: '+JSON.stringify(exceptions));
  console.log('Auth UI checks passed: login/signup visibility, forgot email validation/prefill, rate limits, duplicate request guard, neutral success, recovery URL cleanup, reset validation/visibility/errors/success, direct-route protection, expired-link retry, normal sign-in, 390/320px layouts and learner copy. Four-item navigation, dashboard/learning/budget/profile, genuine budget empty state and creation form, Module 4 titles and retired deep-link redirects also passed. All Supabase requests mocked; no live emails or updates.');
})().catch(error=>{console.error(error);console.error('Runtime exceptions:',exceptions);process.exitCode=1;}).finally(async()=>{
  try{if(socket?.readyState===1)await send('Browser.close');}catch{}
  socket?.close();browser?.kill();if(server?.listening)server.close();
});
