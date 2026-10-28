# Standalone loan calculator removal — 21 October 2026

The standalone calculator and repayment-result interface have been retired. Finlit's shared navigation now has four evenly sized items: Home, Learn, Budget and Profile. Existing colours, icons, rounded navigation and active styling are retained. Navigation buttons now expose labels and selected state for accessibility.

## Inspection and changes

The only application entry point was the Loan item in BottomNavigation. It opened /loan-calculator, which opened /loan/result. Neither screen used a dedicated calculation utility, hook, API or service. A full source/reference search found no other application calculator shortcuts or advertised feature descriptions. The historical FinLit_Complete_App_Mockups.html design reference still depicts the former feature; it is not an application route or imported UI and was preserved.

Modified files:
- components/finlit-ui.tsx: removed Loan navigation; four items share the available width.
- components/screen-views.tsx: removed LoanView and LoanResultView plus calculator-only sourcePair and resultLine styles. Shared noticeText, bigIcon, tag and center styles remain because budget/learning screens use them.
- app/loan-calculator.tsx and app/loan/result.tsx: replaced obsolete screen exports with small Redirect components targeting /learn. These are compatibility routes only, with no calculator UI or inbound application links.
- scripts/test-auth-ui.cjs: extended the existing exported-app walkthrough to cover four-item navigation, budget balance/expense/summary/entry behavior, the Borrowing and Debt module, both retired links, Home/Profile navigation and narrow-screen layout.
- docs/prototype-auth.md: updated current feature description and linked this report.
- docs/loan-calculator-removal.md: this report.

Files deleted: none. Calculator components were embedded in a shared file and were removed in place. The two route files deliberately remain for old deep links. No dependencies were calculator-specific, so package.json and the lockfile were preserved.

## Preserved functionality and scope

Module 4: Borrowing and Debt remains unchanged, with Understanding borrowing; Interest, fees and total repayment; Loan affordability; and Managing debt responsibly. The current module is still a four-lesson curriculum plan, not four newly authored lessons. This change does not populate or invent lesson content. The reusable lesson engine, financial mathematics, worked examples, questions, scenarios, diagnostic/assessment services and progress logic remain unchanged.

The three budget views are identical to their pre-removal source. Existing prototype limits remain: personal budget saving and other unfinished features have not been implemented by this removal. A task-local hash comparison confirmed that 32 protected source/package files were unchanged, including content, lesson/assessment components, contexts, hooks, services, libraries, types, constants and dependencies.

No Supabase connection was needed or used. Authentication, sessions, loan_assessments database types, tables, policies, migrations and historical records were not modified. Existing staged/unstaged work was preserved. No commit, push or deployment was performed.

## Verification

Passed:
- node node_modules/typescript/bin/tsc --noEmit
- node node_modules/eslint/bin/eslint.js . --max-warnings 0
- node scripts/test-auth.cjs
- node scripts/test-learning.cjs
- node scripts/test-debug.cjs
- Expo web production export to .expo/loan-removal/export
- FINLIT_TEST_EXPORT=.expo/loan-removal/export node scripts/test-auth-ui.cjs
- git diff --check

The browser walkthrough verified all four navigation buttons, Home/Learn/Budget/Profile routes, absence of the Loan tab/calculator links, the budget balance changing from K780 to K660 after a K120 expense, the original K1,620 breakdown, an editable expense entry, Module 4's four titles, both legacy URL redirects to /learn, and 390/320px layouts. Existing auth/recovery checks also passed and no browser runtime exceptions occurred. The four-item navigation screenshots were visually reviewed under .expo/auth-review.

Browser acceptance uses intercepted Supabase responses and fake accounts; it does not modify live data or verify live database behavior. No Android/iOS device or emulator testing was performed for this change. No removal-related failures remain. Existing prototype limits described above are unchanged.
