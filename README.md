# Finlit

Financial learning and personal budgeting for Zambian university students, built with Expo SDK 54, React Native and Supabase.

The app includes six modules, 24 lessons, an 18-question initial assessment, personalised priorities, a distinct 18-question final assessment, preserved baseline comparison and an independent Budget Tracker. **All eight live migrations have local copies; the assessment migration was applied on 3 November 2026.** See the [assessment implementation report](docs/knowledge-assessment-system.md) for the complete workflow, verification and device/research limitations. The [earlier implementation report](docs/implementation-status.md) documents the curriculum and Budget Tracker.

## Run locally

Use Node 22+ and install the locked dependencies with `npm ci`. Configure the existing public Supabase URL and publishable-key environment variables, then run `npm start`. Never put a service-role key in the app.

Account-linked learning and budgeting require the restored project and reviewed migrations. The app shows connection errors when that backend is unavailable; it does not substitute fictional learner records.

## Verification

See [the report](docs/implementation-status.md#repeat-checks) for TypeScript, ESLint, unit, disposable-Postgres and browser checks. Browser fixtures do not change real accounts or send emails.

## Documentation

- [Current implementation and acceptance report](docs/implementation-status.md)
- [Authentication implementation](docs/prototype-auth.md)
- [Earlier lesson implementation history](docs/learning-experience.md)
- [Loan calculator removal](docs/loan-calculator-removal.md)
