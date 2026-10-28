# Learner interface and password recovery — 21 October 2026

This increment removes implementation commentary from learner screens and adds email password recovery plus visible/hidden password controls. Existing staged changes are preserved. No schema, policy, Auth configuration or live account was changed.

The standalone loan calculator was subsequently retired; see [loan calculator removal](./loan-calculator-removal.md).

## Learner interface

Learning screens now use Start lesson, Continue lesson, Review lesson, Complete lesson and Lesson complete. Developer sample/source-review/publication/backend explanations stay in documentation. Fictional examples and Saved on this device remain because they explain the activity and actual persistence.

Unavailable lessons/challenges show Coming soon. No additional teaching content, cloud progress or client-side module passing results were fabricated. Starter tutorials redirect into Finlit. Legacy quiz routes lead to the actual lesson instead of claiming a fabricated module pass. Progress uses saved completions. Budget screens retain their visual patterns as educational examples; unavailable personal saving actions show Coming soon. Errors no longer expose service/database internals.

## Password interface

PasswordField preserves the existing rounded inputs and colours, masks values by default and includes labelled eye buttons. Toggling preserves the value. Sign-in, account creation, new password and confirmation use the control; the two reset fields have independent visibility.

Forgot password? carries the entered email to the request screen. It validates email, prevents duplicate submission, uses a neutral account-existence message, throttles resends locally and provides retryable errors.

Reset requires a verified recovery session, at least eight characters and matching confirmation. Values survive a server rejection. Ordinary signed-in sessions alone cannot open the reset form. Missing/expired links offer another link request.

## Auth integration

The existing Supabase client and implicit flow remain, including detectSessionInUrl:false. Recovery explicitly uses resetPasswordForEmail, setSession for recovery fragments, verifyOtp for recovery token hashes and updateUser. Code callbacks require an SDK-confirmed recovery redirect type.

Launch and warm-app links are handled. Web hashchange/popstate listeners also handle recovery fragments added to an already-open reset page; the installed Expo web Linking implementation listens only for message events. Scheme, host, path and recovery type are validated; conflicting/duplicate parameters are rejected. Duplicate events reuse an exchange. Different exchanges and password updates are serialized so an older operation cannot overwrite a newer session. Cancellation invalidates queued work. Auth callbacks remain synchronous; a raw PASSWORD_RECOVERY event does not itself grant form access.

Web recovery credentials are removed from the address bar after processing. Recovery readiness is intentionally in memory: reloading a cleaned reset page requires reopening/requesting a recovery link instead of treating an ordinary saved session as reset permission.

No privileged client key was added. Tests use fake accounts/tokens and intercepted responses, not real emails or account changes.

## External Auth settings to verify

Read-only inspection confirmed FinLit project hqycgmajxoxykcerttuw. Available connector tools do not expose its Auth redirect allowlist, email template or SMTP settings.

The callback is Linking.createURL('reset-password'). Verify exact URLs in Supabase Authentication → URL Configuration → Redirect URLs:
- Installed app: finlitmobile://reset-password
- Current local web server: http://localhost:8084/reset-password
- Other web environments: their exact origin plus /reset-password
- Expo Go: that session's generated exp://host:port/--/reset-password. An installed development build provides a stable callback.

Avoid broad production wildcards. Verify the Site URL, standard recovery email template and email delivery with an account/mailbox you control. No live Auth configuration was edited and no real recovery email was sent during development.

## Verification

Run:
- node node_modules/typescript/bin/tsc --noEmit
- node node_modules/eslint/bin/eslint.js . --max-warnings 0
- node scripts/test-auth.cjs
- node scripts/test-learning.cjs
- node scripts/test-debug.cjs
- node scripts/test-lesson-ui.cjs

For auth browser checks, set FINLIT_TEST_EXPORT=.expo/prototype-review/export and run node scripts/test-auth-ui.cjs after exporting the app. Alternatively, start Expo web on port8084 and run the script against it. FINLIT_TEST_URL selects another local origin; FINLIT_BROWSER_PATH selects another Chromium executable. Node22+ is required. All Supabase requests are intercepted before navigation. Screenshots/private browser data stay under .expo/auth-review.

The auth regression suite covers email validation/neutral responses, strict callback parsing, token/hash/code exchanges, dedupe/retry, overlapping links, cancellation, ordinary-session restoration, provider launch/warm-link races, route guards and update failures.

A live mailbox round trip plus Android/iOS link opening, keyboard and accessibility checks remain device acceptance tasks.

## Executed results

- TypeScript and full ESLint passed after the callback fix.
- Auth recovery, learning and debug regression suites passed.
- The real lesson player browser walkthrough passed all seven stages, wrong/correct answers, save failure/retry, reload/resume, completion/review, narrow layouts and large-text scrolling.
- Auth browser checks passed login/account-creation visibility, prefilled and invalid email, rate-limit feedback, duplicate submission protection, neutral confirmation, recovery URL cleanup, independent reset-field toggles, weak/mismatched passwords, server rejection and successful update, ordinary-session protection, expired-link retry, normal login and 390/320px layouts. All Supabase responses were intercepted fixtures. Screenshots were visually checked.
- Android, iOS and web production export completed successfully. The web export was rebuilt successfully after adding the browser navigation listeners. Native bundles were built before that web-only adjustment.
- Git whitespace validation passed. Existing staged work was preserved; nothing was committed or deployed.

No live database schema, RLS policy, Auth configuration or account was changed. Real email delivery, redirect allowlisting and Android/iOS device acceptance remain unverified.
