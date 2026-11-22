# NutriMetrics Meal Planner

A foundation for a personal meal planner backed by USDA FoodData Central and SQLite.

## Requirements

- Node.js 20.9 or newer
- npm
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) for food search

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` if you do not already have one. Add `BETTER_AUTH_URL="http://localhost:3000"` and `BETTER_AUTH_SECRET` to your existing `.env` if needed. Generate a unique secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste it into `BETTER_AUTH_SECRET`. Keep it private and stable across restarts. Set `USDA_API_KEY` for food search; never expose it to the browser or commit it.
3. Create or update the local database: `npm run db:migrate`
4. Start the development server: `npm run dev`
5. Open http://localhost:3000.

The SQLite database is stored at `prisma/dev.db` by default. Local databases and environment files are ignored by Git. Run `npm run db:studio` to inspect the database and `npm run build` to check the production build. After building, `npm run test:auth` exercises authentication against a separate temporary database.

## Accounts

You can register, sign in, and sign out using an email address and a password of 12–128 characters. Better Auth stores password hashes and manages database-backed sessions; its session tokens are stored in the database, so protect the database and its backups. The earlier placeholder `User.passwordHash` column is retained for data preservation but is not used by Better Auth. Placeholder users created outside the application cannot sign in without a Better Auth credential account.

This is intended for local development. Email verification, password recovery, and a production-ready deployment are not configured. The authentication rate limiter is process-local and uses a shared counter because this app does not have a trusted client-IP proxy configured. Before public deployment, configure HTTPS, the correct public `BETTER_AUTH_URL`, trusted proxy/IP handling and shared rate-limit storage, as well as email verification and recovery.

## Food search

Sign in and search from your account page to browse USDA FoodData Central results. Expand a result to see the nutrients returned by USDA and follow its USDA link to check details. Values are on a 100-unit basis; branded products may use 100 g or 100 mL, so check the source before comparing values. Some amounts are calculated from label values or less-than values; inspect the USDA derivation where provided. Missing nutrients do not mean zero. Results are not yet saved to the database or added to meal plans. USDA requests are made on the server and are subject to [USDA rate limits](https://fdc.nal.usda.gov/api-guide/). The search tests use a mock USDA response and never use your API key.

## Structure

- `src/app` contains the Next.js App Router UI.
- `src/lib/db.ts` provides a shared Prisma client for server-side code.
- `prisma/schema.prisma` defines the SQLite data model.
- `prisma/migrations` contains database migrations.

Food nutrient amounts are represented per 100 grams. A USDA food can have shared baseline nutrient values, while a user's overrides are stored separately per nutrient. Custom foods are owned by their creator. Meal entries store their quantity in grams, and meal dates are intended to use `YYYY-MM-DD` strings so they do not shift with time zones. Nutrient identifiers and units should be mapped consistently from USDA when the integration is implemented. Future write operations must validate dates, nonnegative nutrient values, and positive portion sizes.

## What's next

Food editing, meal planning, calculations, and charts are **not implemented yet**. Enforce ownership on every future query and mutation, including access to custom foods and overrides. The schema alone does not enforce all cross-record ownership rules. Never store the USDA API key in client-side code.

Nutrition values should be treated as estimates, not medical advice.
