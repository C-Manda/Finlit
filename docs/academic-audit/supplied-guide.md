# FinLit academic-content patch: integration guide

**Date:** 3 November 2026  
**Target project:** FinLit Supabase project `hqycgmajxoxykcerttuw`  
**Status:** SQL file prepared; **not applied to the live project**. Do not mark as applied until the live migration list confirms it.

## Scope now
- Retains six modules, 24 lessons, 72 lesson checkpoints, six module challenges, diagnostic and final 18-question forms, learning progression, and existing budget-data structures.
- Replaces generic section titles and practice instructions with lesson-specific phrasing using existing UI fields.
- Replaces repeated definition boilerplate with practical situation-specific examples.
- Adds precise, verified page/section locators from the source PDFs to the curriculum metadata, including NSFE II as the guiding policy. Regulatory citations remain subject to final currency check.
- Rewrites **20 distractors** in diagnostic and final assessments. Correct answer text, scoring and question order remain unchanged.
- Bumps lesson content revisions. Preserves assessment identifiers and question IDs; safe only while there are no real learner attempts.
- Adds explicit desk-audit status; **does not claim academic expert approval or psychometric validation**.

## Preconditions
1. Confirm the correct Supabase project and backup existing source/migrations before any write.
2. Inspect `assessment_attempts` and `lesson_progress`. The SQL raises an exception and makes no changes if either has records.
3. Verify the installed application uses Supabase curriculum `structured_content` and the existing assessment rows. Confirm the user app's local seed content will not overwrite these updates on launch.
4. Apply the SQL **once** through your established, versioned migration workflow, ensuring the migration history and local source files remain identical.
5. Do **not** reapply into production after users have completed assessments. In that case create a *new* versioned item bank and content revision with migration/backfill logic.

## Verification
- Exactly 6 published main modules and 24 published lessons.
- Each lesson still has exactly 3 checkpoints; 72 total.
- Exactly 6 module challenges, each with 8 questions, and unchanged 6/8 passing logic.
- Diagnostic and final remain 18 items each, all keyed; baseline/final answer keys unchanged, only incorrect option wording has changed.
- The 20 expected original incorrect options have been replaced, and no correct answer strings were changed.
- Each of 24 lessons has NSFE II precise location and a specific instructional/regulatory/contextual source locator under `references` and `academicAudit`.
- Validate lesson navigation and content rendering, numeric answers, saved progress, and diagnostic/final comparison with a test account.
- Run TypeScript, ESLint, local database/security tests, browser regressions and Android export.

## Next phase, explicitly NOT included here
Budget Tracker improvements and app-wide chart visualisation. Do not add chart libraries, create new activity types, or redesign dashboard graphs in this academic content pass.

## Important limitation
No direct access to the user's latest **uncommitted** VS Code working tree was available here; older uploaded project zip archives do not reflect the current implementation. Bring this patch into the live repository with Codex, reviewing source-of-truth lesson content and data seed files to prevent divergence. The attached SQL is a proposed migration, not a confirmed applied migration.
