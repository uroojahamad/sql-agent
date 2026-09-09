# SQL Agent Tool-Calling Implementation Plan

## 1. Objective

Connect the existing SQL agent to the Neon database through safe, structured AI SDK tool calls.

The first milestone is functionality:

- Understand the user's data question.
- Select an appropriate database tool.
- Query Neon through the existing Prisma repositories.
- Return a correct, natural-language answer based only on database results.

UI redesign is explicitly out of scope for this phase. The existing [`html-pages/index.html`](html-pages/index.html) sample will be used as the visual reference when UI work begins later. Do not modify the current UI while implementing tool calling.

## 2. Current foundation

The project already has:

- A Neon PostgreSQL database.
- Prisma ORM and the Neon driver adapter.
- `categories`, `products`, and `sales` tables.
- 30 seeded records in each business table.
- Server-only Prisma repositories.
- Initial validated query-tool functions.
- A temporary `/database` route for inspecting records.
- A streaming chat endpoint at `app/api/chat/route.ts`.

The next step is to connect these pieces without allowing the model unrestricted database access.

## 3. Target architecture

```text
User message
    |
    v
app/api/chat/route.ts
    |
    v
Gemini model + SQL-agent system prompt
    |
    v
AI SDK selects an allowlisted tool
    |
    v
Zod validates tool arguments
    |
    v
database/query-tools.ts
    |
    v
database/repositories/*
    |
    v
Prisma Client -> Neon pooled connection
    |
    v
Structured tool result -> model explanation -> streamed response
```

The model does not receive database credentials, Prisma Client, or permission to execute arbitrary SQL.

## 4. Phase 1: Define the database tools

Wrap the existing database operations as AI SDK tools.

### `listCategories`

Purpose:

- List available categories.
- Show the number of products in each category.

Inputs:

- `limit`: optional integer with a safe maximum.

Example questions:

- “What categories do we have?”
- “List the first 10 categories.”

### `findProducts`

Purpose:

- Search products by name, SKU, or description.
- Filter products by category.
- Optionally include inactive products.

Inputs:

- `query`: optional search string.
- `categorySlug`: optional category filter.
- `activeOnly`: boolean, default `true`.
- `limit`: bounded integer.

Example questions:

- “Find audio products.”
- “Do we have a wireless charging pad?”
- “Show products in the fitness category.”

### `listSales`

Purpose:

- Return recent sale records with their associated product and category.

Inputs:

- `limit`: bounded integer.

Example questions:

- “Show the 10 most recent sales.”
- “What was sold recently?”

### `getSalesSummary`

Purpose:

- Calculate total units and revenue for a date range.
- Keep revenue grouped by currency.

Inputs:

- `from`: inclusive date/time.
- `to`: exclusive date/time.

Example questions:

- “How much revenue did we generate in August?”
- “How many units were sold between August 1 and August 15?”

### `getTopProducts`

Purpose:

- Rank products by revenue for a date range.

Inputs:

- `from`: inclusive date/time.
- `to`: exclusive date/time.
- `limit`: bounded integer.

Example questions:

- “Which product generated the most revenue?”
- “Show the top five products in August.”

### `getCategoryPerformance`

Purpose:

- Rank categories by revenue for a date range.

Inputs:

- `from`: inclusive date/time.
- `to`: exclusive date/time.
- `limit`: bounded integer.

Example questions:

- “Which category performed best?”
- “Show category performance for August.”

## 5. Tool implementation rules

Every AI SDK tool must include:

- A precise description that helps the model select it correctly.
- A Zod input schema.
- An `execute` function that delegates to `database/query-tools.ts`.
- Bounded limits and validated date ranges.
- A structured, JSON-serializable result.
- A safe error response that does not expose credentials or raw database internals.

Tool wrappers should be placed in a server-only module, for example:

```text
database/
├── ai-tools.ts          # AI SDK tool definitions
├── query-tools.ts       # Input validation and application-level operations
└── repositories/        # Prisma queries
```

Do not duplicate Prisma queries inside `app/api/chat/route.ts`. The route should orchestrate the model and tools while repositories remain responsible for database access.

## 6. Phase 2: Add the SQL-agent system prompt

Create a focused system prompt that tells the model:

- It is a read-only assistant for product, category, and sales data.
- Database facts must come from tool results.
- It must never invent products, prices, quantities, dates, or revenue.
- It should select the smallest tool or set of tools needed to answer.
- It must ask a concise clarification question when a required date or filter is ambiguous.
- It should clearly say when no matching records exist.
- It must preserve the currency returned by the database.
- It should summarize results instead of dumping unnecessary internal fields.
- It must not reveal UUIDs, database credentials, environment variables, SQL internals, or raw error messages unless an internal identifier is explicitly needed and safe.
- It must not claim a tool ran successfully if the tool returned an error.

The system prompt should include the database's date-range convention:

- `from` is inclusive.
- `to` is exclusive.
- A request for the complete month of August 2026 maps to `2026-08-01T00:00:00Z` through `2026-09-01T00:00:00Z`.

## 7. Phase 3: Connect tools to the chat route

Update `app/api/chat/route.ts` to:

1. Parse and validate the incoming messages.
2. Pass the SQL-agent system prompt to the model.
3. Register the allowlisted database tools.
4. Allow the model to execute the required tool calls.
5. Allow enough model steps for a tool call followed by a final explanation.
6. Stream tool activity and the final response through the existing UI-message response format.
7. Convert unexpected internal failures into a safe user-facing error.

Expected flow:

```text
User: “How much revenue did we generate in August 2026?”

Model selects:
getSalesSummary({
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-09-01T00:00:00.000Z"
})

Tool returns:
{
  "currency": "USD",
  "units": 90,
  "revenue": "8231.10"
}

Assistant:
“In August 2026, 90 units were sold for $8,231.10 in revenue.”
```

The exact AI SDK API must be taken from the version installed in this repository rather than older examples.

## 8. Response behavior

The agent should use concise, business-friendly responses.

For a single value:

```text
August revenue was $8,231.10 from 90 units sold.
```

For product/category rankings:

```text
The top three products were:

1. Product A — $1,200.00
2. Product B — $980.00
3. Product C — $750.00
```

For no results:

```text
I couldn't find any matching sales in that date range.
```

For ambiguous input:

```text
Which year should I use for August?
```

For a tool/database failure:

```text
I couldn't retrieve the database results right now. Please try again.
```

Raw Prisma or Neon errors must only be logged on the server and must not be sent to the model or browser.

## 9. Security requirements

The initial implementation must remain read-only.

- Use allowlisted tools instead of model-generated SQL.
- Keep `DATABASE_URL`, `DIRECT_URL`, and Prisma imports in server-only modules.
- Never expose `$queryRawUnsafe` or `$executeRawUnsafe`.
- Continue using tagged, parameterized raw SQL only in reviewed repository functions.
- Enforce maximum row counts and date ranges.
- Reject invalid or reversed date ranges.
- Do not allow the model to select arbitrary table names, columns, or SQL fragments.
- Add a dedicated read-only Neon role before public production access.
- Add authentication and authorization before exposing private business data.
- Add route-level rate limiting before public production access.
- Add database/query timeouts before public production access.

If unrestricted natural-language-to-SQL is considered later, it must be a separate phase with a SQL AST validator, a read-only role, table allowlists, single-`SELECT` enforcement, statement timeouts, and forced row limits.

## 10. Logging and observability

For every database tool execution, log:

- Request/correlation ID.
- Authenticated user ID when authentication exists.
- Tool name.
- Execution duration.
- Number of rows returned.
- Success or safe error category.

Do not log:

- Database URLs or credentials.
- Full private user messages when unnecessary.
- Raw records containing sensitive data.
- Provider API keys.

## 11. Testing plan

### Repository tests

- Category listing returns bounded records.
- Product search works by name, SKU, and category.
- Sales listing includes product/category relationships.
- Revenue calculations use `quantity * unit_price` correctly.
- Revenue remains grouped by currency.
- Date boundaries are inclusive/exclusive as documented.

### Tool tests

- Valid tool arguments call the correct repository.
- Invalid dates are rejected.
- Reversed ranges are rejected.
- Excessive limits are rejected or capped.
- Tool results are JSON-serializable.
- Internal database errors become safe tool failures.

### Agent evaluations

Test at least these questions:

1. “What categories do we have?”
2. “Find products related to audio.”
3. “Do we have a wireless charging pad?”
4. “Show the 10 most recent sales.”
5. “How many units were sold in August 2026?”
6. “How much revenue did we make in August 2026?”
7. “Which product generated the most revenue?”
8. “Which category performed best?”
9. “Show sales between August 10 and August 20.”
10. “Find a product that does not exist.”
11. “Show sales in August.” — should clarify the year when context does not provide it.
12. An unrelated question — should answer normally or explain that it only has database tools for catalog/sales data, depending on the final product scope.

For every evaluation, verify:

- Correct tool selection.
- Correct arguments.
- Correct database result.
- No invented values.
- Clear final response.

## 12. Deferred UI plan

Do not change the UI during the tool-calling implementation.

After functionality and evaluations pass:

1. Use [`html-pages/index.html`](html-pages/index.html) as the visual reference.
2. Convert the static sample into reusable React components.
3. Preserve the current AI SDK chat behavior.
4. Display tool execution/loading states.
5. Render suitable database results as compact tables or summary cards.
6. Add friendly empty and error states.
7. Optionally link to the temporary `/database` viewer during development.
8. Remove the `/database` viewer when it is no longer needed.

UI work must not block or be mixed into the first functional tool-calling milestone.

## 13. Deployment plan

Before production release:

- Configure the production `DATABASE_URL` and `DIRECT_URL` securely.
- Run `prisma migrate deploy` through CI/release automation.
- Run `prisma generate` before the Next.js production build.
- Use a dedicated read-only runtime role for SQL-agent tools.
- Add authentication, authorization, rate limiting, query timeouts, and monitoring.
- Run the repository tests and agent evaluation suite against a Neon test branch.
- Verify the production model/provider credentials.

## 14. Implementation order

Implement in this order:

1. Review the installed AI SDK tool API.
2. Create `database/ai-tools.ts` with six allowlisted tools.
3. Finalize serializable DTOs and safe error behavior in `database/query-tools.ts`.
4. Add the SQL-agent system prompt in a dedicated server-only module.
5. Register the prompt and tools in `app/api/chat/route.ts`.
6. Verify streaming tool calls and final answers manually.
7. Add repository and tool tests.
8. Add the initial agent evaluation cases.
9. Add authentication, rate limiting, read-only credentials, and observability before public release.
10. Begin UI implementation from `html-pages/index.html` only after the functional milestone passes.

## 15. Definition of done

The tool-calling milestone is complete when:

- All six database tools have strict Zod schemas and bounded execution.
- `app/api/chat/route.ts` registers and successfully executes the tools.
- The model answers database questions using real Neon results.
- The model does not invent database facts when tools return no data or fail.
- Tool outputs are structured and JSON-serializable.
- Raw credentials and database errors never reach the browser/model.
- TypeScript, ESLint, and the Next.js production build pass.
- Repository tests and the initial agent evaluation suite pass.
- The existing UI remains unchanged.
- `html-pages/index.html` is documented as the reference for the later UI phase.
