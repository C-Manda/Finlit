# Latest update

The 21 October learner-interface and password-recovery changes are documented in [prototype-auth.md](prototype-auth.md). The earlier report below describes the first lesson implementation. Current buttons use Start lesson/Continue lesson/Review lesson and developer commentary has been removed from screens.

# One complete lesson first

The active increment implements one development sample: **Understanding budgets**, the first planned lesson in Module 2, Budgeting for Student Life. The other 23 lessons are titles and prerequisites only. They contain no generated teaching material or module questions. The previous arithmetic preview has been retired; old /learn/pilot links return to Learn.

## Review in the app

Dashboard or Learn → sample recommendation → lesson overview → Start sample lesson. The module overview is available through View module plan or the planned curriculum. Existing published database modules remain accessible through their existing routes.

The player has a fixed header, seven stage segments, a scrolling content area and persistent Previous/primary controls. Situation includes an optional ungraded reflection. Concept includes expandable definitions. Worked example shows a cost breakdown and calculation. Practice accepts a numeric amount, validates it and shows a dedicated feedback stage with different explanations for low, high and correct answers. The checkpoint presents three questions individually; selecting an option does not reveal feedback or advance. Check Answer saves the attempt and reveals its explanation before Next becomes available.

The summary shows takeaways and the actual checkpoint recap, with no checkpoint pass threshold. Completion appears only after the explicit completion save succeeds. Completed lessons remain reviewable without clearing their completion or submitted answers.

The sample uses fictional ZMW amounts and is visibly labelled as development material with unvalidated sources. No authoritative citations, local prices or financial product claims are invented. The 9–12 minute estimate is a design target pending learner testing.

## Content and state

content/learning.ts defines the six-module, four-lesson catalogue, the single structured sample, seven stages, question types, checkpoint state validation and guarded transitions. The sample uses the numeric practice renderer and single-choice checkpoint renderer. Unsupported activity types are deliberately not implemented.

Learning rules are centralized: three checkpoint questions; eight questions and six correct to pass a future module challenge. There are no fabricated module attempts, passing scores or unlocks. The challenge remains visibly unavailable until four authored lessons and secure backend grading exist. Preview access deliberately permits the Module 2 sample without pretending Module 1 has been completed.

## Persistence and database boundary

The existing sample progress adapter now stores only authored lesson records. It uses per-account, versioned localStorage on web and SecureStore on native. Records contain the current and furthest stage, reflection, practice answer/submission, checkpoint answers/checked state/current question and completion. Each record stays below the documented SecureStore size limit.

Stage changes and submitted answers advance only after a successful write. An interrupted save leaves the confirmed stage in place and retains the draft response in the open player. Retry repeats the failed save. A completion error cannot display a completed state. Reading errors offer reload without silently replacing stored data. Stale records detected before writing offer an explicit load-latest action. Writes are serialized within one app runtime; this is not atomic synchronization across browser tabs or devices.

An unsubmitted input is held in memory while editing. Previous and Save and close save it; abrupt app termination before either action can lose that draft. Submitted work and confirmed stage changes survive reload. Clearing app/browser data loses local progress.

The old finlit.sample.v1 records remain untouched. Their arithmetic questions and scores are incompatible with this sample and are not imported into finlit.sample.v2. This sample does not write lesson_progress, module_progress, assessment_attempts or any live lesson content.

## Backend work still required

The code and schema audit in [debug-audit.md](debug-audit.md) remains applicable. Existing lesson_progress supports completion only and authenticated learner writes are currently denied. There is no verified server grading operation for the new module challenge.

Before production integration: capture the live schema/grants/policies and migration history, rehearse on a development database, agree content revisions and citation review, extend the existing lesson progress entity with versioned stage/response state and owner-scoped atomic persistence, and implement trusted assessment submission with prerequisite checks and preserved passing results. Reconcile the existing 70% configuration with the agreed 6/8 rule explicitly. Verify with two authenticated learners before rollout. No live migration, policy, grant or content changes were made for this increment.

## Checks and remaining acceptance

Run:
- node node_modules/typescript/bin/tsc --noEmit
- node node_modules/eslint/bin/eslint.js . --max-warnings 0
- node scripts/test-learning.cjs
- node scripts/test-debug.cjs

The learning regression suite covers the single authored sample, 24-title plan, math, seven-stage gates, checked checkpoint feedback, navigation and review preservation, save/restore, account isolation, failed writes and stale-record rejection. The debug suite retains the existing assessment/auth-related regression coverage.

Verified on 17 October 2026: TypeScript, ESLint and both regression suites passed. Expo production exports succeeded for Android (Hermes), iOS (Hermes) and web. A headless Edge run of the real player and device-storage service passed all seven stages, optional reflection, expandable definitions, numeric validation, wrong/correct feedback, failed saves and retries, checkpoint explanations, reload/resume, a failed completion save, confirmed completion and completion-preserving review. It also checked 390px and 320px viewports, enlarged browser text, horizontal overflow and a stationary header while content scrolls. There were no browser runtime exceptions.

The isolated fixture uses a test account identifier and a simulated save failure; it does not replace the production auth or router. Against the exported production web app, opening the protected sample route without a session correctly returned to the existing welcome screen, and Get started opened the login screen. Real credential-based sign-in and authenticated cloud persistence were not tested.

A repeatable UI check is included as node scripts/test-lesson-ui.cjs (Node 22+ and Microsoft Edge on Windows; FINLIT_BROWSER_PATH can point to another Chromium executable). It writes its fixture, private browser profile and screenshots only under .expo/lesson-review, outside app routes. If an Expo production export exists at .expo/lesson-review/app-export, it also checks the anonymous auth guard and login navigation. An Android device or emulator smoke test and a real authenticated cloud save/read-back remain required. Browser layout checks and native bundle compilation do not establish native keyboard, TalkBack or real sign-in behavior.

## Phone review before authoring more content

1. Open Learn, select Explore the sample lesson, and start it.
2. Work through Situation, Concept and Worked example. Expand a definition and scroll the breakdown.
3. Enter 200 in Practice to see the explanation, try again, then enter 120.
4. Check each of the three checkpoint answers before advancing. Leave and reopen after one checked answer.
5. Complete the sample, leave, reopen and review it. Confirm completion remains and the next unbuilt lesson/challenge explains why it is unavailable.

Test portrait Android with a visible keyboard, large system text and TalkBack. Check content remains scrollable above the footer. Measure the time with a learner before confirming the 9–12 minute estimate. Refine this sample and validate its citations before expanding the 23 planned lessons.