# NutriMetrics Meal Planner

## Requirements

- Node.js 20.9 or newer and npm
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-key-signup/)

## Technology

- Next.js, React, and TypeScript
- Prisma and SQLite
- Better Auth
- USDA FoodData Central API

Dependencies are installed from `package-lock.json`.

## Installation

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure the variables below.
3. Create or update the database: `npm run db:migrate`
4. Start the development server: `npm run dev`
5. Open http://localhost:3000.

## Environment variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | SQLite URL; `file:./dev.db` uses `prisma/dev.db`. |
| `USDA_API_KEY` | USDA FoodData Central API key. |
| `BETTER_AUTH_URL` | App origin; defaults to `http://localhost:3000` in `.env.example`. |
| `BETTER_AUTH_SECRET` | Stable, private random secret of at least 32 characters. |

Generate a secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Keep `.env`, the database, and its backups private. `BETTER_AUTH_URL` must match the browser's app origin.

## Database migrations

Back up existing databases before migrating. The earlier meal-builder migration removes meal dates and requires unique meal names per user; rename duplicate names, including Unicode-equivalent names, before migrating.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Create a production build. |
| `npm run start` | Start the production build. |
| `npm run typecheck` | Check TypeScript. |
| `npm run test:auth` | Run integration tests after building, using a temporary database and mock USDA data. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate` | Run development migrations. |
| `npm run db:studio` | Open Prisma Studio. |

## Deployment

The current configuration is intended for local development. Before public deployment, configure HTTPS, trusted proxy/IP handling, shared rate-limit storage, email verification, and password recovery.
