# Academic content integration — 3 November 2026

The supplied SQL and integration guide are preserved in this directory as proposals. The applied migration is a reviewed adaptation, not a verbatim execution of the attachment. This review is a software/content desk audit, not independent academic approval or psychometric validation.

## Changes

- All 24 lessons receive one new revision, specific definition examples, structured citation metadata and desk-audit status. The 23 generic concept/example/summary headings are replaced; the already tailored lesson 2.1 headings and tailored numeric/allocation instructions are preserved.
- Exactly 20 incorrect options change in the 18-item initial and final forms. All question IDs, question wording/order, correct option IDs/text, explanations, scoring and module progression remain unchanged.
- Six modules, 72 checkpoints, six eight-item challenges and the 6/8 pass rule remain intact. No Budget Tracker or chart implementation changes.
- Canonical authoring uses `content/academic-polish-data.ts` and `content/academic-polish.ts`; `scripts/knowledge-content.cjs` contains the same updated distractors. Runtime lesson content is fetched from Supabase, not seeded on launch.
- Generators refuse to overwrite existing migration files. Curriculum generation rejects conflicting existing/newer lesson revisions and no longer republishes the retired 12-item diagnostic. Historical migrations remain immutable and are replayed in order.

## Corrections to the supplied patch

1. Earned income is distinguished from payment receipt: work can earn income before it is paid.
2. Cast the JSON definition array index to integer; PostgreSQL does not accept the supplied bigint index operator.
3. Population Council PDF page locators corrected from printed page +6 to printed page +5 in the verified IssueLab edition. Printed page numbers remain unchanged.
4. Core references are added where absent, canonical URLs retained, and supplementary references are not falsely marked page-verified.
5. `sourceStatus` explicitly says `desk-reviewed`. Expert review, student piloting and measured completion duration remain pending.
6. Transaction locks prevent concurrent learner starts during the empty-progress guard. Expected original content fingerprints, revisions, definitions, per-lesson checkpoints and assessment shapes are checked. Any mismatch aborts the entire transaction. Existing module assignments and financial records are preserved.

## Source locator verification

PDF page numbers are one-based. Printed pages can differ from viewer pages.

| Source | Verified locations | Evidence and limits |
| --- | --- | --- |
| [Population Council, 2013](https://www.issuelab.org/resources/21094/21094.pdf?download=true) | Sessions 2, 4, 6, 8, 9, 12–15; printed 16–21, 26–29, 33–36, 40–46, 55–70 | Downloaded PDF session headings and page labels checked; PDF page = printed page +5. Original FinLit scenarios, not reproduced manual activities. |
| [ILO, 2011](https://www.ilo.org/publications/financial-education-youth-trainers-manual) | Sessions 2, 5–8; printed 24–27, 45–67; PDF 33–36, 54–76 | Downloaded manual checked. Instructional source developed for Nepal, adapted to Zambia. |
| [NSFE II, 2019–2024](https://documents1.worldbank.org/curated/en/833041592466192107/pdf/The-National-Strategy-on-Financial-Education-for-Zambia-2019-2024.pdf) | §1.4 printed 7 / PDF 19; §2.2.2 printed 9–10 / PDF 21–22 | Downloaded strategy checked. Historical policy alignment and selected competencies; not a claim of current policy or comprehensive coverage. |
| [FinScope Zambia 2020](https://www.boz.zm/sites/default/files/2026-03/FinScope-2020-Survey-Report.pdf) | §9.1 printed 63–65 / PDF 75–77 | Downloaded survey checked; local payment-use context, not evidence for current tariffs or security guarantees. |
| [EU/OECD, 2022](https://www.oecd.org/content/dam/oecd/en/publications/reports/2022/01/financial-competence-framework-for-adults-in-the-european-union_614b8b97/510f133c-en.pdf) | Income/purchasing power p.20; scams/fraud pp.65–66 | Downloaded framework checked; competency design, not Zambia-specific law. |
| [SEC Zambia warning, 21 February 2023](https://www.seczambia.org.zm/public-warning-unlicensed-investment-advisers/) | Dated warning and independent licensing verification guidance | Regulator text checked on 3 November 2026. No certification of current legislation or provider authorisation. |
| [Bank of Zambia complaints directives](https://www.boz.zm/BankofZambiaCustomerComplaintsHandlingandResolutionDirectives1.pdf) | Proposed §19.2.1 | Regulator URL did not return a usable PDF in this pass. `locatorVerified: false`; locator and current applicability require regulator confirmation. Existing provider-first guidance retained, with no new deadline/refund/legal entitlement claims. |

Other supporting references are retained with `locatorVerified: false` because precise page locators were not checked in this focused pass. No source endorses FinLit.

## Validation

- Full historical migration replay plus the new patch in disposable PGlite/Postgres.
- Exact equality between all 24 database lesson JSON documents and canonical authoring source.
- Exactly 20 incorrect-option changes; unchanged question rows, option IDs/order, correct keys and explanations.
- Atomic refusal for learner attempts, lesson progress, changed item-bank text, unexpected lesson revision and repeat application.
- Full system tests: all lessons, checkpoints/challenges, 5/8 failure and 6/8 pass, retakes, saves, stale writes, account isolation and existing budget behavior.
- Knowledge tests: score patterns, prioritisation, baseline immutability and legacy 12-item history.
- Learning, authentication recovery and debug regression tests.
- Browser tests against disposable Postgres: actual screens, initial assessment, recommendations, allocation practice, saved completion, lesson-to-budget return, persistence/retry and 390/320px layouts.
- Android export succeeded. TypeScript and ESLint passed before final migration-only safeguards; final checks recorded below.

The browser tests use isolated authentication/router adapters and no live learner accounts. Physical Android device behavior and external academic/student review remain unverified.

## Database and operational status

Target: `hqycgmajxoxykcerttuw`. Before applying: eight migrations, zero attempts, zero lesson progress, zero completed module records. All 24 live lesson fingerprints matched replayed original source. Content-only backup and source archive are under `/tmp/finlit-academic-backup` (temporary local backups, not a durable service backup).

Security advisor: answer-key table has RLS with no policies intentionally (client access denied, tested). Existing [leaked-password protection warning](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains outside this content migration.

No commit, push or app deployment performed.

### Confirmed application and final checks

Applied once as **`20261103152355_academic_content_polish`**. Supabase migration history now contains nine entries; the local filename matches the server-generated version. The recorded SQL and local file have identical MD5 `23b301ecc64e942874f1f2948be2fb59` (used only for exact-file comparison).

Post-application verification: all 24 live lesson JSON fingerprints and all 108 initial/final option records equal the tested canonical content. Exactly 20 incorrect options differ from the pre-application backup; correct answers are unchanged. All 27 existing module assignments remain. Attempts, lesson progress, budget plans and entries remain at zero. No schema changes were made, so generated database types required no change.

Final TypeScript, ESLint and whitespace checks passed. Web export generated 41 static routes. Authentication browser regression passed against that export with mocked requests: login/signup, recovery, error states, protected routes, navigation and 390/320px layouts. No emails or live authentication mutations were sent. Seed generator replay was also tested: it preserves the polished curriculum/item bank, keeps the retired diagnostic unpublished, and refuses to overwrite populated migration files.

Files added: `content/academic-polish-data.ts`, `content/academic-polish.ts`, `scripts/test-academic-polish.cjs`, the versioned migration, and this review plus the archived proposed SQL/guide. Files updated: `content/authored.ts`, `content/curriculum-lessons.ts`, `content/learning.ts`, `content/sources.ts`, both seed generators, `scripts/knowledge-content.cjs`, `scripts/test-learning.cjs`, and `scripts/test-system.cjs`.

The migration is live; the application source changes remain local and uncommitted. Remaining review limits are the unverified BoZ directive locator/current applicability, physical Android testing, external expert review and student piloting.
