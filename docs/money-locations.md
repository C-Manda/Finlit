# Money locations — 4 November 2026

Money locations extend the existing Budget and Add Entry components; the two summary cards, global theme and navigation remain unchanged. No dependencies or SMS permissions were added.

## Accounting contract

- `money_locations.opening_balance` is a separate numeric baseline. MTN with K500 opening has K500 available and creates **zero income entries**.
- `opening_date` means the start of that Lusaka calendar date. The app explains that same-day entries must be subsequent activity not already included in the baseline. Earlier entries cannot be linked to that location.
- Existing transactions remain unassigned and retain their IDs, dates, categories and reports. Unassigned entries affect financial reports only. They never silently become Cash activity.
- One server ledger derives balances from opening balances, linked existing income/expenses, both sides of existing transfer rows, attached fees and audited corrections. No mutable running-balance column exists. The available total sums active locations once; the distribution uses those same balances.
- Income fees, expense fees and transfer fees debit the source location and remain ordinary report expenses. Transfer principal is neither income nor expense.
- Corrections record a signed delta, old/new balance, reason, owner, timestamp and retry identifier. They never overwrite openings or create income/expenses. Cash starts at zero and can be corrected to the amount already held.
- Dates have day-level granularity. Every write checks all resulting end-of-day balances, including edits/deletions that affect later spending. Negative tracked balances are rejected atomically.
- Per-owner transaction advisory locks serialize financial writes and the Budget snapshot. Revision checks protect edits; expected balances protect corrections; request IDs protect retries. A correction submitted after another operation changes its expected balance must reload.

## Files and database

- `components/money-locations.tsx`: cards, responsive two-column layout, distribution, creation, corrections, audit history and shared location picker.
- `components/budget-screens.tsx`: section placement and existing Add Entry integration with source/destination fields and route preselection.
- `content/budget-rules.ts`: typed locations/corrections on the existing budget response. Report calculations remain entry-based.
- `services/learning.ts`: financial ownership/session errors for location operations.
- `types/database.types.ts`: database schema types.
- `supabase/migrations/*_money_locations.sql`: new tables, owner-aware foreign keys, indexes, RLS/read grants, single-Cash index/auth trigger, aggregate ledger and existing RPC extension.
- `scripts/test-money-locations.cjs`, `scripts/test-system-ui.cjs`: accounting, migration safety, access-control and actual screen regressions.

Cash is backfilled once for existing users and created by an auth-user trigger for future users. Authenticated clients cannot directly insert/update/delete financial data. Private helpers cannot be invoked by clients. All mutations use `finlit_api` with authenticated ownership validation. No existing financial entries are rewritten.

## SMS import boundary

The reviewed SMS adapter is documented in [Mobile Money SMS integration](mobile-money-sms.md). It supplies confirmed transactions to the existing ledger API, with explicit wallets, database deduplication and opening-balance boundaries. It does not replace Money Locations or count opening balances as income. Native APK/device verification remains pending; see that document for actual build and test results.

## Validation and limits

The isolated database test covers existing/new-user Cash, K500 opening without income, multiple banks/colours, linked activity/fees, transfers, corrections/history, retry and stale-request handling, overdraft protection across edits/deletes, earlier-date rejection, competing spend requests, legacy reports, ownership/RLS and denied direct writes. PGlite serializes connections; it verifies competing API requests and resulting balances, not real multi-session Postgres lock timing. Production uses PostgreSQL transaction advisory locks.

Browser verification exercises the real screens and RPC against disposable Postgres, including failed-save retry, wallet preselection, linked income/expense/transfer, corrections, history, 320px layouts and light/dark modes. Physical-device interaction remains a manual check; Android export is a bundle check, not an installed-device test.

Bank and custom Mobile Money provider colours are selected on creation. “Delete a location” removes a zero-balance non-Cash card by setting it inactive; history and linked transactions remain. Cash cannot be archived or deleted through the client. Subsequent transaction changes cannot leave a deleted location with a nonzero balance. The Budget API retains the existing full entry history response; balance calculation itself is a server aggregate with no per-location network calls.

## Deployment and checks

Applied to the connected Supabase project:

- `20261104121505_money_locations.sql`
- `20261104121807_money_location_owner_indexes.sql`

Live verification found one zero-opening Cash location per existing user, no duplicate Cash, no previously linked transactions and unchanged original entry counts/principal/fees. Generated TypeScript types now match the remote schema. Reload the app; no new environment variables or dependencies are required.

Security review introduced no new security advisories. Existing unrelated findings remain: [intentionally inaccessible assessment answer keys](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The follow-up migration covers both ownership foreign keys with composite indexes. Newly created indexes naturally have no usage history yet.

Passed: TypeScript; ESLint with zero warnings; `git diff --check`; money-location accounting and migration tests; existing budget UX, full database learning/system, authentication-recovery and learning unit suites; full real-component browser/SQL suite; web and Android exports. The browser suite confirms no JavaScript exceptions and no horizontal overflow at 320px, and covers a failed location-save retry. Its wallet-selection assertion also verifies the explicit accessible checked state. Light/dark review images are under `.expo/system-review/screens/money-locations-{light,dark}.png`.

The complete browser suite was rerun using its unchanged, freshly generated fixture bundle after an initial browser-start timeout on the external workspace drive. Its disposable Chrome profile now uses the system temporary directory. `FINLIT_TEST_REUSE_BUNDLE=1` is an opt-in diagnostic shortcut; normal runs rebuild the fixture.

### Deletion and other-provider colours

`20261104131233_delete_money_locations.sql` is applied. Deletion validates ownership, uses the existing per-user lock, checks the current server balance and is safe to retry. It never deletes entries or creates report activity. Nonzero balances must first be transferred or explicitly corrected. Deleted locations remain labelled in Balance history, but disappear from cards, entry pickers and distribution. No live user locations were deleted during implementation. Other provider names and their chosen card colours use the existing creation API.
