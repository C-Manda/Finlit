# Finlit learning and Budget Tracker implementation

Historical curriculum/Budget Tracker report, updated 2 November 2026. The diagnostic described below was superseded on 3 November by the [18-question initial/final assessment system](knowledge-assessment-system.md), which also documents the reconciled migration history.

## Result and scope

The existing Expo SDK 54 / React Native 0.81 / Expo Router 6 application now has six authored modules, 24 seven-stage lessons, 72 checkpoints, six eight-question module challenges and a 12-question diagnostic. The existing lesson player, authentication provider, purple theme and navigation were extended. No application dependencies were added or upgraded. The two database migrations were applied with user authorisation on 2 November 2026. No commits, pushes or app deployment were performed.

Production screens use the authenticated `finlit_api` RPC. They do not fall back to invented records when the backend is unavailable. The locally tested database is a disposable Postgres fixture derived from repository types, **not a copy of the live database**.

## Live database rollout

The configured FinLit project, `hqycgmajxoxykcerttuw`, is now ACTIVE_HEALTHY. The account-loading failure was traced to missing `public.finlit_api` (PostgREST HTTP 404/PGRST202), with both migrations absent. Auth health and network connectivity from the development environment worked.

Before applying, live constraints, triggers, policies, grants, content ordering and progress were inspected. A restricted local backup of the affected existing content/progress and schema metadata was saved outside the repository. Four existing modules were matched by meaning and order; the legacy test module and its two lessons were retained. All 19 existing module-progress rows were preserved. There were no existing lesson-progress, assessment-attempt or financial-entry records.

Compatibility fixes before deployment use the existing `module_quiz` assessment type and extend the question-topic constraint while retaining its legacy values. The disposable database fixture now includes these live constraints; the complete system regression suite passed.

Applied migration versions are `20261102204338` (learning_budget_system) and `20261102204350` (curriculum_content). Local filenames match the remote migration history, and TypeScript database types were regenerated from the live schema. The new curriculum contains six keyed modules and 24 lessons, alongside the retained legacy test content.

Live authenticated-role checks confirmed account snapshots and budget reads. A rolled-back live transaction also passed diagnostic grading, budget creation, expense save/retry, insight consent and cross-account isolation checks. Test records were not retained. PostgREST now resolves the RPC: an unauthenticated request returns the expected HTTP 401/42501 instead of the missing-function error. Actual sign-in and device acceptance remain to be tested in the app. Server-only answer keys remain inaccessible to client roles. The security advisor's no-policy finding on answer keys reflects intentional deny-all access; leaked-password protection remains an existing Auth configuration advisory.

## Curriculum records

All lessons have a measurable objective, Zambia-relevant fictional situation, concepts and definitions, worked reasoning, interactive practice, response-specific feedback, exactly three checkpoints, two or three takeaways and structured academic references. Estimated duration is ten minutes, a design target pending learner timing studies.

| Module | Four authored lessons | Final assessment |
| --- | --- | --- |
| 1. Managing Your Money | Understanding Income; Needs, Wants and Financial Priorities; Understanding Expenses; Making Everyday Money Decisions | 8 questions |
| 2. Budgeting for Student Life | Understanding Budgets; Planning Your Monthly Allowance; Tracking Expenses; Adjusting a Budget | 8 questions |
| 3. Saving and Financial Goals | Why People Save; Setting Financial Goals; Choosing Where to Save; Emergency Savings and Setbacks | 8 questions |
| 4. Borrowing and Debt Management | Understanding Borrowing; Interest, Fees and Repayment; Borrowing Affordability; Managing Debt Responsibly | 8 questions |
| 5. Digital Financial Services | Mobile Money and Digital Payments; Transaction Fees and Records; Scams and Digital Security; Consumer Rights and Complaints | 8 questions |
| 6. Financial Planning and Investment Basics | Planning Beyond This Month; Inflation and Purchasing Power; Financial Risk and Return; Evaluating Investment Claims | 8 questions |

Practice includes scenario comparisons, numeric budgeting/savings/borrowing/purchasing-power calculations, and an editable five-category allowance allocation after delayed support. Allocation feedback accepts multiple feasible plans and identifies overspending or unmet stated needs. Learning never inserts fictional transactions into personal finance records. The standalone loan calculator remains retired.

The diagnostic reports six topic scores and informs explanations of practice needs while respecting prerequisites. It is an original prototype knowledge check, not a validated OECD classification. Its items reuse selected teaching checkpoints; the 48 module-challenge questions are separately authored. Research evaluation should account for this diagnostic/teaching overlap and conduct independent content-validity and reliability review.

## Source verification and traceability

No source PDFs were present in the repository initially. Original publications or publisher records were located and checked. `content/sources.ts` holds author, year, title, URL, relevant sections and role; lesson `references` identify the supporting concept and section. Full copyrighted manuals were not added to the repository. Original explanations, scenarios and questions were authored; no substantial manual activities were reproduced.

| Source | Verification and use |
| --- | --- |
| [NSFE II, 2019–2024](https://documents1.worldbank.org/curated/en/833041592466192107/pdf/The-National-Strategy-on-Financial-Education-for-Zambia-2019-2024.pdf) | Original policy PDF; youth/tertiary priorities and practical capability. Treated as the requested historical framework, not as a claim about current policy. |
| [Population Council, 2013](https://knowledgecommons.popcouncil.org/departments_sbsr-pgy/585/) | Publisher record/DOI checked. Publisher download and browser archive access initially failed; the original 112-page manual was then downloaded successfully from [IssueLab](https://www.issuelab.org/resources/21094/21094.pdf?download=true). Relevant earning, needs/wants, spending, cash-flow, savings, setbacks and communication sections were reviewed. Session references avoid inconsistencies between contents-page numbers and the body. The publisher landing page has a CC BY-NC-SA notice; the original PDF also contains specific reproduction restrictions. No broad electronic-reproduction permission is assumed. |
| [ILO, 2011](https://www.ilo.org/sites/default/files/wcmsp5/groups/public/@asia/@ro-bangkok/@ilo-kathmandu/documents/publication/wcms_153921.pdf) | Original trainer manual; goal setting, savings, spending, financing, risk/insurance, budgets, negotiation and earnings. Contextualised for Zambia; not presented as Zambian research. |
| [FinScope Zambia 2020](https://www.boz.zm/sites/default/files/2026-03/FinScope-2020-Survey-Report.pdf) | Original Bank of Zambia report; cash flow, payments, savings, credit, chilimba and kaloba sections. No unsupported student-population statistics or current tariffs inferred. |
| [World Bank, 2017](https://documents1.worldbank.org/curated/en/443321509643632935/pdf/Enhancing-financial-capability-and-inclusion-in-Zambia-a-demand-side-assessment.pdf) | Original demand-side assessment; financial knowledge, behaviour, inclusion and consumer protection. |
| [EU/OECD adult framework, 2022](https://doi.org/10.1787/510f133c-en) | Official framework; money/transactions, planning, risk/reward and financial landscape. |
| [OECD/INFE toolkit, 2022](https://doi.org/10.1787/cbc4114f-en) | Official publication; knowledge, behaviour, attitudes and digital financial literacy inform assessment design. No OECD items copied. |
| [PISA 2022 Volume IV, 2024](https://doi.org/10.1787/5a849c2a-en) | Official publication metadata and assessment context checked; supplementary reference. The large full PDF was not completely inspected. No detailed results or statistics are asserted from it. |
| [BoZ complaints directives, 2020](https://www.boz.zm/BankofZambiaCustomerComplaintsHandlingandResolutionDirectives1.pdf) | Official indexed directive text checked for provider-first complaints; [BoZ Annual Report 2025](https://www.boz.zm/sites/default/files/2026-06/Bank%20of%20Zambia%20Annual%20Report_2025.pdf) also references these directives. The lesson teaches evidence gathering and checking current official escalation guidance; it makes no refund or deadline guarantee. |
| [SEC investment-adviser warning, 2023](https://www.seczambia.org.zm/public-warning-unlicensed-investment-advisers/) | Official warning checked for independent authorisation verification. Licensing is not represented as a return guarantee. |

Amounts, fees, prices and returns in exercises are explicitly fictional. Worked calculations and scoring were checked; learner testing and academic supervisor review remain necessary before research claims about effectiveness.

## Progress, assessments and security

The server authenticates with `auth.uid()`, serialises mutations per learner, checks prerequisite completion and validates stage transitions. Lesson state includes revision, current/furthest stage, reflection, submitted practice, checkpoint choices and reviewed flags. Completion timestamps remain in `lesson_progress`. Completion is shown only after persistence succeeds. Completed answers cannot be reset during review.

Assessment flow is introduction → saved answers → review → confirmed submission → actual result/explanations. All eight answers are required; six correct passes. Grading uses server-only answer keys. Direct client writes to attempts/mastery and reads of keys or legacy question explanations are revoked. RLS restricts learner progress, attempts and finances to their owner. SQL functions use a fixed search path. No service-role credential is used by the client.

Compare-and-swap records/revisions reject stale writes. Retry identifiers prevent duplicate finance entries; repeated submissions return their saved result. Retakes preserve history and a later failure cannot remove a prior passing result. Local tests exercise these behaviours and cross-account access.

The existing device-local sample adapter and its tests remain for compatibility; production routes use Supabase. Old local data is not deleted or promoted into trusted cloud mastery. A normal stage transition, checked response or Save and close persists the current draft. An abrupt process kill before one of those actions may lose unsubmitted text. Full offline sync is not implemented; failures retain the open-screen draft and offer retry. Native hardware-back and process-termination behaviour still require device testing.

## Budget integration and insights

Lessons 2.1–2.4 expose optional metadata-driven actions: Explore a Budget, Create My Budget, Record a Transaction and Review My Budget. The `from` route parameter preserves the return lesson; saved learning remains unchanged. Budget access is also available independently through its tab.

Budgets support a period, planned income, expense-category allocations, visible unallocated funds/shortfalls and revision. Transactions support actual income/expenses, amount, matching category, actual date and optional description. Budget periods cannot overlap. Transfers are not recorded as income/expenses because the existing finance schema supports only those two types; the UI explains recording fees separately. Planned income and recorded net flow are clearly distinguished from a bank/wallet balance.

Personalised insights are off until account-level consent is saved, and can be disabled. Rules cover no budget, approaching a category allocation (configurable default 80%), spending above allocation and use of the uncategorised category. Recommendations link to lessons without bypassing prerequisites. The schema has no expected-income schedule, so the app does not infer late support from planned income. These are deterministic educational rules, with no AI dependency or fabricated records.

## Applied migrations

- `supabase/migrations/20261102204338_learning_budget_system.sql`: extensions to existing content/progress/attempt/profile/finance tables; one new `budget_plans` table; indexes, scoped RLS/grants, private validation/grading logic and public `finlit_api` wrapper.
- `supabase/migrations/20261102204350_curriculum_content.sql`: six modules, 24 published lessons, 72 embedded checkpoints, six challenges/48 questions, one diagnostic/12 questions and 12 finance categories. Deterministic keys and guarded reuse preserve identifiers. Repeated application is tested; changed assessment content and changed lesson content with progress abort rather than silently altering learner history.

Both migrations run transactionally. No tables or learner rows are dropped. The seed is generated by `scripts/generate-curriculum.cjs`; future changes after deployment need new revision migrations, not edits to already-applied files. `types/database.types.ts` was regenerated from the migrated live database.

## Verification

| Check | Result and limits |
| --- | --- |
| TypeScript | Passed after new interactions and glossary changes. |
| ESLint | Passed with zero errors and zero warnings; earlier generator and test-harness failures were corrected. |
| Learning unit/regression suite | Passed: transitions, validation, maths, resume, failed writes, stale writes, account isolation and review preservation. |
| Auth and legacy debug unit suites | Passed; no live email or account operations. |
| `test-system.cjs` | Passed with PGlite Postgres and both migrations, including repeated application before/after learner data. All 24 lessons and six challenges exercised; 5/8 fail, 6/8 pass, diagnostic, retakes, RLS, private keys/explanations, revision conflicts, allocations, budgeting and consent tested. |
| `test-lesson-ui.cjs` | Passed real player with isolated local-storage adapter: seven stages, feedback, save/completion failure and retry, reload/resume, review, 390/320px and enlarged text. This is not the production persistence adapter. |
| `test-system-ui.cjs` | Passed real screens/hooks/RPC service against disposable SQL, with test auth/router adapters: diagnostic/recommendations, failed and passed challenges/history, allocation practice, lesson completion, budget creation, expense save/retry, return to learning and insight consent. No browser runtime exceptions. |
| `test-auth-ui.cjs` | Passed exported app with all Supabase requests intercepted: auth/recovery, normal sign-in, account-empty budget, navigation, Module 4 and retired routes, 390/320px. No real accounts, emails or backend writes. |
| Web export | Passed final export: 38 static routes, 2.67 MB web bundle. Glossary ships definitions only; full lesson content loads through the account RPC. |
| Android export | Passed final Hermes export: 4.76 MB Android bundle. No emulator/device run. |
| Source and route audit | All 24 lessons populated; no obsolete development-placeholder copy found in active screens. Screenshots visually reviewed for lesson summary and budget insights. |

### Repeat checks

Use Node 22+ and installed project dependencies. From `finlit-app`:

```sh
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --max-warnings 0
node scripts/test-auth.cjs
node scripts/test-debug.cjs
node scripts/test-learning.cjs
```

For disposable database tests, install the test-only engine outside the app and point the runner at it:

```sh
npm install --prefix /tmp/finlit-testdeps --no-audit --no-fund @electric-sql/pglite
FINLIT_PGLITE_PATH=/tmp/finlit-testdeps/node_modules/@electric-sql/pglite node scripts/test-system.cjs
FINLIT_BROWSER_PATH=/path/to/chrome FINLIT_PGLITE_PATH=/tmp/finlit-testdeps/node_modules/@electric-sql/pglite node scripts/test-system-ui.cjs
FINLIT_BROWSER_PATH=/path/to/chrome node scripts/test-lesson-ui.cjs
node node_modules/expo/bin/cli export --platform web --output-dir /tmp/finlit-web-export
FINLIT_BROWSER_PATH=/path/to/chrome FINLIT_TEST_EXPORT=/tmp/finlit-web-export node scripts/test-auth-ui.cjs
node node_modules/expo/bin/cli export --platform android --output-dir /tmp/finlit-android-export
```

Browser fixtures/screenshots stay under ignored `.expo/lesson-review`, `.expo/system-review` and `.expo/auth-review`. Browser tests use separate ports and isolated profiles. The Linux runner needed `--no-sandbox`; these profiles should be used only for the local test pages. Temporary Node/PDF/test tools were kept outside the app. The versioned Expo docs URL redirected to latest; the SDK 54 Router documentation was also read from the official `expo/expo` `sdk-54` source branch.

### Android and live acceptance still required

| Workflow | Device/live verification |
| --- | --- |
| A | Register and sign in to the migrated project, finish diagnostic, confirm the explained recommendation and first eligible lesson. Verify the profile-creation trigger. |
| B | Complete seven stages with TalkBack, keyboard open and large system text. Check all three checkpoints, saved confirmation and touch targets. |
| C | Save midway, close/relaunch, and sign in on a second device. Confirm resume. Kill the app during a save and distinguish confirmed state from unsaved input. |
| D | Complete four lessons; verify challenge unlock and next-module access only after 6/8. Try a locked deep link. |
| E | Fail with 5/8, view explanations, retake and confirm history. A later failure must not erase mastery. |
| F | Use lesson 2.2 → create budget → save → return; verify completion and personal allocations after relaunch. |
| G | Use lesson 2.3 → record actual expense → save → return. Verify cents, date, category and no duplicates after connection loss. |
| H | Consent, record spending near/over an allocation and verify the rule. Disable insights, reload and confirm consent persists. |
| I | Review completed lessons and ensure previous answers, timestamps and module mastery survive. |
| J | Airplane mode, expired session, stale second device, invalid inputs, incomplete assessment and two-account RLS tests through the actual Supabase API. Confirm no key/explanation access before submission. |

Also check Android safe areas/navigation bars, physical back, keyboard dismissal, small portrait screens, TalkBack focus order and live-region announcements, reduced-motion settings and large text. Browser tests and bundle exports do not establish these native behaviours. Measure the 9–12 minute lesson target with representative Zambian students.

## File inventory

Added:

- Routes: `app/budget/create.tsx`, `app/glossary.tsx`, `app/learn/challenge/[id].tsx`.
- Screens: `components/budget-screens.tsx`, `components/challenge-screen.tsx`, `components/learning-screens.tsx`.
- Content/logic: `content/authored.ts`, `content/curriculum-lessons.ts`, `content/sources.ts`, `content/glossary.json`, `content/progression.ts`, `content/budget-rules.ts`.
- Account persistence: `hooks/use-learning.ts`, `services/learning.ts`.
- Tooling: `scripts/assessment-content.cjs`, `scripts/database-fixture.sql`, `scripts/generate-curriculum.cjs`, `scripts/load-typescript.cjs`, `scripts/test-system.cjs`, `scripts/test-system-ui.cjs`.
- The two SQL migrations listed above and this report.

Modified:

- `app/learn/lesson/[id].tsx`, `app/learn/module/[id].tsx`, `app/savings.tsx`.
- `components/assessment-views.tsx`, `components/finlit-ui.tsx`, `components/lesson-player.tsx`, `components/sample-learning.tsx`, `components/screen-views.tsx`.
- `content/learning.ts`, `hooks/use-sample-progress.ts`, `services/sample-progress.ts`, `types/database.types.ts`.
- `scripts/test-learning.cjs`, `scripts/test-lesson-ui.cjs`, `scripts/test-auth-ui.cjs`.
- `README.md`, `docs/learning-experience.md` (current status links; earlier report retained as history).

Live database checks cover the operations documented above; native device usability and academic effectiveness remain unverified.
