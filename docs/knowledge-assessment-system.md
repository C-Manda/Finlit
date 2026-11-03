# Financial knowledge assessment implementation

Updated 3 November 2026. Implemented in the existing Expo SDK 54 app. The database migration is applied to FinLit (`hqycgmajxoxykcerttuw`); application code has not been committed, pushed or deployed.

## Learning journey and reused components

Registration and authentication lead new learners to the initial assessment before guided learning. The existing `ChallengeScreen` player, `finlit_api` RPC, lesson player, six modules, 24 lessons, 72 checkpoints and six module challenges are reused. The Home mockup layout remains intact, with a compact knowledge-profile link and a final-assessment action when eligible. Learn includes the baseline summary, ranked priorities, the next eligible activity and final-assessment status. Profile → Learning progress opens the stored knowledge profile. Budget remains accessible directly and from the assessment introduction.

The player provides one question at a time, previous/next, saved-answer indicators, review/change controls, explicit submission, resume of the same attempt and retry on failure. It shows no correctness before submission. Saving or submission must succeed before results appear. Diagnostic and final results have no pass threshold. Module challenges still require six of eight correct answers.

## Initial and final questions

`scripts/knowledge-content.cjs` contains 18 original initial items and 18 distinct final items. Each competency has one conceptual, one application and one decision item. Each pair covers the same skill with similar arithmetic or decision demands and different wording, numbers or context. Every item has three answer options, a unique key, an explanation, a paired-item identifier, a cognitive-demand label and source identifiers. Answer-key files are build-time database assets; they are not imported by the application.

| Competency | Conceptual question pair | Application question pair | Decision question pair |
| --- | --- | --- | --- |
| Managing Your Money | Cash available versus promised support / unpaid sale | Required laboratory transport versus phone decoration / required printing versus entertainment | Transport and study data / materials and transport within limited available funds |
| Budgeting for Student Life | Purpose of a budget / pre-term spending plan | Unallocated K100 / K150 after four planned expenses | Record and adjust a transport overspend / food overspend |
| Saving and Financial Goals | Separate emergency reserve / protecting a fee goal | Remaining goal divided into three / four contributions | Irregular support and essential expense / delayed support and urgent repair |
| Borrowing and Debt Management | Full repayment obligations / comparing offers | K550 / K660 total repayment including fictional charges | K70 / K80 shortfalls after essential costs |
| Digital Financial Services | Transaction reference / confirmation records | K105 / K156 wallet deduction including fictional fees | Accidental-transfer OTP request / account-blocking PIN link |
| Financial Planning and Investment | Inflation and unchanged money / revising a goal when costs rise | K10 / K20 purchasing-power shortfall | Implausible guaranteed returns with urgency / high returns with refusal to discuss risk |

The initial form is `diagnostic-v2` (version 2); the final form is `final-v1` (version 1). Both use the comparison group `finlit-knowledge-paired-2026-v1`. The old 12-question form is unpublished but retained with its question IDs, answers and historical attempts. No curriculum material was removed.

## Academic basis and limitations

The primary policy alignment remains [NSFE II 2019–2024](https://documents1.worldbank.org/curated/en/833041592466192107/pdf/The-National-Strategy-on-Financial-Education-for-Zambia-2019-2024.pdf), particularly its tertiary-student financial education priorities. This is the requested historical framework, not a statement that it is Zambia’s current policy.

Sources and conceptual roles were checked against the existing `content/sources.ts` catalogue and actual publications or official publication records:

- [Population Council AGEP curriculum (2013)](https://knowledgecommons.popcouncil.org/departments_sbsr-pgy/585/): earning, needs/wants, savings goals and setbacks, money in/out. The archive PDF was downloaded and its text inspected again; no manual exercises are reproduced.
- [ILO Financial Education for Youth (2011)](https://www.ilo.org/sites/default/files/wcmsp5/groups/public/@asia/@ro-bangkok/@ilo-kathmandu/documents/publication/wcms_153921.pdf): goals, savings, borrowing and Session 7 budget planning. Its Nepal setting is not represented as Zambian empirical evidence.
- [FinScope Zambia 2020](https://www.boz.zm/sites/default/files/2026-03/FinScope-2020-Survey-Report.pdf): Zambian money-management and digital-payment context; national statistics are not extrapolated to students.
- [World Bank demand-side assessment (2017)](https://documents1.worldbank.org/curated/en/443321509643632935/pdf/Enhancing-financial-capability-and-inclusion-in-Zambia-a-demand-side-assessment.pdf): financial knowledge, inflation, numeracy and consumer protection context.
- [EU/OECD adult competence framework (2022)](https://www.oecd.org/en/publications/financial-competence-framework-for-adults-in-the-european-union_510f133c-en.html): competency organisation across money, planning, risk and the financial landscape.
- [OECD/INFE toolkit (2022)](https://doi.org/10.1787/cbc4114f-en): distinguishes knowledge from behaviour and attitudes; supports cautious interpretation.
- [PISA 2022 Volume IV (published 2024)](https://doi.org/10.1787/5a849c2a-en): supplementary scenario/problem-solving assessment context. The official publication record was checked, not every page of its full report.

All questions are original Finlit items, not official OECD items or validated proficiency classifications. Three items per topic provide limited sampling. Feedback uses foundational review, additional support, some demonstrated understanding, or all sampled questions correct. The two forms have matched design intent but have **not been psychometrically equated**. Content-validity review, piloting, timing studies and reliability analysis remain research work. The 10–15 minute estimate is a design estimate. No current tariffs, legal entitlements or guarantees are asserted.

## Recommendations and comparison

Recommendations are calculated on the server from the preserved baseline. Topics below full marks are ordered by correct/total ascending, then curriculum order for deterministic ties. Each priority includes a specific skill explanation, lessons completed and whether the module is currently available. A passed module leaves the active priority list; its original baseline score is retained. All-correct profiles receive no unnecessary remediation recommendations. Prerequisites remain authoritative and cannot be skipped because of a diagnostic score.

Results include the stored attempt ID, completion timestamp, form/version, raw score, denominator, overall percentage, all six competency counts/percentages and review areas. The comparison uses the original baseline and earliest completed final attempt, never the highest or latest score. It reports raw-score and **percentage-point** differences only when baseline timing is genuinely pre-learning and the form comparison group and denominators match. Late, historical or incompatible pairs show both records with a limitation instead of an improvement score. Even comparable pairs carry the limitation that these results do not prove lasting behaviour change, wealth or financial wellbeing.

## Database and preservation

All eight remote migrations now have local copies under `supabase/migrations`. Five missing historical files were recovered from the actual remote history and were **not reapplied**. A fresh disposable Postgres database successfully replayed the complete history. The contents of all eight local migration files match the recorded remote SQL checksums.

The new migration is `20261103102018_knowledge_assessment_system.sql`, applied successfully on 3 November 2026. It adds assessment version/comparison metadata, question skill/source metadata, and `learner_assessment_state` with a server-owned original baseline reference and classification. Existing assessment rows, answers and progress are preserved. The generator and schema source are `scripts/generate-knowledge.cjs` and `scripts/knowledge-schema.sql`; future deployed changes require a new migration/version, not editing the applied file.

Legacy eligibility is determined from actual lesson-progress rows, started/completed module progress or module-challenge attempts, not merely provisioned locked/available module rows. These learners retain access without a diagnostic and receive `late_baseline` if they take one later. Earlier completed diagnostics are preserved as `historical_unverified` because their timing cannot be assumed. New/unstarted learners must complete the initial assessment before the server accepts guided lesson or module-challenge operations.

The deployed database had zero assessment attempts, zero lesson-progress rows, zero budgets and zero finance entries before rollout. Its 27 existing module-progress rows were retained. Live verification ran in a transaction and was rolled back; no synthetic results or financial records remain in user accounts. Types were regenerated from the deployed schema.

## Security

`finlit_api` continues to authenticate with `auth.uid()`. Mutations and baseline assignment use the existing per-user advisory lock. The original curriculum implementation is retained privately as `finlit_private.curriculum_api_v1`, with client execute access revoked; callers cannot use it to bypass the new gate. The wrapper checks initial eligibility and final prerequisites on the server, owns scoring and baseline assignment, and returns feedback only after completed submission. Final unlock requires all 24 lessons plus six passed module challenges.

All new functions use fixed search paths. The new learner state table has RLS and owner-only SELECT; clients cannot assign or overwrite baseline references. Existing attempt, score, completion and answer-key protections remain. No service-role credential was added. Budget data is not used for diagnostic recommendations, and spending insights continue to require consent.

The security advisor reports the existing [disabled leaked-password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Its [answer-key table with no RLS policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is intentional deny-all client access. Performance findings are unused-index information on a largely unused database; no destructive index cleanup was performed as part of this feature.

## Files created and modified in this task

Created:

- Routes: `app/final-assessment.tsx`, `app/knowledge-profile.tsx`, `app/learning-comparison.tsx`.
- UI and contracts: `components/diagnostic-gate.tsx`, `components/knowledge-views.tsx`, `content/knowledge.ts`.
- Authoring/database tooling: `scripts/knowledge-content.cjs`, `scripts/knowledge-schema.sql`, `scripts/generate-knowledge.cjs`.
- Test tooling: `scripts/test-database.cjs`, `scripts/test-knowledge.cjs`.
- Five recovered historical migrations and the new assessment migration.
- This report.

Modified:

- `components/auth-gate.tsx`, `components/challenge-screen.tsx`, `components/learning-screens.tsx`, `components/home-screen.tsx`, `components/screen-views.tsx`.
- `content/progression.ts`, `services/learning.ts`, `types/database.types.ts`.
- `scripts/test-system.cjs`, `scripts/test-system-ui.cjs`, `scripts/test-auth-ui.cjs`.
- `README.md`, `docs/implementation-status.md`.

All pre-existing uncommitted work was preserved. No packages were added to the app; PGlite was installed outside the repository for disposable tests.

## Verification

- TypeScript and ESLint: pass with zero errors/warnings after fixes.
- Auth, legacy debug and learning unit/regression suites: pass.
- `test-system.cjs`: full migration replay; all 24 lessons; challenge 5/8 fail and 6/8 pass; initial 7/18; final 15/18; +8 answers and +44.4 percentage points; resume, retries, stale writes, baseline immutability, RLS, account isolation and independent budgets.
- `test-knowledge.cjs`: all-correct, all-incorrect, one weak topic, equal weak topics and mixed scores; deterministic priorities; legacy access; historical 12-question result preservation; late/incompatible comparison limitations; first-time budget creation and transaction save.
- `test-system-ui.cjs`: actual screens/hooks/RPC service against disposable SQL with test auth/router adapters. Covers initial routing, deep-link gating, 18 questions, reload/resume, failed answer save/retry, profile, priorities, module challenges, lesson player, budget return flow, consent, final assessment and comparison at 390/320px, including a 135% browser text-size check.
- Exported-app auth/navigation regression: passed after fixing a router-remount regression in the eligibility gate. Registration with mocked email confirmation, first-time login routing, direct lesson URL protection, Budget access, normal existing-user navigation and recovery flows all passed.
- Web export: 41 routes, approximately 2.69 MB bundle. Android Hermes export: approximately 4.79 MB. Final exports are checked after application changes.
- Live authenticated-role SQL: initial gate, 18-question grading, baseline assignment/preservation, resume, final lock, budget read, lesson access after baseline and cross-account denial passed in a rolled-back transaction.

The private 36-question answer bank was verified absent from the exported web bundle. Browser tests use isolated accounts/fixtures and do not send live registration emails. Physical Android testing, TalkBack, actual device font scaling, keyboard/back-button behaviour, real email confirmation and multi-device sessions have **not** been tested. Browser layout checks and exports do not establish those behaviours. No implementation or database-deployment blocker remains; these device and academic validations are explicitly outstanding acceptance work.

To repeat database tests:

```sh
npm install --prefix /tmp/finlit-testdeps --no-audit --no-fund @electric-sql/pglite
FINLIT_PGLITE_PATH=/tmp/finlit-testdeps/node_modules/@electric-sql/pglite node scripts/test-system.cjs
FINLIT_PGLITE_PATH=/tmp/finlit-testdeps/node_modules/@electric-sql/pglite node scripts/test-knowledge.cjs
FINLIT_PGLITE_PATH=/tmp/finlit-testdeps/node_modules/@electric-sql/pglite FINLIT_BROWSER_PATH=/path/to/chrome node scripts/test-system-ui.cjs
```

The full migration replay stubs only Supabase Auth functions/roles and its user table. `gen_random_uuid` is built into the test database; the Supabase `pgcrypto` extension declaration is omitted in that disposable harness. All application schema, constraints, triggers, grants and policies come from the recovered real migration history.
