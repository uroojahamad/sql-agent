# Project Architecture

## 1. Purpose

This document defines the architecture of the SQL Agent application and the rules that future implementation should preserve.

The application is designed as a serverless-friendly modular monolith using:

- Next.js App Router for pages and server endpoints.
- React Server and Client Components for hybrid rendering.
- AI SDK and Gemini for streamed model responses and tool orchestration.
- Prisma ORM as the typed data-access interface.
- Neon PostgreSQL as the managed database.
- Allowlisted database tools for safe SQL-agent access.

## 2. Architecture summary

| Area | Project approach |
| --- | --- |
| Application architecture | Serverless-friendly modular monolith |
| Internal organization | Layered architecture with explicit module boundaries |
| API approach | Next.js Route Handler acting as a Backend for Frontend |
| Database access | Server-only Data Access Layer and Repository pattern |
| AI database access | Validated Tool/Command pattern with allowlisted operations |
| Infrastructure integration | Prisma/Neon Adapter pattern |
| Database client lifecycle | Development-safe Singleton pattern |
| Data transfer | Minimal, serializable DTOs |
| Rendering | Hybrid SSG, client hydration, React Server Components, dynamic SSR, and streaming |
| Scaling strategy | Scale the modular monolith first; extract services only for measured requirements |

## 3. System context

```text
Browser
   |
   | HTTPS
   v
Next.js application
   |-- Pages and components
   |-- /api/chat Route Handler
   |-- AI tool orchestration
   |-- Server-only data-access layer
   |
   |---------------------> Gemini API
   |
   |---------------------> Neon PostgreSQL
```

Gemini and Neon are managed external services. Their use does not make this application a microservice architecture because they are not independently developed and deployed services owned by this project.

## 4. Application architecture: modular monolith

The application is a modular monolith.

All application capabilities are maintained in one codebase and deployed as one Next.js application:

- Chat interface.
- Chat API endpoint.
- AI orchestration.
- Database tool definitions.
- Business input validation.
- Database repositories.
- Prisma configuration and migrations.
- Temporary database viewer.

The application remains modular because each responsibility is placed behind an explicit code boundary.

```text
sql-agent/
├── app/                    # Pages, layouts, and HTTP Route Handlers
├── components/             # Reusable presentation components
├── database/
│   ├── prisma/             # Schema, migrations, and seed data
│   ├── repositories/       # Bounded database operations
│   ├── client.ts           # Prisma/Neon infrastructure client
│   ├── query-tools.ts      # Validated application operations
│   └── ai-tools.ts         # Allowlisted AI SDK tool definitions
├── prisma.config.ts        # Prisma CLI configuration
└── html-pages/             # Static UI references
```

Serverless hosting may execute individual Next.js routes in separate runtime instances, but the application is still architecturally a modular monolith because it has one application boundary and one coordinated deployment.

## 5. Why this architecture

This architecture provides the appropriate balance of delivery speed, maintainability, performance, and operational simplicity for the current product.

### The product is still one cohesive domain

Category lookup, product search, sales reporting, AI orchestration, and chat responses are closely related. Splitting them into network services would create distributed coordination without establishing useful business boundaries.

### The current team does not need independent service ownership

Microservices are most valuable when separate teams must independently own, deploy, and scale distinct domains. This project currently benefits more from one repository, one release process, and consistent types.

### Internal modules provide separation without distributed-system cost

The repository, tool, and API boundaries allow components to evolve independently inside the application. We receive many maintainability benefits associated with services without introducing network calls between our own modules.

### It matches Next.js deployment behavior

Next.js supports static pages, dynamic server rendering, server endpoints, and serverless execution in one application. A modular monolith uses these capabilities directly rather than adding separate backend services prematurely.

### It keeps database access secure and simple

Prisma and database credentials remain in server-only modules. There is no need to expose a separate database service over another internal HTTP API.

### It is easier to test and operate

The project has:

- One dependency graph.
- One application deployment.
- One set of environment variables.
- One migration workflow.
- Fewer network failure modes.
- No distributed tracing or service discovery requirement.

### It still provides a path to future scaling

Explicit module boundaries allow a capability to be extracted later if production evidence justifies it. Starting as a modular monolith does not prevent future service separation.

## 6. Layered architecture

The application follows a layered structure.

```text
Presentation layer
    app/page.tsx
    app/database/page.tsx
    components/*

HTTP and orchestration layer
    app/api/chat/route.ts

AI tool layer
    database/ai-tools.ts
    database/query-tools.ts

Data Access Layer
    database/repositories/*

Infrastructure layer
    database/client.ts
    Prisma Client
    PrismaNeon adapter
    Neon PostgreSQL
```

### Dependency direction

Dependencies flow toward the database infrastructure through controlled layers:

```text
UI -> Route Handler -> AI tools -> Query tools -> Repositories -> Prisma -> Neon
```

The reverse direction is not allowed. For example:

- Repositories must not import UI components.
- Prisma must not be imported into Client Components.
- The chat route must not duplicate repository queries.
- The model must not receive the database client or credentials.

## 7. Design patterns

### Repository pattern

The files in `database/repositories/` own database query behavior.

Responsibilities include:

- Selecting required columns.
- Applying limits and filters.
- Loading required relations.
- Performing reviewed aggregate queries.
- Returning predictable results to the application layer.

The chat route and UI should not contain Prisma queries.

### Data Access Layer pattern

The database directory acts as a server-only Data Access Layer.

It provides:

- One location for database access rules.
- A boundary for secrets and privileged code.
- Consistent authorization points when authentication is introduced.
- Minimal data transfer to the UI and model.
- Easier repository and integration testing.

### Adapter pattern

`PrismaNeon` adapts the Neon PostgreSQL driver to Prisma Client.

```text
Application -> Prisma Client -> PrismaNeon -> Neon PostgreSQL
```

The rest of the application uses the Prisma interface instead of depending directly on Neon-specific query APIs.

### Singleton pattern

`database/client.ts` reuses a Prisma Client through `globalThis` during local development.

This prevents Next.js hot reloads from repeatedly constructing clients and connection pools. Production runtime instances can create their own client while Neon's pooled endpoint manages database concurrency.

### Backend-for-Frontend pattern

`app/api/chat/route.ts` is an HTTP backend designed specifically for the chat frontend.

It is responsible for:

- Validating request payloads.
- Supplying the SQL-agent system prompt.
- Registering database tools.
- Orchestrating model/tool steps.
- Streaming UI-compatible responses.
- Returning safe errors.

### Tool/Command pattern

Each AI tool represents a bounded command or query, such as:

- `listCategories`
- `findProducts`
- `listSales`
- `getSalesSummary`
- `getTopProducts`
- `getCategoryPerformance`

The model selects a known tool and supplies validated arguments. It does not receive permission to construct and execute unrestricted SQL.

### DTO pattern

Data crossing from server modules to the model or browser must use minimal, serializable Data Transfer Objects.

Examples:

- Convert Prisma `Decimal` values to decimal strings.
- Convert `Date` values to ISO strings.
- Exclude internal fields that are not required for the answer.
- Avoid returning raw Prisma models to Client Components.

## 8. Request and data flows

### Chat request

```text
1. User submits a message in the browser.
2. The client sends UI messages to POST /api/chat.
3. The Route Handler validates and converts the messages.
4. Gemini decides whether a database tool is required.
5. Zod validates the selected tool arguments.
6. The tool calls an application query function.
7. The query function calls a repository.
8. Prisma queries Neon through the pooled connection.
9. A structured result is returned to Gemini.
10. Gemini produces a grounded explanation.
11. The response streams back to the browser.
```

### Database viewer request

```text
1. Browser requests /database?tab=sales.
2. The Server Component validates the tab.
3. The page calls the sales repository directly.
4. Prisma queries Neon.
5. The page maps records to serializable table rows.
6. Next.js renders and returns the result.
```

The Server Component does not call an internal API route because that would introduce an unnecessary HTTP round trip.

### Migration flow

```text
schema.prisma
    -> reviewed migration SQL
    -> Prisma Migrate
    -> Neon direct connection
```

Runtime queries use the pooled Neon connection. Migrations use the direct connection.

## 9. Rendering architecture

The project uses hybrid rendering rather than selecting one rendering method for every page.

### Chat page

The chat page uses a statically prerendered shell with client hydration.

The component requires client-side behavior for:

- React state.
- Form events.
- The `useChat` hook.
- Incremental message updates.

Request flow:

```text
Build produces initial page HTML
    -> browser receives HTML
    -> React hydrates the chat component
    -> conversation runs interactively in the browser
```

This is not pure client-side rendering because Next.js can still prerender the initial HTML.

### Chat response

The chat Route Handler performs dynamic server-side work and streams response events.

Streaming improves perceived performance because the user can see progress and generated text without waiting for the full model response.

### Database viewer

The `/database` route uses dynamic server rendering with React Server Components.

This is appropriate because:

- Data comes from Neon.
- Records can change independently of application builds.
- Prisma and credentials must remain on the server.
- The route uses request search parameters for tabs.

### Static generation

Static generation is appropriate for:

- The initial chat shell.
- Documentation.
- Marketing pages.
- Help content that changes only at deployment time.

It should not be used for live sales, inventory, or revenue data that must reflect the current database.

### Rendering decision table

| Application area | Rendering approach | Reason |
| --- | --- | --- |
| Chat page shell | Static prerendering | Fast initial response |
| Interactive chat | Client Component/hydration | Requires state and event handlers |
| Model answer | Streaming server response | Reduces perceived AI latency |
| Database viewer | Dynamic SSR with Server Components | Requires current server-only data |
| Database tools | Server execution | Protects credentials and business rules |
| Documentation/static help | SSG | Content changes infrequently |

## 10. Performance architecture

### Keep the client bundle small

Only components requiring state, event handlers, hooks, or browser APIs should use `"use client"`.

Pages and data-fetching components should remain Server Components where possible. Database packages must never enter the browser dependency graph.

### Fetch data near the source

Server Components should call repositories directly:

```text
Server Component -> Repository -> Prisma -> Neon
```

Avoid:

```text
Server Component -> Internal API Route -> Repository -> Prisma -> Neon
```

The second approach adds serialization and an unnecessary server-to-server HTTP request.

### Stream AI responses

AI model latency will usually be greater than ordinary database-query latency. Streaming should remain enabled so users receive visible progress immediately.

### Use selective caching

Caching must match the freshness requirement of each data type.

| Data | Starting policy |
| --- | --- |
| Categories | Cache for several minutes when production traffic justifies it |
| Product metadata | Short cache with invalidation after changes |
| Product inventory | Dynamic or very short cache |
| Recent sales | Dynamic |
| Revenue reports | Dynamic initially; consider a short cache after measuring traffic |
| Complete conversations | Do not cache globally |
| Tool descriptions/system prompt | Reuse in application memory where supported |

Caching should be added after observing query frequency and freshness requirements. Returning stale business data is worse than avoiding a small optimization.

### Optimize database operations

- Use Neon's pooled connection for runtime queries.
- Deploy the application near the Neon region.
- Select only required fields.
- Enforce maximum result sizes.
- Add cursor pagination as tables grow.
- Perform filtering, sorting, and aggregation in PostgreSQL.
- Avoid N+1 query patterns.
- Monitor slow queries and query plans.
- Add or remove indexes based on measured query patterns.

Current indexes support the initial access patterns:

- Products by category.
- Products by active status.
- Products by name.
- Sales by date.
- Sales by product and date.
- Sales by order reference.

### Optimize AI operations

- Give the model focused tool descriptions.
- Register only tools relevant to the SQL-agent domain.
- Return compact structured results.
- Do not include the complete database schema in every request.
- Limit model/tool iteration steps.
- Use a fast model for routine lookup and aggregation questions.
- Run independent tool calls concurrently only when both results are required.
- Measure model time and database time separately.

### Manage cold starts

- Reuse Prisma Client within each runtime instance.
- Use the pooled Neon endpoint.
- Keep the deployment and database regions close.
- Measure Neon scale-to-zero latency before changing compute settings.
- Keep compute always active only when the production latency requirement justifies the additional cost.

## 11. Security architecture

### Server-only database boundary

- Database credentials must never use a `NEXT_PUBLIC_` prefix.
- Prisma imports belong only in server-side modules.
- Client Components receive safe DTOs rather than raw database records.
- Raw database errors must not be returned to the browser or model.

### Controlled AI access

- The model can use only allowlisted tools.
- Zod validates every tool input.
- Limits and date ranges are bounded.
- Tool functions call reviewed repositories.
- `$queryRawUnsafe` and `$executeRawUnsafe` must not be exposed.
- Tagged raw queries may be used only in reviewed repository functions with parameterized values.

### Production controls

Before public access, add:

- Authentication.
- Authorization.
- A dedicated read-only Neon role for SQL-agent tools.
- Rate limiting on the chat endpoint.
- Query and statement timeouts.
- Audit logging without credentials or sensitive data.
- Safe provider/database error mapping.

## 12. Deployment architecture

The application should remain one deployable Next.js unit.

Production deployment must:

1. Install locked dependencies.
2. Run Prisma Client generation.
3. Validate the Prisma schema.
4. Apply committed migrations through `prisma migrate deploy` in one release job.
5. Build the Next.js application.
6. Deploy with server-side model and database environment variables.

Do not run development migration commands from application instances.

Environment responsibilities:

| Variable | Usage |
| --- | --- |
| `DATABASE_URL` | Pooled runtime application queries |
| `DIRECT_URL` | Prisma migrations and schema operations |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Server-side Gemini access |

## 13. Scalability and evolution

The first scaling strategy is to scale individual runtime resources while preserving the modular monolith:

- Increase serverless concurrency.
- Tune Neon compute and pooling.
- Add caching for measured read hotspots.
- Add pagination and database indexes.
- Move slow background work to a queue/worker when needed.

Consider extracting a service only when there is a measured reason, such as:

- Sales ingestion requires independent availability and scaling.
- Long-running AI operations require durable queues and workers.
- Analytics workloads move to a dedicated warehouse.
- Multiple products require a shared SQL-agent platform API.
- Separate teams need independent ownership and release cycles.
- A capability requires a different security or compliance boundary.

Possible future extraction:

```text
Next.js application
   |-- Chat and presentation
   |-- SQL-agent orchestration API
   |-- Background job queue (only if required)
   |-- Analytics service/warehouse (only if required)
```

Services must not be introduced only to make the architecture appear more sophisticated. Each extraction must solve a documented scaling, ownership, reliability, or security problem.

## 14. Architecture rules

Future work must preserve these rules:

1. Database access remains server-only.
2. UI components do not contain Prisma queries.
3. Server Components call repositories directly instead of internal HTTP APIs.
4. The chat route orchestrates tools but does not duplicate database logic.
5. AI tools expose business operations, not unrestricted SQL execution.
6. All untrusted inputs are validated at the execution boundary.
7. Database results crossing boundaries use minimal serializable DTOs.
8. Runtime queries use the pooled URL; migrations use the direct URL.
9. Rendering strategies are selected per route based on interactivity and data freshness.
10. Caching is introduced selectively with an explicit freshness policy.
11. New services require a measured and documented reason.
12. Performance decisions are based on observability rather than assumptions.

## 15. Architecture decision

The project will continue as a layered, serverless-friendly modular monolith with hybrid rendering and a server-only Data Access Layer.

The target request path is:

```text
Chat UI
    -> /api/chat
    -> AI SDK allowlisted tools
    -> validated query tools
    -> repositories
    -> Prisma/Neon adapter
    -> Neon PostgreSQL
```

This architecture remains the project standard until production evidence demonstrates that a specific module requires independent scaling, ownership, deployment, reliability, or security controls.
