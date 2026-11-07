# Mobile Money SMS integration

SMS is a reviewed input to the existing Money Locations ledger. Opening balances remain separate from income. Budget calculations, transfers, fee accounting and correction history use the existing financial API. The existing screens retain their design; Budget gains a “Mobile Money SMS tracking” link and a review screen built from shared components.

## Implementation

- `modules/finlit-sms/`: local Android Expo module, package/autolinking metadata, manifest and Kotlin reader, receiver and SQLite queue.
- `features/sms/parsers/{mtn,airtel,zamtel,shared,registry}.ts`: deterministic parsers for the eight supplied observed templates, with Airtel text variants. Unknown formats need review; unsupported formats never become invented transactions. Money is parsed in integer ngwee. An unstated fee remains unknown; `.00` is explicit zero. Provider timestamps use Zambia time; absent timestamps explicitly use SMS receipt time.
- `features/sms/{types,native.types,native,native.android,fingerprint,review,import-service}.ts`: native-safe adapters, data contracts, matching, balance comparison and approved-import retry.
- `components/sms-screen.tsx`, `components/sms-lifecycle.tsx`, `app/budget/sms.tsx`: opt-in setup, scan, review, history, account/foreground lifecycle. Web/iOS can review pasted messages online; automatic reading requires the Android custom build, not Expo Go.
- `app/_layout.tsx`, `components/budget-screens.tsx`, `content/budget-rules.ts`, `services/learning.ts`: lifecycle, navigation, optional precise transaction time and API error handling.
- `app.json`, `package.json`, `eas.json`: Android package `com.finlit.mobile`, disabled backup, native run scripts and internal APK profile. No SMS vendor, AI service or additional runtime dependency.
- `supabase/migrations/20261104174205_sms_imports.sql`, `types/database.types.ts`: additive schema/RPC integration and regenerated remote types.
- `scripts/test-sms-{parsers,database,queue}.cjs`, `scripts/test-system-ui.cjs`: new unit/accounting/queue tests and real-component SMS review coverage.

## Native capture and privacy

The Android manifest requests only `READ_SMS` and `RECEIVE_SMS` for SMS functionality, never `SEND_SMS`. The exported receiver requires the system `BROADCAST_SMS` permission. It joins multipart PDUs, filters unrelated/OTP/PIN/promotion text before persistence, and queues candidates without networking or a running JS process. Delivery while closed depends on Android/OEM restrictions; force-stop may prevent broadcasts until reopening. Native code has not yet been compiled or device-tested in this environment.

Inbox scans read at most 250 rows per user action using a date/ID cursor and a 1–90 day UI window. The provider is asked for a limit; an independent cursor cap also applies when it ignores that hint. Subscription ID is retained as a hint, never proof of wallet ownership. Account switching isolates local queues; disabling or revoking permission prevents processing. Disabling does not itself revoke OS permissions. The settings button opens Android's controls.

App-private SQLite holds up to 1,000 pending messages per account, including offline confirmations. Up to 5,000 completed fingerprints are retained locally. Acknowledge/clear wipes text and review payloads, retaining deduplication fingerprints. Raw SMS body, sender and SIM details are excluded from API payloads. Android app backup is disabled. The owner-specific cached budget snapshot allows offline review after one successful load. Sign-out suspends capture and processing; clearing candidates is explicit.

Native fingerprints use sender, normalized body, provider sent timestamp and subscription. Inbox/receiver differences on some devices can produce different fingerprints; provider references and manual-entry matching provide additional duplicate protection. Messages without stable references require particular care. Queue-full/capture failures require reviewing candidates and rescanning; no pending confirmation is silently dropped to make room.

## Review and accounting

1. Check current Money Locations balances before enabling. Tracking begins at that moment. Earlier activity stays history-only because it may already be reflected in the balance. Opening-date activity also needs explicit confirmation that it is not already included.
2. Review the message, timestamp source and provider reference; select the actual wallet. A provider match is only a suggestion, particularly with several wallets or SIMs. Sender names are not trusted evidence.
3. Verify the fee (including explicitly verified zero), accounting classification and category. Own-account transfers are not income. Withdrawals transfer principal to Cash and record only the fee as expense. Balance-only, failed, loan, refund and reversal classifications cannot post through this adapter; review them using existing entry/correction workflows.
4. Match a corresponding manual entry, or explicitly confirm that a similar amount/date entry is a separate transaction. Matching attaches metadata without adding financial activity.
5. Confirmation is saved locally before attempting upload on Android. An import is successful only after the database responds. Foreground, incoming-message events and the refresh action retry approved items; unconfirmed items never auto-post. There is no receiver networking or background polling.

`sms_stage` retains allowlisted parsed fields in `sms_imports`, which is a review/history table, not another ledger. `sms_resolve` locks the owner, validates wallet ownership, dates, fees and duplicates, and calls the existing `entry` operation in the same transaction as marking the import complete. It preserves existing insufficient-funds rules. Provider reference and fingerprint uniqueness are scoped to owner, wallet and provider. Direct table writes and direct private-helper calls are denied; reads use owner RLS.

The latest balance observation is selected by transaction time, not arrival order. Comparisons are withheld when later or ambiguously ordered day-only entries/corrections prevent a reliable comparison. Discrepancies never infer a fee or automatically change balances. The existing audited balance-correction form remains the correction path. Removing import details clears monetary metadata but keeps minimal identity/status/reference tombstones and the financial entry, preventing rescans from recreating forgotten activity. History is currently limited to the latest 500 records in the UI.

## Database deployment

`20261104174205_sms_imports.sql` was tested against disposable Postgres, reviewed, and applied to connected project `hqycgmajxoxykcerttuw` on 2026-11-04. Live verification: 10 existing entries, 9 locations and K256 aggregate opening balances unchanged; zero SMS imports were fabricated. RLS is enabled; authenticated direct inserts and helper execution are denied. Types were regenerated from the deployed schema.

No new security advisory was introduced. Existing findings remain: [intentionally inaccessible answer keys](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance review reports [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), including newly created SMS indexes; no missing foreign-key index finding.

## APK build and verification

The Expo project is linked to the existing `vestin/finlit-mobile` EAS project
(`1226801c-4de4-40a4-a88e-712bdb2b46ff`). The `preview` profile uses internal
distribution and `android.buildType: "apk"`. EAS preview environment variables
contain `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; no service-role key is configured for
the client build.

The cloud build completed successfully on 2026-11-05:

- Build: [EAS build 9975b93e-da2d-41f6-befd-0bbb4e1f4b73](https://expo.dev/accounts/vestin/projects/finlit-mobile/builds/9975b93e-da2d-41f6-befd-0bbb4e1f4b73)
- APK: [download the signed internal APK](https://expo.dev/artifacts/eas/-ytvZdxEFeUPfr8cYMlVr4Fmsj4fjiVPXOIrehZUjKQ.apk)
- Package: `com.finlit.mobile`, version `1.0.0` / Android build `1`
- Credentials: EAS remote Android credentials (`Build Credentials Q9PxqpQ2WU`)

The downloaded artifact was identified as an Android package, passed ZIP
integrity validation, and was confirmed to be an APK rather than an AAB. Its
DEX files contain `expo.modules.finlitsms.FinlitSmsModule` and
`expo.modules.finlitsms.SmsReceiver`, confirming that the Kotlin module was
compiled into the application. The binary merged manifest contains
`android.permission.READ_SMS`, `android.permission.RECEIVE_SMS`, and the
`android.provider.Telephony.SMS_RECEIVED` receiver. The receiver is exported
and protected by `android.permission.BROADCAST_SMS`. No `SEND_SMS` permission
or unrelated storage/biometric permission is present. The APK was signed by
EAS using the configured remote Android credentials; no local Android SDK
signing-inspection tool was available for an independent certificate dump.

No Kotlin or Gradle compilation errors occurred. The local JDK/Android SDK
remain unnecessary because compilation was performed by EAS. No phone was available in this environment, so installation and
physical-device behavior remain pending.

Android API references: [SMS broadcast handling](https://developer.android.com/reference/android/provider/Telephony.Sms.Intents), [bounded query arguments](https://developer.android.com/reference/android/content/ContentResolver#QUERY_ARG_LIMIT), [Expo native modules](https://docs.expo.dev/modules/module-api/).

## Automated and physical checks

Passed: supplied SMS parser fixtures/variants; exact money and unknown fees;
SMS database imports/matches/transfers, rollback, opening boundaries, duplicate
retries and RLS; offline approval retention, retry serialization,
disabled/revoked/account-switched behavior and reconciliation ordering; and
Money Locations regression coverage. TypeScript, ESLint (zero warnings),
Expo configuration validation, Android prebuild/autolinking, and
`git diff --check` pass. The database and Money Locations scripts initially
failed because `@electric-sql/pglite` was used by the tests but missing from
`devDependencies`; it was added without changing runtime dependencies, then
both suites passed. Physical-device testing remains pending.

Physical-device checklist — APK compilation and artifact inspection are complete;
the following acceptance steps require a physical Android device:

- Install and launch; deny, grant and revoke permissions; disable/re-enable tracking.
- Scan real MTN/Airtel/Zamtel inbox examples; repeat scans; confirm unknown templates remain review-only; exclude personal messages/OTPs.
- Receive multipart SMS while foregrounded, backgrounded and closed; reopen and review persistent candidates; test force-stop/OEM restrictions explicitly.
- Test two SIMs and multiple same-provider wallets; sign out/switch accounts during capture and sync.
- Confirm offline, restart, reconnect and retry; verify exactly one entry and fee, opening balances unchanged, withdrawal principal moved to Cash.
- Link a manual entry, retain an older message as history, verify balance observations arriving out of order, and exercise audited corrections.
- Exercise auth, lessons and Budget on the installed build; verify no extra SMS permissions in the merged APK manifest.
