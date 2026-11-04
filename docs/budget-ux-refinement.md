# Budget UX refinement — 4 November 2026

This update changes flow, grouping and explanatory copy while retaining FinLit’s existing colours, typography, cards, buttons and chart styling.

## Recording versus planning

- Tap the net cash-flow card to add an actual entry; tap the blue planned-budget card to open its existing allocations for editing.
- “Create a budget” appears only before a plan exists. “Plan another period” is available inside an existing plan, so future budgets remain possible.
- Planned amounts are explicitly described as estimates. Recorded cash flow remains labelled as recorded activity, not a bank balance.
- The repeated planned-versus-actual category cards and duplicate totals are replaced by the grouped chart. Charts and entries share a horizontal selector; spending insights expand only when requested.
- Entries initially show five records, with more available on demand. Category choices collapse after selection and can be reopened using “Change”.

## Fees and categories

Income and Expense are the main entry tabs. Both include an optional transfer-fee field. Enter the principal amount **without** the fee; income means the amount before any fee deducted. Every attached fee is counted once as an expense, including in net cash flow, category totals and daily charts. Editing or deleting the entry updates its fee with it.

Moving money between one’s own accounts remains available as a checkbox in the Expense flow. Its principal is excluded from both income and spending; its fee is counted as an expense. This preserves existing transfers without a separate Transfer tab or fee-category section.

New income choices: Family & gifts, Work & business, Scholarships & grants, Loans received, Other income.

New expense choices: Food & groceries, Housing & utilities, Transport, Data & airtime, Education, Health & personal care, Recreation, Family support, Debt repayments, Other expenses. Buttons use category-specific icons. Transaction fees are assigned automatically. Existing Savings records and planning allocations remain available; new own-account saving movements use the checkbox instead of being misclassified as spending.

The Home dashboard now includes the same expense donut for the current Lusaka calendar month, with explicit dates, real recorded totals, empty/error states and refresh on screen focus. Borrowing is labelled as loans received, not earnings.

## Database integration

Applied migration: `20261104111019_budget_entry_fees_and_categories.sql` on the connected Supabase project. Local migration history matches the remote version. The private API body checksum matches the tested local SQL: `49327f8bd0829267a3fb703cbdcde3ed`.

The atomic merge remaps system-category references in entries, attached fees, recurring records and budget allocations. Duplicate allocations are summed; edited records receive a new revision to reject stale edits. Custom categories are untouched. Entry amounts, dates, descriptions, ownership and transaction kinds are retained. Legacy standalone “Fees” maps to Education; the distinct “Transaction fees” category remains for payment charges.

Live verification retained all six entries and one plan, and confirmed unchanged principal, fee, planned-income and allocation totals. No live test entries were inserted. Anonymous API access remains denied. Security advisors show only the previous intentionally inaccessible answer-key table and the existing [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this task does not change authentication settings.

## Verification

- Disposable SQL migration tests: merge totals, recurring references, custom-category preservation, revision changes, attached income/expense fees, edit/retry/delete, validation and account isolation passed.
- Existing budget and full learning/security SQL suites passed.
- Browser checks cover card navigation, hidden create action, existing-plan editing, two entry tabs and own-account checkbox, both fee inputs, chart refresh, Home chart totals, narrow layouts and light/dark themes.
- Final TypeScript and ESLint checks passed with zero errors/warnings. Full system and authentication/navigation browser runs passed, including fee entry, Home totals and both themes at 320/390px. Expo web and Android exports passed and their artifacts were verified.
- Local exports: `/tmp/finlit-budget-ux-final-web` and `/tmp/finlit-budget-ux-final-android`. Screenshots: `.expo/system-review/screens/ux-*.png` and `.expo/auth-review/home-budget-chart*.png`.

Physical Android testing has not been performed. No code was committed or pushed and the application was not published; the database migration was applied as part of this change.
