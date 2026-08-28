# Database — Prisma + PostgreSQL

The Prisma schema in [schema.prisma](./schema.prisma) is the **single source of truth** for the database. SQL migrations are generated from it and stored in `prisma/migrations/`.

## Folder structure

```
prisma/
├── schema.prisma          # Single source of truth (models + enums)
├── seed.ts                # Idempotent seed — run via `npm run db:seed`
├── migrations/            # Auto-generated SQL migrations (committed to git)
│   └── <timestamp>_init/
│       └── migration.sql
└── README.md              # This file
```

The Prisma client is consumed in app code via the singleton at [src/lib/db/prisma.ts](../src/lib/db/prisma.ts):

```ts
import { prisma } from '@/lib/db';
const products = await prisma.product.findMany({ take: 12 });
```

## Workflows

### Local development

```bash
# 1. Start a local Postgres (Docker example):
docker run -d --name elviora-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=elviora \
  -p 5432:5432 postgres:16

# 2. Run the first migration (creates schema + records it):
npm run db:migrate -- --name init

# 3. Seed:
npm run db:seed

# 4. Inspect with Prisma Studio:
npm run db:studio
```

### Local development from a production dump

Use this when you need real catalogue/order shape locally without pointing the
running app at production.

```bash
# 1. Keep the app pointed at local Postgres:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kitchenly?schema=public

# 2. Put the production source URL in ignored .env.prod.
#    Prefer a direct/session-pooler URL over a transaction-pooler URL:
PROD_DATABASE_URL=postgresql://...

# 3. Pull a dump and restore it into the local database:
npm run db:pull:prod
```

The restore helper refuses to write to a non-local target unless you explicitly
set `ALLOW_NON_LOCAL_RESTORE_TARGET=1`. Dumps are saved under `tmp/db-dumps/`,
which is ignored by git.

Only the Prisma-owned `public` schema is dumped. Supabase-managed schemas such
as `auth`, `storage`, and `vault` are intentionally skipped because local
Postgres usually does not have those platform extensions installed.
During restore, the helper prepares local `pgcrypto` and `pg_trgm` extensions
and skips Supabase's `CREATE SCHEMA public` archive entry, which conflicts with
the default schema that local Postgres creates automatically.

The app also refuses to boot in local development when `DATABASE_URL` points to
a non-local host. That keeps day-to-day dev from reading or mutating production
by accident. The escape hatch is `ALLOW_NON_LOCAL_DEV_DATABASE=1`, but the
preferred flow is to restore production into local Postgres first.

After any change to `schema.prisma`:

```bash
npm run db:migrate -- --name describe_your_change
```

This generates a new migration file under `prisma/migrations/`, applies it to your local DB, and regenerates the client.

### Production

Migrations are applied **automatically** on `npm start`:

```jsonc
// package.json
"start": "prisma migrate deploy && next start"
```

- `prisma migrate deploy` — non-interactive; applies any pending migrations in `prisma/migrations/` in order. Safe to run on every boot (no-op when nothing pending).
- `prisma generate` runs automatically via `postinstall`, so the typed client is regenerated whenever dependencies install (Vercel, Docker builds, etc).

### Reset (DESTRUCTIVE — dev only)

```bash
npm run db:reset
```

Drops and recreates the database, re-applies all migrations, then re-runs the seed. Never run this against staging or production.

## All scripts

| Script        | What it does                                         |
| ------------- | ---------------------------------------------------- |
| `db:migrate`  | `prisma migrate dev` — interactive, dev only         |
| `db:deploy`   | `prisma migrate deploy` — non-interactive, prod-safe |
| `db:reset`    | Drop, re-create, re-apply, re-seed (destructive)     |
| `db:seed`     | Run `prisma/seed.ts`                                 |
| `db:studio`   | Launch the Prisma Studio GUI                         |
| `db:format`   | Format `schema.prisma`                               |
| `db:validate` | Validate `schema.prisma` against the DB engine       |
| `db:generate` | Regenerate the typed client                          |
| `db:push`     | Sync schema without a migration (prototyping only)   |

## Conventions encoded in the schema

- **Snake-case columns** via `@map` / `@@map`.
- **UUID primary keys**, generated DB-side with `gen_random_uuid()` (Postgres 13+).
- **TIMESTAMPTZ** for every timestamp.
- **Decimal(12, 2)** for money.
- **Explicit FK indexes** — Postgres does not index foreign keys automatically.
- **Snapshot fields** on `order_items` (`product_name`, `unit_price`) so orders remain immutable when the catalog changes.
- **Append-only ledgers** for `loyalty_points`, `order_status_history`, `coupon_usages`, and analytics logs.
- **Composite indexes** on hot read paths (`orders.user_id, created_at`, `notifications.user_id, is_read, created_at`, etc).
- **Partial uniques** (e.g. one default address per user) enforced at the DB layer.

## Future migrations to consider

Add as separate migrations once usage data justifies them:

- **`pg_trgm` extension** + GIN index on `products.name` for fuzzy search.
- **Range partitioning** on `product_view_logs` and `search_logs` by month.
- **Materialized view** for `product_aggregate_ratings` (rating average + count per product).
- **Row-level security** if multi-tenant storefronts are introduced.
