# NutriMetrics Meal Planner

A foundation for a personal meal planner backed by USDA FoodData Central and SQLite.

## Requirements

- Node.js 20.9 or newer
- npm
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/) for future food search

## Getting started

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env`. Set `USDA_API_KEY` when implementing USDA integration; never expose it to the browser or commit it.
3. Create the local database: `npm run db:migrate`
4. Start the development server: `npm run dev`
5. Open http://localhost:3000.

The SQLite database is stored at `prisma/dev.db` by default. Local databases and environment files are ignored by Git. Run `npm run db:studio` to inspect the database and `npm run build` to check the production build.

## Structure

- `src/app` contains the Next.js App Router UI.
- `src/lib/db.ts` provides a shared Prisma client for server-side code.
- `prisma/schema.prisma` defines the SQLite data model.
- `prisma/migrations` contains database migrations.

Food nutrient amounts are represented per 100 grams. A USDA food can have shared baseline nutrient values, while a user's overrides are stored separately per nutrient. Custom foods are owned by their creator. Meal entries store their quantity in grams, and meal dates are intended to use `YYYY-MM-DD` strings so they do not shift with time zones. Nutrient identifiers and units should be mapped consistently from USDA when the integration is implemented. Future write operations must validate dates, nonnegative nutrient values, and positive portion sizes.

## What's next

This is a foundation, not a finished application. Authentication, USDA API requests, food editing, meal planning, calculations, and charts are **not implemented yet**. Before adding user-facing operations, implement authentication and enforce ownership on every query and mutation, including access to custom foods and overrides. The schema alone does not enforce all cross-record ownership rules. Store only hashed passwords and session tokens; never store the USDA API key in client-side code.

Nutrition values should be treated as estimates, not medical advice.
