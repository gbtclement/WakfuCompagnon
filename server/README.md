# wakfu-companion-server

Backend API for Wakfu Companion accounts, friends, and job level tracking.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (a Supabase Postgres connection
   string) and `JWT_SECRET` (a long random string).
3. `npm run migrate` — applies `migrations/*.sql` to the target database.
4. `npm run build && npm start` — or `npm run dev` for a TypeScript watch build alongside
   `node dist/index.js` run manually.

## Testing

`npm test` runs the full suite against the database in `DATABASE_URL` — point it at a disposable
test database, not production, since tests truncate all tables between runs.

## Deployment

Deploy to any Node-capable free-tier host (e.g. Fly.io). Set `DATABASE_URL` and `JWT_SECRET` as
environment variables on the host — never commit them. Run `npm run migrate` once against the
production database before first deploy, and again after pulling any new migration file.
