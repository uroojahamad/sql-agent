# Phase 2 — AI SQL Agent: Final Improvements & Portfolio Readiness

## Objective

Phase 2 is focused on improving the existing AI SQL Agent without making the project unnecessarily complex.

The goal is to:

- add one meaningful multi-step analytics capability,
- strengthen database safety,
- verify the existing implementation with tests and agent evaluations,
- improve documentation and demo readiness,
- deploy the project,
- and then consider the AI SQL Agent complete.

This phase should **not** turn the project into a large enterprise platform.

---

## Current Project Status

The current application already supports:

- Natural-language questions over business data.
- Gemini integration using the Vercel AI SDK.
- Streaming chat responses.
- AI tool calling.
- Read-only predefined database tools.
- Zod validation for tool inputs.
- Prisma + Neon PostgreSQL.
- Category, product, inventory, and sales queries.
- Month-to-date defaults for sales questions without a date range.
- Safe handling of unsupported questions.
- Agent step limits.
- Database and agent evaluation tests.
- Modular monolith / layered architecture.

Phase 2 should build on this architecture instead of replacing it.

---

# Phase 2.1 — Add One Multi-Step Analytics Capability

## Goal

Demonstrate that the agent can use multiple tools or multiple tool calls to answer a more complex business question.

The current application mostly handles:

```text
User question
    ↓
Agent selects one tool
    ↓
Database result
    ↓
Final answer
```

Phase 2 should also support:

```text
User question
    ↓
Agent understands comparison
    ↓
Tool call for period A
    ↓
Tool call for period B
    ↓
Agent compares both results
    ↓
Business-friendly final answer
```

---

## Recommended Use Case

Implement:

> "Compare the top products this month with last month."

The agent should:

1. Determine the current month date range.
2. Determine the previous month date range.
3. Call the existing top-products analytics tool for the current month.
4. Call the same tool for the previous month.
5. Compare the returned values.
6. Return a concise summary.

Example response:

```text
Top product comparison

August 2026:
Ergonomic Office Chair — $839.97 revenue

September 2026 month-to-date:
Noise-Cancelling Headphones — $620.00 revenue

The leading product changed from Ergonomic Office Chair in August
to Noise-Cancelling Headphones in September.
```

---

## Important Rules

- Prefer using existing tools instead of creating unnecessary new tools.
- Do not let the model generate unrestricted SQL.
- Do not calculate or invent revenue values inside the LLM.
- Use exact values returned from the tools.
- Preserve currencies.
- Do not combine amounts from different currencies.
- Respect the existing step limit.
- Keep date ranges explicit and deterministic.

---

## Optional Second Multi-Step Question

Only add this if it can reuse the same architecture without significant extra complexity:

> "Which category improved or declined the most compared with last month?"

Do not add many comparison features. One strong comparison flow is enough.

---

## Acceptance Criteria

Phase 2.1 is complete when:

- A user can ask for a current-month vs previous-month comparison.
- The agent performs multiple tool calls when needed.
- The model does not invent or recalculate database values.
- The response clearly identifies both compared periods.
- Existing single-tool questions continue to work.
- Agent execution remains within the configured step limit.

---

# Phase 2.2 — Strengthen Database Read-Only Protection

## Goal

The application is already read-only at the AI/tool layer.

Add database-level protection so the database connection used by the application also has read-only permissions where practical.

---

## Current Protection

The current architecture already provides:

```text
Gemini
  ↓
Predefined tools only
  ↓
Validated input
  ↓
Repository functions
  ↓
Prisma / controlled queries
  ↓
PostgreSQL
```

The model does not receive:

- database credentials,
- raw SQL execution access,
- environment variables,
- Prisma client access,
- unrestricted database tools.

Keep this behavior unchanged.

---

## Recommended Improvement

Create a dedicated PostgreSQL database user/role for the AI application with only the permissions needed to read the required tables.

Example conceptual permission model:

```text
sql_agent_reader
    ├── SELECT categories
    ├── SELECT products
    └── SELECT sales
```

The application should use this read-only database connection in production.

---

## Important

Do not expose database credentials anywhere in:

- client-side code,
- GitHub,
- README examples,
- tool results,
- model prompts,
- logs.

Store the connection string only in server-side environment variables.

---

## Acceptance Criteria

Phase 2.2 is complete when:

- The application continues to read required data.
- The production database role cannot perform INSERT, UPDATE, DELETE, DROP, ALTER, or other write operations.
- Database credentials remain server-side.
- Existing agent behavior remains unchanged.

If database-level role configuration is not practical for the current demo environment, document this as a future production-hardening step instead of blocking the project.

---

# Phase 2.3 — Testing and Agent Evaluation

## Goal

Verify that the application behaves correctly before calling the project complete.

---

## Existing Test Commands

Use the existing project scripts:

```bash
npm test
npm run test:database
npm run test:agent
```

Also run:

```bash
npm run lint
npm run build
```

---

## Validate Existing Behavior

Confirm that the following still work:

### Categories

```text
"What categories do we have?"
```

Expected:

- Agent selects the category tool.
- Real database values are returned.

### Product Search

```text
"Find products related to audio."
```

Expected:

- Product search tool is used.
- No invented products.

### Recent Sales

```text
"Show the 10 most recent sales."
```

Expected:

- Recent-sales tool is used.
- Correct ordering and limit.

### Revenue

```text
"How much revenue did we make in August 2026?"
```

Expected:

- Sales summary tool is used.
- Correct period.
- Currency preserved.

### Default Month-to-Date

```text
"What is our top-selling product?"
```

Expected:

- No clarification is requested.
- Current month-to-date range is automatically used.
- The applied period is mentioned in the answer.

### Ambiguous Period

```text
"Show sales in August."
```

Expected:

- Agent asks which year.
- No database reporting tool is called before clarification.

### No Matching Data

```text
"Find a product named Quantum Banana Teleporter."
```

Expected:

- Agent clearly explains that no matching product exists.
- It does not invent a result.

### Out-of-Scope Question

```text
"What is the weather today?"
```

Expected:

- No database tool is called.
- Agent explains the supported data scope.

---

## Add Evaluation Cases for Phase 2

Add at least one agent evaluation for the new multi-step comparison behavior.

Example:

```text
Prompt:
"Compare the top-selling product this month with last month."

Expected behavior:
- Two relevant reporting tool calls.
- Correct date ranges.
- Both periods mentioned.
- No invented numbers.
```

If useful, also test:

```text
"Compare category performance this month with last month."
```

Do not create a large evaluation framework. Extend the existing one.

---

## Acceptance Criteria

Phase 2.3 is complete when:

- Lint passes.
- Build passes.
- Existing tests pass.
- Database integration tests pass.
- Existing agent evaluations pass.
- New multi-step evaluation passes reliably.

---

# Phase 2.4 — README and Portfolio Documentation

## Goal

Make the repository understandable to recruiters and interviewers without requiring them to read the full source code.

---

## README Sections

Update the README to include the following.

### 1. Project Overview

Explain in simple language:

> AI SQL Agent is a conversational analytics application that allows users to query business data using natural language.

---

### 2. Problem It Solves

Explain the real-world use case:

Business users often need developers or analysts to write SQL queries for questions such as:

- Which product sells the most?
- How much revenue did we make this month?
- Which category performed best?
- What were the latest sales?

The AI SQL Agent lets users ask these questions directly in natural language.

---

### 3. Architecture

Include a simple diagram:

```text
User
  ↓
Next.js Chat UI
  ↓
Vercel AI SDK
  ↓
Gemini
  ↓
Validated AI Tools
  ↓
Query / Repository Layer
  ↓
Prisma
  ↓
Neon PostgreSQL
```

Explain that Gemini does not directly access the database.

---

### 4. Why Predefined Tools Instead of Arbitrary SQL

Include this design decision.

Example:

> The agent intentionally does not execute unrestricted AI-generated SQL. Gemini is responsible for understanding the user's intent and selecting a predefined read-only tool. Database operations remain controlled by application code, making the system safer and more predictable.

This is an important interview discussion point.

---

### 5. Key Features

Mention:

- Natural-language business queries.
- Gemini-powered tool selection.
- Streaming responses.
- Zod-validated tool inputs.
- Prisma + Neon PostgreSQL.
- Read-only database access pattern.
- Month-to-date reporting defaults.
- Multi-step analytical comparison.
- Safe error handling.
- Agent evaluation cases.

---

### 6. Supported Questions

Provide examples such as:

```text
What categories do we have?

Find products related to audio.

What is our top-selling product?

How much revenue did we generate this month?

Which category performed best in August 2026?

Show the latest sales.

Compare the top-selling product this month with last month.
```

---

### 7. Security

Mention:

- No database credentials are sent to Gemini.
- No client-side database access.
- No unrestricted SQL execution tool.
- Strict Zod validation.
- Server-only database modules.
- Read-only application behavior.
- Database-level read-only role if implemented.

---

### 8. Tech Stack

Keep it simple:

- Next.js
- React
- TypeScript
- Vercel AI SDK
- Google Gemini
- Prisma
- Neon PostgreSQL
- Zod

---

### 9. Testing

Document:

```bash
npm test
npm run test:database
npm run test:agent
npm run lint
npm run build
```

---

## Screenshots

Add a few useful screenshots instead of many screenshots.

Recommended:

1. Chat welcome screen.
2. Revenue or top-product question.
3. Multi-step comparison result.
4. Database viewer, if useful.

---

## Acceptance Criteria

Phase 2.4 is complete when:

- README explains the project in under a few minutes.
- Architecture is easy to understand.
- Security decisions are documented.
- Sample questions are provided.
- Setup instructions work.
- Screenshots show the main functionality.

---

# Phase 2.5 — Deployment

## Goal

Provide a working project link that can be added to the resume and GitHub repository.

---

## Deployment Checklist

Recommended platform:

- Vercel for the Next.js application.
- Neon for PostgreSQL.

Verify environment variables such as:

```text
DATABASE_URL
GOOGLE_GENERATIVE_AI_API_KEY
```

Use the actual environment variable names already used by the application.

Do not commit real values.

---

## Production Validation

After deployment, test:

```text
What categories do we have?

What is our top-selling product?

How much revenue did we generate this month?

Compare the top-selling product this month with last month.

Show sales in August.

What is the weather today?
```

Verify:

- streaming works,
- tools execute correctly,
- database access works,
- ambiguous requests are handled correctly,
- unsupported questions do not use database tools,
- secrets are not exposed in browser/network responses.

---

## Acceptance Criteria

Phase 2.5 is complete when:

- Application is publicly accessible.
- Core queries work in production.
- Environment secrets remain private.
- GitHub README contains the live demo link.

---

# Final Project Boundary

Once Phase 2 is complete, stop adding features to the AI SQL Agent.

The purpose of this project is to demonstrate:

```text
Natural Language
      ↓
LLM Intent Understanding
      ↓
Tool Selection
      ↓
Input Validation
      ↓
Controlled Database Access
      ↓
Grounded Results
      ↓
Business-Friendly AI Response
```

The project does **not** need to include:

- RAG
- Embeddings
- Vector databases
- LangChain
- LangGraph
- Authentication
- User management
- Complex dashboards
- CSV/PDF exports
- Dozens of database tables
- Unrestricted AI-generated SQL
- Complex multi-agent architecture

Those concepts can be learned in later projects when there is a real reason to use them.

---

# Definition of Done

The AI SQL Agent is considered complete when all of the following are true:

- [ ] Existing features remain stable.
- [ ] One multi-step comparison use case is implemented.
- [ ] Database access is read-only or the production hardening requirement is documented.
- [ ] Tool inputs remain strictly validated.
- [ ] Existing tests pass.
- [ ] Database integration tests pass.
- [ ] Agent evaluations pass.
- [ ] Multi-step behavior has an evaluation case.
- [ ] Lint passes.
- [ ] Production build passes.
- [ ] README clearly explains architecture and security decisions.
- [ ] Useful screenshots are included.
- [ ] Application is deployed.
- [ ] Live demo URL is added to the repository.

After completing this checklist:

> **AI SQL Agent — Complete. Move to the next AI project.**
