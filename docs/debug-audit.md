# Finlit code and database audit — 17 October 2026

## Outcome
Reviewed the current uncommitted Expo/React Native/TypeScript code and inspected FinLit database metadata and aggregate integrity counts read-only. Fixed confirmed client bugs. No live database data, policies, grants, functions or schema were changed. Existing user changes were preserved; nothing was committed.

## Fixed
- Removed the screen catalogue's blanket @ts-nocheck. This exposed 31 diagnostics, including repeated references to missing styles, unsupported Ionicons names, and a nullable lesson progress access. Added the missing error/module/title styles, corrected icons and the nullable guard, and fixed the recommendation button's invalid slug-as-UUID link.
- Published lesson screens no longer display completion while progress is loading or retain a previous lesson/account's completion. Save errors are shown. Progress reloads when returning to screens, and list/single-record reads are scoped to their identity.
- Assessment initialization is handled by a keyed lifecycle rather than an unstable start callback in a render effect. In-flight attempt creation is coalesced within the app runtime. Resume hydrates persisted answers.
- Assessment selection updates only after successful persistence. Duplicate taps and submission during saves are blocked; failures keep the last saved answer and display retryable errors. Late responses cannot update a different user's/assessment's state.
- Diagnostic discovery now filters assessment_type=diagnostic instead of choosing any published assessment.
- Attempt creation no longer inserts topic_scores. Answer writes no longer send answered_at. Only fields permitted by live column grants are sent.
- Answer saves verify the owned open attempt and assessment/question membership. Updates touch only selected_option_id; missing answers are inserted, with unique-conflict recovery. A general upsert is unsuitable here because it also attempts to UPDATE immutable attempt_id/question_id columns.
- Submission checks the complete persisted question set and handles repeated submission after a lost response. Unsupported permissions produce a clear blocked-feature message; no client-side score is invented.
- Lesson completion uses the existing user/lesson uniqueness key to avoid duplicate insert races and preserves an already completed record. Its live write permission remains blocked, as described below.
- Removed the forbidden client profile-creation fallback. The existing auth.users trigger creates profiles; missing provisioning now produces a clear support error.
- Session restoration rejection can no longer leave authentication loading forever. Auth events take precedence over an older initial-session response. Login submission resets its busy state on failure.
- Sample progress reads wait for queued writes, preventing stale resume after immediate navigation.
- Matched expo-secure-store to the installed Expo SDK 54 bundle (~15.0.8, replacing ^57.0.4) and updated the lockfile.
- Fixed the test script's missing Buffer import, removed Unicode BOMs, and excluded generated .expo files from lint.

## Confirmed database conflicts and remaining work

| Priority | Operation | Live permission/schema evidence | Effect / required work |
| --- | --- | --- | --- |
| P1 | Submit published assessments | authenticated has no UPDATE grant on assessment_attempts.completed_at; no public grading RPC or grading trigger was found | Direct submission is blocked. Add a reviewed server submission transaction/RPC that validates ownership, completeness, state and scoring. Current app retains saved answers and reports the limitation. |
| P1 | Save published lesson completion | authenticated has no INSERT/UPDATE grant on any lesson_progress column, despite owner RLS policies | A safe completion endpoint or explicitly reviewed permissions are required. An RLS policy alone does not grant SQL access. Sample device progress is unaffected. |
| P2 | Concurrent attempt starts across devices | No partial unique index for one open attempt per user/assessment | Runtime coalescing helps one app instance only. Reconcile duplicates, then add a partial unique index and atomic start/resume endpoint. |
| P2 | Attach an answer to a different assessment / edit a submitted attempt | Owner RLS does not check completed_at or question.assessment_id against attempt.assessment_id | Client now rejects these, but database enforcement is still needed; raw API callers can bypass client checks. Keep the existing composite option/question foreign key. |
| P2 | Score and curriculum configuration | Score fields are percentages, live marks are 70; sample design requires 6/8 (75%). Only the test module was published at inspection. | Reconcile configuration explicitly and validate the final six-module curriculum before publishing. Do not treat samples as live curriculum. |
| P2 | Cloud resume | lesson_progress has completion fields only | Versioned stage/practice/checkpoint storage and a reviewed synchronization adapter are still required. Sample storage is local, not cloud progress. |

Column-grant audit:
- assessment_attempts INSERT permits user_id, assessment_id only. Score, passed and topic_scores are protected.
- assessment_answers INSERT permits attempt_id, question_id, selected_option_id; UPDATE permits selected_option_id only. is_correct is protected.
- The existing composite (question_id, selected_option_id) foreign key verifies that options match questions.
- Answer-key RLS is admin-only. A table SELECT grant by itself does not make answer keys readable to ordinary learners.
- Profiles are provisioned by private.handle_new_user via the auth.users insert trigger. The learner profile INSERT denial is consistent with that design.

Aggregate integrity checks found zero duplicate open-attempt groups, zero answers crossing assessment boundaries, and zero completed-but-ungraded attempts at inspection. These counts describe current rows, not guarantees against future races or API misuse.

## Safe database follow-up
Keep restricted score/grade fields and answer keys protected. Implement server start/resume, completion and submission endpoints in a development environment first; use a narrowly scoped privileged function only where necessary, with explicit auth.uid ownership, fixed search_path and restricted EXECUTE grants. Validate eight distinct module questions and 6/8 passing, lock submitted attempts, and update best progress transactionally. Check RLS and column privileges as two different layers. Rehearse migrations and rollback before applying anything to production. See learning-experience.md for the content migration plan; this audit supersedes its earlier policy-only observations and pre-fix code findings.

## Verification
- TypeScript: node node_modules/typescript/bin/tsc --noEmit — passed with screen-views.tsx suppression removed.
- Lint: node node_modules/eslint/bin/eslint.js . --max-warnings 0 — passed.
- Learning regression checks: node scripts/test-learning.cjs — passed.
- Debug regression checks: node scripts/test-debug.cjs — passed.
- git diff --check — passed (Git emitted Windows line-ending notices only).

Debug checks cover live-shaped column permissions, invalid ownership, question/assessment membership, duplicate answer inserts, incomplete/repeated submission, blocked database writes, lesson completion races, restored answers, failed-save UI state, duplicate taps and stale account responses. They use a query mock and a small hook lifecycle harness; they do not replace an authenticated Supabase integration test or native-device smoke test. No signed-in learner writes or device UI tests were performed.
