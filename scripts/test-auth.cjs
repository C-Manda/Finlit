// Isolated recovery regressions. All accounts, tokens and SDK responses are fake; no emails or network calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module, exports: module.exports, require: name => {
      if (name in imports) return imports[name];
      throw new Error('Unexpected import: ' + name);
    }, URL, URLSearchParams, Promise, Error, console,
  }, { filename: file });
  return module.exports;
}
const recovery = load('lib/password-recovery.ts');
const REDIRECT = 'https://finlit.example/reset-password';
const TOKENS = REDIRECT + '#type=recovery&access_token=fake-access&refresh_token=fake-refresh';
const HASH = REDIRECT + '?type=recovery&token_hash=fake-hash';
const CODE = REDIRECT + '?code=fake-code';
const session = { access_token: 'fake-access', refresh_token: 'fake-refresh', user: { id: 'fake-learner' } };
const previousSession = { access_token: 'prior-access', refresh_token: 'prior-refresh', user: { id: 'prior-learner' } };
const plain = value => JSON.parse(JSON.stringify(value));
const sdkError = code => Object.assign(new Error('Simulated SDK error'), { code });
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}) {
  const calls = [];
  const defaults = {
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    setSession: async () => ({ data: { session }, error: null }),
    verifyOtp: async () => ({ data: { session }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session, redirectType: 'recovery' }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: session.user }, error: null }),
  };
  const auth = Object.fromEntries(Object.entries(defaults).map(([name, handler]) => [name, async (...args) => {
    calls.push({ method: name, args: plain(args) });
    return (overrides[name] || handler)(...args);
  }]));
  const service = load('services/password-recovery.ts', {
    '@/lib/password-recovery': recovery,
    '@/lib/supabase': { supabase: { auth } },
    'expo-linking': { createURL: route => { assert.equal(route, 'reset-password'); return REDIRECT; } },
  });
  return { service, calls, count: method => calls.filter(call => call.method === method).length };
}

function parserChecks() {
  const parse = raw => recovery.parseRecoveryLink(raw, REDIRECT);
  assert.deepEqual(plain(parse(TOKENS)), { kind: 'tokens', accessToken: 'fake-access', refreshToken: 'fake-refresh' });
  assert.deepEqual(plain(parse(HASH)), { kind: 'token-hash', tokenHash: 'fake-hash' });
  assert.deepEqual(plain(parse(CODE)), { kind: 'code', code: 'fake-code' });
  assert.equal(parse(REDIRECT + '/?type=recovery&token_hash=fake-hash').kind, 'token-hash');
  assert.equal(parse(REDIRECT + '?type=recovery&code=fake-code').kind, 'code');
  assert.equal(parse(REDIRECT), null, 'A plain reset route is not a recovery grant');
  assert.equal(parse(REDIRECT + '?utm_source=test'), null);
  for (const raw of [
    'not a URL', 'javascript:alert(1)',
    'http://finlit.example/reset-password?type=recovery&token_hash=fake-hash',
    'https://other.example/reset-password?type=recovery&token_hash=fake-hash',
    'https://finlit.example:444/reset-password?type=recovery&token_hash=fake-hash',
    'https://finlit.example/dashboard?type=recovery&token_hash=fake-hash',
    'https://finlit.example/reset-password/extra?type=recovery&token_hash=fake-hash',
    'https://attacker@finlit.example/reset-password?type=recovery&token_hash=fake-hash',
  ]) assert.equal(parse(raw), null, 'Reject mismatched callback: ' + raw);
  for (const suffix of [
    '?type=signup&token_hash=fake-hash', '?code=fake-code&type=invite',
    '#access_token=fake-access&refresh_token=fake-refresh',
    '?type=recovery', '?type=recovery&token_hash=', '?type=recovery&access_token=fake-access',
    '?type=recovery&refresh_token=fake-refresh',
    '?type=recovery&token_hash=fake-hash&code=fake-code',
    '?type=recovery&token_hash=fake-hash&access_token=fake-access&refresh_token=fake-refresh',
    '?type=recovery&type=recovery&token_hash=fake-hash',
    '#type=recovery&refresh_token=a&refresh_token=b&access_token=fake-access',
    '?type=signup#type=recovery&token_hash=fake-hash',
    '?type=recovery&token_hash=a#token_hash=b',
    '?type=recovery&token_hash=fake-hash&error=access_denied',
    '#type=recovery&error_code=otp_expired', '#error_description=Expired',
  ]) assert.equal(parse(REDIRECT + suffix).kind, 'invalid', 'Reject ambiguous or invalid recovery parameters: ' + suffix);
  for (const callback of ['finlitmobile://reset-password', 'exp://127.0.0.1:8081/--/reset-password']) {
    assert.equal(recovery.parseRecoveryLink(callback + '?type=recovery&token_hash=fake-hash', callback).kind, 'token-hash');
    assert.equal(recovery.parseRecoveryLink(callback.replace('reset-password', 'dashboard') + '?code=fake-code', callback), null);
  }
}

function validationAndRoutingChecks() {
  assert(recovery.validEmail('  learner@example.com  '));
  for (const email of ['', ' ', 'learner', 'learner@', '@example.com', 'learner@example', 'a b@example.com', 'a@b..example\ncom', 'a'.repeat(250) + '@example.com']) {
    assert.equal(recovery.validEmail(email), false, 'Reject invalid email');
  }
  assert.equal(recovery.validateNewPassword('Stronger-9!', 'Stronger-9!'), null);
  for (const password of ['', 'short', '        ']) assert.match(recovery.validateNewPassword(password, password), /at least 8 characters/);
  assert.match(recovery.validateNewPassword('Stronger-9!', 'Different-9!'), /do not match/);
  assert.equal(recovery.authDestination('login', true, 'idle'), '/dashboard');
  assert.equal(recovery.authDestination('index', true, 'idle'), '/dashboard');
  assert.equal(recovery.authDestination('dashboard', true, 'idle'), null, 'An ordinary signed-in session does not start recovery');
  assert.equal(recovery.authDestination('dashboard', false, 'idle'), '/');
  assert.equal(recovery.authDestination('login', false, 'idle'), null);
  assert.equal(recovery.authDestination('forgot-password', false, 'idle'), null);
  assert.equal(recovery.authDestination('reset-password', false, 'idle'), null, 'The reset screen decides eligibility from recovery status');
  for (const status of ['checking', 'ready', 'complete', 'error']) {
    assert.equal(recovery.authDestination('dashboard', true, status), '/reset-password');
    assert.equal(recovery.authDestination('login', false, status), '/reset-password');
    assert.equal(recovery.authDestination('reset-password', true, status), null);
  }
}

async function requestChecks() {
  const success = fixture();
  await success.service.requestPasswordReset('  learner@example.com  ');
  assert.deepEqual(success.calls, [{ method: 'resetPasswordForEmail', args: ['learner@example.com', { redirectTo: REDIRECT }] }]);
  await assert.rejects(success.service.requestPasswordReset('not-an-email'), /valid email/);
  assert.equal(success.count('resetPasswordForEmail'), 1, 'Invalid input never reaches the SDK');
  const missing = fixture({ resetPasswordForEmail: async () => ({ error: sdkError('user_not_found') }) });
  await assert.doesNotReject(missing.service.requestPasswordReset('missing@example.com'), 'A missing account has the same neutral outcome');
  for (const code of ['over_email_send_rate_limit', 'over_request_rate_limit']) {
    const limited = fixture({ resetPasswordForEmail: async () => ({ error: sdkError(code) }) });
    await assert.rejects(limited.service.requestPasswordReset('learner@example.com'), /wait a minute/);
  }
  const offline = fixture({ resetPasswordForEmail: async () => { throw new Error('Failed to fetch'); } });
  await assert.rejects(offline.service.requestPasswordReset('learner@example.com'), /Check your connection/);
  const other = fixture({ resetPasswordForEmail: async () => ({ error: sdkError('unexpected') }) });
  await assert.rejects(other.service.requestPasswordReset('learner@example.com'), /could not send the reset link/);
}

async function linkExchangeChecks() {
  const tokens = fixture();
  assert.equal(await tokens.service.establishRecoverySession(TOKENS), session);
  assert.deepEqual(tokens.calls, [{ method: 'setSession', args: [{ access_token: 'fake-access', refresh_token: 'fake-refresh' }] }]);
  await tokens.service.establishRecoverySession(TOKENS);
  assert.equal(tokens.count('setSession'), 1, 'Already handled links are not exchanged again');
  tokens.service.clearRecoverySessionCache();
  await tokens.service.establishRecoverySession(TOKENS);
  assert.equal(tokens.count('setSession'), 2);

  const hash = fixture();
  assert.equal(await hash.service.establishRecoverySession(HASH), session);
  assert.deepEqual(hash.calls, [{ method: 'verifyOtp', args: [{ token_hash: 'fake-hash', type: 'recovery' }] }]);
  const code = fixture();
  assert.equal(await code.service.establishRecoverySession(CODE), session);
  assert.deepEqual(code.calls.map(call => call.method), ['getSession', 'exchangeCodeForSession']);
  assert.deepEqual(code.calls[1].args, ['fake-code']);

  let finish;
  const duplicate = fixture({ verifyOtp: () => new Promise(resolve => { finish = resolve; }) });
  const first = duplicate.service.establishRecoverySession(HASH);
  const second = duplicate.service.establishRecoverySession(HASH);
  assert.equal(first, second, 'Concurrent duplicate callback events share one exchange');
  await flush();
  assert.equal(duplicate.count('verifyOtp'), 1);
  finish({ data: { session }, error: null });
  await Promise.all([first, second]);

  let attempts = 0;
  const retry = fixture({ verifyOtp: async () => ++attempts === 1
    ? { data: { session: null }, error: sdkError('otp_expired') }
    : { data: { session }, error: null } });
  await assert.rejects(retry.service.establishRecoverySession(HASH), /expired or is no longer valid/);
  assert.equal(await retry.service.establishRecoverySession(HASH), session, 'A failed exchange does not poison later retry');
  assert.equal(attempts, 2);

  for (const [link, method] of [[TOKENS, 'setSession'], [HASH, 'verifyOtp'], [CODE, 'exchangeCodeForSession']]) {
    const empty = fixture({ [method]: async () => ({ data: { session: null }, error: null }) });
    await assert.rejects(empty.service.establishRecoverySession(link), /expired or is no longer valid/);
  }
  const invalid = fixture();
  await assert.rejects(invalid.service.establishRecoverySession(REDIRECT + '?type=signup&token_hash=fake-hash'), /expired or is no longer valid/);
  await assert.rejects(invalid.service.establishRecoverySession('https://other.example/reset-password?code=fake-code'), /expired or is no longer valid/);
  assert.equal(invalid.calls.length, 0, 'Invalid callbacks cannot alter a session');
  const network = fixture({ verifyOtp: async () => { throw new Error('Network request failed'); } });
  await assert.rejects(network.service.establishRecoverySession(HASH), /Check your connection/);
}

async function serializedRecoveryChecks() {
  const exchange = deferred();
  const ordered = fixture({
    getSession: async () => ({ data: { session: previousSession }, error: null }),
    exchangeCodeForSession: () => exchange.promise,
    setSession: async credentials => ({ data: { session: credentials.access_token === previousSession.access_token ? previousSession : session }, error: null }),
  });
  assert.equal(ordered.service.recoveryWorkInProgress(), false);
  const oldLink = ordered.service.establishRecoverySession(CODE);
  const rejectedOld = assert.rejects(oldLink, /expired or is no longer valid/);
  await flush();
  assert.equal(ordered.count('exchangeCodeForSession'), 1);
  const newLink = ordered.service.establishRecoverySession(TOKENS);
  await flush();
  assert(ordered.service.recoveryWorkInProgress());
  assert.equal(ordered.count('setSession'), 0, 'The newer link waits while the older SDK exchange owns the session');
  exchange.resolve({ data: { session, redirectType: 'signup' }, error: null });
  await rejectedOld;
  assert.equal(await newLink, session);
  assert.deepEqual(ordered.calls.map(call => call.method), ['getSession', 'exchangeCodeForSession', 'setSession', 'setSession']);
  assert.equal(ordered.calls[2].args[0].access_token, 'prior-access', 'Restore the previous session before applying the newer recovery tokens');
  assert.equal(ordered.calls[3].args[0].access_token, 'fake-access');
  assert.equal(ordered.service.recoveryWorkInProgress(), false);

  const verification = deferred();
  const cancelled = fixture({ verifyOtp: () => verification.promise });
  const activeLink = cancelled.service.establishRecoverySession(HASH);
  const rejectedActive = assert.rejects(activeLink, /expired or is no longer valid/);
  await flush();
  const queuedLink = cancelled.service.establishRecoverySession(TOKENS);
  const rejectedQueued = assert.rejects(queuedLink, /expired or is no longer valid/);
  cancelled.service.clearRecoverySessionCache();
  assert(cancelled.service.recoveryWorkInProgress(), 'Cancellation still tracks the outstanding SDK exchange');
  verification.resolve({ data: { session }, error: null });
  await Promise.all([rejectedActive, rejectedQueued]);
  assert.deepEqual(cancelled.calls.map(call => call.method), ['verifyOtp', 'signOut']);
  assert.deepEqual(cancelled.calls[1].args, [{ scope: 'local' }], 'A late session from cancelled work is signed out locally');
  assert.equal(cancelled.count('setSession'), 0, 'Queued links invalidated before their turn never call the SDK');
  assert.equal(cancelled.service.recoveryWorkInProgress(), false);
  assert.equal(await cancelled.service.establishRecoverySession(TOKENS), session, 'Fresh recovery can start after cancellation');
}

async function ordinaryCodeChecks() {
  const existing = fixture({
    getSession: async () => ({ data: { session: previousSession }, error: null }),
    exchangeCodeForSession: async () => ({ data: { session, redirectType: 'signup' }, error: null }),
  });
  await assert.rejects(existing.service.establishRecoverySession(CODE), /expired or is no longer valid/);
  assert.deepEqual(existing.calls.map(call => call.method), ['getSession', 'exchangeCodeForSession', 'setSession']);
  assert.deepEqual(existing.calls[2].args, [previousSession], 'A normal sign-in code restores the previously signed-in account');
  const anonymous = fixture({ exchangeCodeForSession: async () => ({ data: { session, redirectType: 'magiclink' }, error: null }) });
  await assert.rejects(anonymous.service.establishRecoverySession(CODE), /expired or is no longer valid/);
  assert.deepEqual(anonymous.calls.map(call => call.method), ['getSession', 'exchangeCodeForSession', 'signOut']);
  assert.deepEqual(anonymous.calls[2].args, [{ scope: 'local' }]);
  assert.equal(anonymous.count('updateUser'), 0, 'An ordinary sign-in callback never changes a password');
}

async function passwordChecks() {
  const success = fixture();
  await success.service.updateRecoveredPassword('Stronger-9!');
  assert.deepEqual(success.calls, [{ method: 'updateUser', args: [{ password: 'Stronger-9!' }] }]);
  await assert.rejects(success.service.updateRecoveredPassword('short'), /at least 8 characters/);
  assert.equal(success.count('updateUser'), 1, 'Invalid passwords are rejected before an SDK call');
  for (const [code, message] of [
    ['same_password', /not used for this account/], ['weak_password', /stronger password/], ['unexpected', /could not update your password/],
  ]) {
    const failed = fixture({ updateUser: async () => ({ error: sdkError(code) }) });
    await assert.rejects(failed.service.updateRecoveredPassword('Stronger-9!'), message);
  }
  const offline = fixture({ updateUser: async () => { throw new Error('offline'); } });
  await assert.rejects(offline.service.updateRecoveredPassword('Stronger-9!'), /Check your connection/);
}

// Minimal provider lifecycle harness. Deferred I/O verifies ownership of recovery state;
// it does not replace the browser checks for the rendered password forms.
function providerFixture(options = {}) {
  const slots = [];
  let index = 0, dirty = false, effects = [], value, authListener, linkListener, work = 0;
  const calls = { clear: 0, exchange: [], update: [], signOut: 0, removed: 0, unsubscribed: 0 };
  const changed = (before, after) => !before || before.length !== after.length || before.some((item, i) => item !== after[i]);
  const react = {
    createContext: () => ({ Provider: 'AuthProvider' }),
    useContext: context => context.value,
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: initial };
      return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; dirty = true; }];
    },
    useRef(initial) { const i = index++; if (!slots[i]) slots[i] = { current: initial }; return slots[i]; },
    useCallback(callback, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: callback, deps };
      return slots[i].value;
    },
    useEffect(effect, deps) {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const before = slots[i]; slots[i] = { deps };
        effects.push(() => { before?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  const service = {
    passwordResetRedirect: () => REDIRECT,
    clearRecoverySessionCache: () => { calls.clear++; },
    recoveryWorkInProgress: () => work > 0,
    requestPasswordReset: async () => undefined,
    establishRecoverySession: url => {
      calls.exchange.push(url); work++;
      return Promise.resolve(options.exchange ? options.exchange(url) : session).finally(() => { work--; });
    },
    updateRecoveredPassword: password => { calls.update.push(password); return options.update ? options.update(password) : Promise.resolve(); },
  };
  const { AuthProvider } = load('contexts/auth-context.tsx', {
    react,
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    'react-native': { Platform: { OS: 'android' } },
    'expo-linking': {
      getInitialURL: () => Promise.resolve(options.initialURL ?? null),
      addEventListener: (event, listener) => { assert.equal(event, 'url'); linkListener = listener; return { remove: () => { calls.removed++; } }; },
    },
    '@/lib/password-recovery': recovery,
    '@/services/password-recovery': service,
    '@/services/auth': {
      getSession: () => options.initialSession ?? Promise.resolve({ data: { session: null } }),
      onAuthStateChange: listener => { authListener = listener; return { data: { subscription: { unsubscribe: () => { calls.unsubscribed++; } } } }; },
      signIn: async () => ({ data: { session }, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => { calls.signOut++; authListener('SIGNED_OUT', null); return { error: null }; },
    },
  });
  const render = () => {
    index = 0; dirty = false;
    value = AuthProvider({ children: null }).props.value;
    const queued = effects; effects = []; queued.forEach(effect => effect());
    return value;
  };
  render();
  return {
    calls, get: () => value,
    emitAuth: (event, nextSession) => authListener(event, nextSession),
    open: url => linkListener({ url }),
    async settle() { for (let i = 0; i < 30; i++) { await Promise.resolve(); if (dirty) render(); } return value; },
    unmount() { slots.forEach(slot => slot.cleanup?.()); },
  };
}

async function providerChecks() {
  const initial = deferred();
  const ordinary = providerFixture({ initialSession: initial.promise });
  ordinary.emitAuth('SIGNED_IN', session);
  ordinary.emitAuth('PASSWORD_RECOVERY', session);
  await ordinary.settle();
  assert.equal(ordinary.get().recoveryStatus, 'idle', 'A raw SDK event does not grant recovery-form access');
  await assert.rejects(ordinary.get().updatePassword('Stronger-9!'), /expired or is no longer valid/);
  assert.equal(ordinary.calls.update.length, 0);
  initial.resolve({ data: { session: previousSession } });
  await ordinary.settle();
  assert.equal(ordinary.get().session, session, 'Stale startup restoration cannot overwrite a newer auth event');
  ordinary.unmount();
  assert.equal(ordinary.calls.removed, 1); assert.equal(ordinary.calls.unsubscribed, 1);

  const initialLink = deferred(), warmLink = deferred();
  const latest = providerFixture({ initialURL: HASH, exchange: url => url === HASH ? initialLink.promise : warmLink.promise });
  await latest.settle();
  assert.equal(latest.get().recoveryStatus, 'checking');
  latest.open(TOKENS); await latest.settle();
  initialLink.resolve(previousSession); await latest.settle();
  assert.equal(latest.get().recoveryStatus, 'checking', 'An older initial link cannot make the newer warm link ready');
  warmLink.resolve(session); await latest.settle();
  assert.equal(latest.get().recoveryStatus, 'ready'); assert.equal(latest.get().session, session);
  await latest.get().updatePassword('Stronger-9!'); await latest.settle();
  assert.equal(latest.get().recoveryStatus, 'complete'); assert.deepEqual(latest.calls.update, ['Stronger-9!']);
  latest.emitAuth('SIGNED_OUT', null); await latest.settle();
  assert.equal(latest.get().recoveryStatus, 'idle'); assert.equal(latest.get().session, null);
  latest.unmount();

  const pendingLink = deferred();
  const cancelled = providerFixture({ exchange: () => pendingLink.promise });
  await cancelled.settle(); cancelled.open(HASH); await cancelled.settle();
  await cancelled.get().signOut(); await cancelled.settle();
  assert.equal(cancelled.get().recoveryStatus, 'idle'); assert.equal(cancelled.calls.signOut, 1);
  pendingLink.resolve(session); await cancelled.settle();
  assert.equal(cancelled.get().recoveryStatus, 'idle', 'Signing out cancels the pending provider result');
  assert.equal(cancelled.get().session, null);
  cancelled.unmount();

  const updating = deferred();
  const passwordRace = providerFixture({ initialURL: HASH, update: () => updating.promise });
  await passwordRace.settle();
  const passwordUpdate = passwordRace.get().updatePassword('Stronger-9!');
  await passwordRace.get().signOut(); await passwordRace.settle();
  updating.resolve(); await passwordUpdate; await passwordRace.settle();
  assert.equal(passwordRace.get().recoveryStatus, 'idle', 'A late password-update result cannot reopen recovery after sign-out');
  passwordRace.unmount();
}

(async () => {
  parserChecks(); validationAndRoutingChecks();
  await requestChecks(); await linkExchangeChecks(); await ordinaryCodeChecks(); await serializedRecoveryChecks(); await passwordChecks(); await providerChecks();
  console.log('Auth recovery checks passed: validation, neutral missing-account response, strict callback parsing, token/hash/PKCE exchange, dedupe/retry, serialized overlapping links, cancellation and queued-link invalidation, ordinary-session restoration, provider initial/warm-link races, sign-out cancellation, routing and password update errors. No live calls or emails.');
})().catch(error => { console.error(error); process.exitCode = 1; });
