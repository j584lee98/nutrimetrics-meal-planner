# NutriMetrics Meal Planner

A foundation for a personal meal planner backed by USDA FoodData Central and SQLite.

## Requirements

- Node.js 20.9 or newer
- npm
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) for food search

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` if you do not already have one. Add `BETTER_AUTH_URL="http://localhost:3000"` and `BETTER_AUTH_SECRET` to your existing `.env` if needed. Generate a unique secret with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and paste it into `BETTER_AUTH_SECRET`. Keep it private and stable across restarts. Set `USDA_API_KEY` for food search; never expose it to the browser or commit it.
3. Back up any existing database, then create or update it: `npm run db:migrate`. The meal-builder migration removes meal dates. It preserves meals and gram quantities, but requires meal names to be unique per user across plans. Rename duplicate existing meals before migrating, including names equivalent after Unicode NFKC normalization and lowercase conversion. SQLite cannot detect all such Unicode duplicates during migration.
4. Start the development server: `npm run dev`
5. Open http://localhost:3000.

The SQLite database is stored at `prisma/dev.db` by default. Local databases and environment files are ignored by Git. Run `npm run db:studio` to inspect the database and `npm run build` to check the production build. After building, `npm run test:auth` exercises authentication, food search, and meal plans against a separate temporary database.

## Accounts

You can register, sign in, and sign out using an email address and a password of 12–128 characters. Better Auth stores password hashes and manages database-backed sessions; its session tokens are stored in the database, so protect the database and its backups. The earlier placeholder `User.passwordHash` column is retained for data preservation but is not used by Better Auth. Placeholder users created outside the application cannot sign in without a Better Auth credential account.

This is intended for local development. Email verification, password recovery, and a production-ready deployment are not configured. The authentication rate limiter is process-local and uses a shared counter because this app does not have a trusted client-IP proxy configured. Before public deployment, configure HTTPS, the correct public `BETTER_AUTH_URL`, trusted proxy/IP handling and shared rate-limit storage, as well as email verification and recovery.

## Food search

Sign in and select **Lookup** in the navigation to browse USDA FoodData Central results. Expand a result to see the nutrients returned by USDA and follow its USDA link to check details. Values are on a 100-unit basis; branded products may use 100 g or 100 mL, so check the source before comparing values. Some amounts are calculated from label values or less-than values; inspect the USDA derivation where provided. Missing nutrients do not mean zero. USDA requests are made on the server and are subject to [USDA rate limits](https://fdc.nal.usda.gov/api-guide/). Tests use a mock USDA response and never use your API key.

## Meal plans

On the **Meals** page, create and edit meals in your meal library. Give each meal a unique name, search for foods using space-separated words, and select results to add them. Choose nutrient columns and adjust quantities using grams, milliliters, available USDA portions, or a custom unit with its equivalent in the food's nutrient basis. When the basis is unknown, check the USDA details and choose 100 g or 100 mL before saving. Meals have no dates.

On the **Plans** page, create or edit a plan in the plan builder, adding at least one meal from your library. Both lists show calories, carbs, protein, and fat; the plan builder also shows nutrients for each meal and plan totals, with configurable columns. If you create a meal in the new tab while building a plan, refresh the meal list in the builder. Meals are reusable: editing one changes every plan containing it. Remove a meal from every plan before deleting it. Deleting a plan leaves its meals in the library. Existing empty plans are preserved but need at least one meal to be saved again. Totals marked partial exclude unavailable values; a dash means no value was available.

Plans and meals are private to the signed-in user and saved in SQLite. Imported USDA foods are shared snapshots and are not automatically refreshed. `BETTER_AUTH_URL` must match the browser's app origin for changes to be accepted.

## Structure

- `src/app` contains the Next.js App Router UI.
- `src/lib/db.ts` provides a shared Prisma client for server-side code.
- `prisma/schema.prisma` defines the SQLite data model.
- `prisma/migrations` contains database migrations.

Food nutrient amounts are represented per 100 g or 100 mL, or with an unknown basis that must be confirmed. Entries store a quantity and a conversion to that basis. Custom foods and nutrient overrides have schema support but no editing interface yet.

## What's next

Food editing, custom food creation, daily totals, and charts are **not implemented yet**. Enforce ownership on every future query and mutation, including access to custom foods and overrides. The schema alone does not enforce all cross-record ownership rules. Never store the USDA API key in client-side code.

Nutrition values should be treated as estimates, not medical advice.
