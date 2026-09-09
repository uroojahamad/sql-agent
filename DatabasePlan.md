# Database Plan: Neon Postgres + Prisma ORM

## 1. Objective

Create a small, production-ready database layer for the SQL agent using:

- **Neon** as the managed PostgreSQL provider.
- **Prisma ORM 7** for schema definition, migrations, generated TypeScript types, and application queries.
- Three initial business tables: **categories**, **products**, and **sales**.

The SQL agent will initially be read-oriented: it will use the database to answer catalog and sales questions. Product/catalog administration and sales ingestion can be added through separate, authorized write paths.

Prisma ORM 7 is deliberately pinned in this plan. As of this plan's review date, Prisma 8 is still published as a release candidate on the `latest` tag. All Prisma packages must use the same major version.

## 2. Why Neon

Neon is a good fit for this Next.js application because it provides managed, PostgreSQL-compatible infrastructure without requiring the team to operate database servers.

- **PostgreSQL compatibility:** Prisma uses its normal `postgresql` connector, and the team can still use standard PostgreSQL tools and SQL.
- **Serverless connection pooling:** Neon's pooled endpoint is designed for short-lived and highly concurrent application instances.
- **Autoscaling and scale-to-zero:** Useful during early development and uneven SQL-agent traffic.
- **Database branching:** Development, preview, and production schemas/data can be isolated without modifying the production branch.
- **Backups and restore features:** Neon manages the storage layer and provides recovery tooling.
- **Simple deployment integration:** Connection strings can be configured as server-side environment variables in the hosting platform.

Important trade-offs:

- A compute that has scaled to zero can add cold-start latency to the first request.
- The runtime must use the **pooled** URL, while schema migrations should use the **direct/unpooled** URL.
- Branches are isolated database environments. A migration applied to a development branch does not automatically change production.

## 3. Why Prisma

Prisma provides a controlled database layer between the Next.js application and Neon.

- **Type-safe queries:** The generated Prisma Client catches many field and relation mistakes during development.
- **Schema as code:** Tables, fields, indexes, and relations are defined in a reviewable `schema.prisma` file.
- **Migration history:** Generated SQL migrations are committed with the application and deployed consistently.
- **Developer tooling:** Prisma Studio, schema formatting, validation, introspection, and migration-status commands simplify maintenance.
- **Data-access consistency:** Repositories can expose narrow functions to the SQL agent instead of allowing database calls throughout the application.
- **Safe parameter handling:** Normal Prisma queries and tagged raw queries parameterize values.

Prisma is not, by itself, a security boundary for AI-generated SQL. The agent must not be given an owner connection or unrestricted access to `$queryRawUnsafe`.

## 4. High-level architecture

```text
User question
    |
    v
app/api/chat/route.ts
    |
    v
SQL-agent tool selection and Zod argument validation
    |
    v
database/repositories/* (server-only data-access layer)
    |
    v
Prisma Client + Neon adapter
    |
    v
Neon pooled PostgreSQL endpoint
```

Database schema changes follow a separate path:

```text
schema.prisma -> reviewed migration SQL -> Prisma Migrate -> Neon direct endpoint
```

This separation prevents migrations or privileged credentials from being used during a normal chat request.

## 5. Initial data model

### Relationships

- One **Category** has many **Products**.
- One **Product** belongs to one **Category**.
- One **Product** has many **Sales**.
- Each **Sale** is an immutable sale-line record for one product.

```text
Category 1 ---- * Product 1 ---- * Sale
```

### Design decisions

- UUID primary keys avoid exposing sequential record counts and work well across environments.
- PostgreSQL table and column names use `snake_case`; Prisma model fields use TypeScript-friendly `camelCase`.
- Money uses `Decimal`, never floating point.
- `Sale.unitPrice` and `Sale.currency` are snapshots from the time of sale. Historical revenue remains correct if the current product price changes.
- Revenue is calculated as `quantity * unit_price`. A redundant `total_amount` is intentionally not stored in the first version.
- Timestamps use timezone-aware PostgreSQL values.
- Category or product deletion is restricted when dependent data exists, preserving sales history.
- Sales are append-only in the application. Corrections should later be modeled as explicit adjustments or reversals, not silent edits.

### Proposed Prisma schema

Location: `database/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model Category {
  id          String    @id @default(uuid()) @db.Uuid
  name        String    @unique @db.VarChar(120)
  slug        String    @unique @db.VarChar(140)
  description String?
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  products    Product[]

  @@map("categories")
}

model Product {
  id            String   @id @default(uuid()) @db.Uuid
  categoryId    String   @map("category_id") @db.Uuid
  sku           String   @unique @db.VarChar(80)
  name          String   @db.VarChar(180)
  description   String?
  unitPrice     Decimal  @map("unit_price") @db.Decimal(12, 2)
  currency      String   @default("USD") @db.VarChar(3)
  stockQuantity Int      @default(0) @map("stock_quantity")
  isActive      Boolean  @default(true) @map("is_active")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  category      Category @relation(fields: [categoryId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  sales         Sale[]

  @@index([categoryId])
  @@index([name])
  @@index([isActive])
  @@map("products")
}

model Sale {
  id               String   @id @default(uuid()) @db.Uuid
  productId        String   @map("product_id") @db.Uuid
  orderReference   String?  @map("order_reference") @db.VarChar(100)
  quantity         Int
  unitPrice        Decimal  @map("unit_price") @db.Decimal(12, 2)
  currency         String   @db.VarChar(3)
  soldAt           DateTime @default(now()) @map("sold_at") @db.Timestamptz(6)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  product          Product  @relation(fields: [productId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([soldAt])
  @@index([productId, soldAt])
  @@index([orderReference])
  @@map("sales")
}
```

Before implementation, replace the `USD` default with the business's primary ISO-4217 currency if it is different. Revenue queries must group by currency unless the application guarantees a single currency.

The first migration should also add database-level check constraints for positive values, because Prisma's schema language does not currently express these checks directly:

```sql
ALTER TABLE "products"
  ADD CONSTRAINT "products_unit_price_nonnegative" CHECK ("unit_price" >= 0),
  ADD CONSTRAINT "products_stock_quantity_nonnegative" CHECK ("stock_quantity" >= 0);

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_quantity_positive" CHECK ("quantity" > 0),
  ADD CONSTRAINT "sales_unit_price_nonnegative" CHECK ("unit_price" >= 0);
```

These statements should be added to the generated migration SQL before the migration is applied.

## 6. Folder structure

```text
sql-agent/
├── app/
│   └── api/chat/route.ts
├── database/
│   ├── generated/
│   │   └── prisma/                 # Generated client; do not edit manually
│   ├── prisma/
│   │   ├── migrations/             # Committed, ordered SQL migration history
│   │   ├── schema.prisma           # Models, relations, indexes, and mappings
│   │   └── seed.ts                 # Repeatable development seed data
│   ├── repositories/
│   │   ├── categories.ts           # Category-specific reads/writes
│   │   ├── products.ts             # Product-specific reads/writes
│   │   └── sales.ts                # Sales ingestion and reporting queries
│   ├── client.ts                   # Singleton Prisma Client; server-only
│   ├── query-tools.ts              # Allowlisted tools exposed to the SQL agent
│   └── README.md                   # Database-layer conventions
├── prisma.config.ts                # Root CLI config; points into database/prisma
├── .env.local                      # Local secrets; never committed
└── .env.example                    # Variable names/placeholders; committed
```

`prisma.config.ts` remains at the project root because Prisma CLI discovers it there automatically. All schema, migration, seed, generated client, and runtime data-access code remains under `database/`.

Recommended root configuration:

```ts
import nextEnv from "@next/env";
import { defineConfig } from "prisma/config";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const configuredMigrationUrl =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!configuredMigrationUrl) {
  throw new Error("DIRECT_URL or DATABASE_URL must be configured");
}

const directMigrationUrl = configuredMigrationUrl.replace("-pooler.", ".");

export default defineConfig({
  schema: "database/prisma/schema.prisma",
  migrations: {
    path: "database/prisma/migrations",
    seed: "tsx database/prisma/seed.ts",
  },
  datasource: {
    url: directMigrationUrl,
  },
});
```

The generated client folder may be excluded from Git, but `prisma generate` must then run before TypeScript checking and production builds. Never manually edit generated files.

## 7. Environment configuration

Use two Neon connection strings:

```dotenv
# Pooled Neon URL used by Prisma Client at application runtime.
DATABASE_URL="postgresql://USER:PASSWORD@EP-ENDPOINT-pooler.REGION.aws.neon.tech/sql_agent?sslmode=require"

# Direct Neon URL used only by Prisma CLI for migrations and introspection.
DIRECT_URL="postgresql://USER:PASSWORD@EP-ENDPOINT.REGION.aws.neon.tech/sql_agent?sslmode=require"
```

Rules:

- Never prefix either variable with `NEXT_PUBLIC_`.
- Keep real values in `.env.local` locally and in the deployment platform's encrypted environment settings.
- Commit only `.env.example` with placeholders. The current `.gitignore` ignores `.env*`, so add `!.env.example` when the example file is introduced.
- Use development-branch URLs locally and production-branch URLs only in the production environment.
- Rotate credentials immediately if a connection string is committed or logged.

At runtime, `database/client.ts` will instantiate `PrismaNeon` with `DATABASE_URL`, create one `PrismaClient`, cache it on `globalThis` during development, and export it from a module containing `import "server-only"`.

## 8. Setup and implementation sequence

### Step 1: Confirm prerequisites

- Node.js `20.19.0+` is required for Prisma 7; Node.js 22 LTS is recommended.
- TypeScript `5.4+` is required. This project already uses TypeScript 5.
- Add `"type": "module"` to `package.json` for Prisma 7's ESM packages.
- The existing Next.js 16 App Router and `app/api/chat/route.ts` are compatible with a server-only data-access layer.

### Step 2: Create the Neon project and database

Recommended first-time path:

1. Sign in to the Neon Console and select **New Project**.
2. Name it `sql-agent` and choose the region closest to the application deployment region.
3. Keep separate `development` and `production` branches.
4. Use the automatically created `neondb` database or create a database named `sql_agent` under **Branches -> Roles & Databases -> Add database**.
5. In **Connect**, select the development branch, database, and owner role.
6. Copy both connection strings: pooled for `DATABASE_URL`, direct for `DIRECT_URL`.

Neon creates the hosted database and role. Prisma Migrate creates the three application tables and `_prisma_migrations` inside that database.

### Step 3: Install Prisma and the Neon adapter

```bash
npm install @prisma/client@7 @prisma/adapter-neon@7 @next/env@16.3.0
npm install --save-dev prisma@7 tsx
```

Pin all Prisma packages to version 7 in `package-lock.json`. Do not mix Prisma Client, CLI, and adapter major versions.

### Step 4: Create the database files

1. Add the folder structure from section 6.
2. Add the root `prisma.config.ts`.
3. Add the schema from section 5.
4. Add `.env.local` and `.env.example`.
5. Add the singleton `database/client.ts`.
6. Add seed data with at least two categories, several products, and sales across multiple dates.

### Step 5: Validate and create the initial migration

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name init_catalog_sales --create-only
```

Review `database/prisma/migrations/.../migration.sql`, add the check constraints from section 5, and verify that only the expected tables, foreign keys, and indexes are created. Then apply it to the Neon development branch:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma db seed
```

Prisma 7 requires `generate` and `db seed` to be run explicitly; migration commands no longer run them automatically.

### Step 6: Verify the database

```bash
npx prisma migrate status
npx prisma studio
```

Confirm:

- `categories`, `products`, `sales`, and `_prisma_migrations` exist.
- Foreign-key relationships work.
- Negative prices/stocks and zero/negative sale quantities are rejected.
- Seeded records can be read through Prisma Client.
- A sales revenue query returns `SUM(quantity * unit_price)` grouped by currency.

### Step 7: Connect the SQL agent

1. Keep `app/api/chat/route.ts` as the public HTTP boundary.
2. Define narrow agent tools such as `findProducts`, `getSalesSummary`, `getTopProducts`, and `getCategoryPerformance`.
3. Validate every tool input with Zod.
4. Implement tools through `database/repositories/`; do not query Prisma directly from UI components.
5. Select only fields needed for the answer and cap result sizes.
6. Return database results to the model as structured data, then let the model explain them.
7. Add authentication, authorization, rate limiting, audit logging, and query timeouts before production access.

### Step 8: Deploy safely

1. Commit `schema.prisma`, migration SQL, seed code, config, and `.env.example`.
2. Do not commit `.env` or production credentials.
3. Configure production `DATABASE_URL` and `DIRECT_URL` in the deployment platform.
4. Run `npx prisma migrate deploy` once in CI/release automation before the new application version is promoted.
5. Run `npx prisma generate` during the build.
6. Never run `migrate dev`, `db push`, or `migrate reset` against production.

## 9. Recommended package scripts

Add these scripts during implementation so the team uses consistent commands:

```json
{
  "scripts": {
    "db:format": "prisma format",
    "db:validate": "prisma validate",
    "db:generate": "prisma generate",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:migrate:status": "prisma migrate status",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

The production build pipeline must run `npm run db:generate` before `next build` if `database/generated/prisma` is not committed.

## 10. Command reference

### Prisma commands

| Command | Purpose | Where to use |
| --- | --- | --- |
| `npx prisma format` | Formats the Prisma schema consistently. | Local/CI |
| `npx prisma validate` | Validates schema syntax and configuration. | Local/CI |
| `npx prisma generate` | Generates the typed Prisma Client into `database/generated/prisma`. | Local/build |
| `npx prisma migrate dev --name <name>` | Creates and applies a development migration and detects drift. | Development branch only |
| `npx prisma migrate dev --name <name> --create-only` | Generates migration SQL without applying it, allowing review/custom checks. | Development branch only |
| `npx prisma migrate deploy` | Applies already committed pending migrations without generating new ones. | Staging/production CI |
| `npx prisma migrate status` | Reports whether database and migration history are in sync. | All environments |
| `npx prisma migrate diff` | Displays schema differences for diagnostics or migration review. | Local/CI |
| `npx prisma db seed` | Explicitly runs `database/prisma/seed.ts`. | Development/test; controlled staging |
| `npx prisma studio` | Opens a local data browser/editor. | Development only |
| `npx prisma db pull` | Introspects an existing database into the Prisma schema. Review the resulting changes. | Existing/externally changed DB |
| `npx prisma db push` | Pushes schema without creating migration history. | Throwaway prototyping only |
| `npx prisma migrate reset` | Drops/recreates the development schema and reapplies migrations; destroys data. | Disposable development DB only |
| `npx prisma version` | Shows CLI, Client, platform, and engine versions. | Troubleshooting |

### Neon commands

The current Neon CLI command is `neon`; `neonctl` remains an alias for older installations.

| Command | Purpose |
| --- | --- |
| `npm install --global neon@latest` | Installs or updates the optional Neon CLI. |
| `neon auth` | Authenticates the local CLI with Neon. |
| `neon projects create --name sql-agent` | Creates a Neon project, default branch, database, role, and compute. |
| `neon link` | Associates the current repository with an existing Neon project. |
| `neon checkout development` | Selects or creates the development database branch and pulls its environment configuration. |
| `neon env pull --service postgres` | Refreshes branch-specific PostgreSQL environment variables. Verify/map the pulled unpooled URL to `DIRECT_URL`. |
| `neon status` | Shows the Neon project/branch currently linked to the repository. |
| `neon psql` | Opens a SQL shell against the linked branch for inspection. |
| `neon diff production` | Shows a schema diff between the active branch and production before merging. |
| `neon inspect db unused-indexes` | Performs a read-only diagnostic for unused indexes after representative production traffic exists. |

The Neon Console is sufficient for initial setup; installing the Neon CLI is optional.

## 11. SQL-agent security requirements

The safest first version uses allowlisted Prisma repository functions rather than arbitrary model-generated SQL.

- Keep Prisma and connection strings in `server-only` modules.
- Never send `DATABASE_URL`, `DIRECT_URL`, Prisma Client, or raw database errors to the browser/model.
- Validate agent tool arguments and enforce maximum date ranges, page sizes, and row counts.
- Use explicit Prisma `select` clauses and return minimal DTOs.
- Parameterize all values. Do not concatenate user text into SQL.
- Do not expose `$executeRawUnsafe` or `$queryRawUnsafe` to the agent.
- Use a dedicated read-only Neon role for SQL-agent reporting in production. Keep the owner/migration role separate.
- If unrestricted natural-language-to-SQL is later required, add a PostgreSQL/SQL AST validator, allow only one `SELECT`, allowlist the three tables/views, reject DDL/DML and multiple statements, enforce `LIMIT` and timeouts, and execute through the read-only role.
- Log the authenticated user, selected tool/query identifier, duration, and row count without logging credentials or sensitive query parameters.

## 12. Migration and branching policy

- Each schema change starts on a Neon development or feature branch.
- Generate migration SQL with `migrate dev --create-only` and review it before applying.
- Commit migration directories; never edit a migration that has already reached a shared environment.
- Run `migrate deploy` in staging/production through one release job, not from every application instance.
- Test destructive or high-risk migrations on a Neon branch cloned from production first.
- Take a Neon snapshot or verify the restore point before a high-risk production migration.
- Seed scripts are for deterministic reference/development data, not uncontrolled production fixtures.

## 13. Definition of done

The database foundation is complete when:

- Neon development and production branches exist in the correct region.
- Runtime pooled and migration direct URLs are stored securely in each environment.
- Prisma packages are pinned to the same v7 major and the client generates successfully.
- The reviewed initial migration creates the three business tables, constraints, indexes, relations, and `_prisma_migrations`.
- Seed data loads explicitly and representative sales queries return correct decimal results.
- `prisma validate`, `prisma migrate status`, lint, type-check, and the Next.js production build pass.
- The chat route can call an allowlisted, server-only repository tool and return a bounded result.
- The agent cannot perform writes, DDL, multi-statement SQL, or access migration credentials.
- Production deployment uses `prisma migrate deploy`, never development migration commands.

## 14. Official references

- [Prisma: PostgreSQL connector and Neon adapter](https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql)
- [Prisma: Neon integration](https://www.prisma.io/docs/orm/overview/databases/neon)
- [Prisma ORM 7 upgrade and requirements](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [Prisma Migrate commands](https://www.prisma.io/docs/cli/migrate)
- [Prisma seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [Neon: Manage projects](https://neon.com/docs/manage/projects)
- [Neon: Manage databases](https://neon.com/docs/manage/databases)
- [Neon: Connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon: Prisma migrations](https://neon.com/docs/guides/prisma-migrations)
- [Next.js 16 local guide: Route Handlers](node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md)
- [Next.js 16 local guide: Environment variables](node_modules/next/dist/docs/01-app/02-guides/environment-variables.md)
- [Next.js 16 local guide: Data security](node_modules/next/dist/docs/01-app/02-guides/data-security.md)
