# Phase 1.5 — API & AI Usage Protection

## Objective

Implement API rate limiting and AI usage protection **before Phase 2**.

The existing AI SQL Agent already limits message count, validates messages/tools, and limits agent execution steps. However, a visitor can still repeatedly call `/api/chat` and consume the shared Gemini quota.

The key rule for this phase is:

> Any request that violates rate or input limits must be rejected **before `streamText()` invokes Gemini**.

## Target Request Flow

```text
User
  ↓
POST /api/chat
  ↓
Basic request validation
  ↓
Resolve client identifier
  ↓
Application rate limiter
  ├── BLOCKED → HTTP 429 → Friendly UI error
  └── ALLOWED
         ↓
Input/conversation-size validation
         ↓
Create and validate AI tools/messages
         ↓
streamText()
         ↓
Gemini
         ↓
Maximum agent steps
         ↓
Validated read-only database tools
         ↓
Prisma / PostgreSQL
```

Never perform the rate-limit check after Gemini has already been invoked.

---

## 1. Distributed Rate Limiting

Use:

```text
Upstash Redis
@upstash/ratelimit
@upstash/redis
```

Install:

```bash
npm install @upstash/ratelimit @upstash/redis
```

A distributed store is required because the application runs on Vercel/serverless infrastructure.

Do **not** use an in-memory `Map` as the production limiter because separate serverless instances do not share memory.

---

## 2. Environment Configuration

Configure server-side variables such as:

```env
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Use the exact names required by the selected Upstash configuration.

Rules:

- Never use `NEXT_PUBLIC_` for these secrets.
- Never expose them to client code.
- Never return them from an API.
- Never send them to Gemini.
- Never log their values.
- Never commit real credentials.
- Add placeholder variable names to `.env.example`.

---

## 3. Keep Rate-Limit Logic Separate

Do not place all rate-limit code directly in `app/api/chat/route.ts`.

Suggested structure:

```text
lib/
  rate-limit/
    client.ts
    chat-rate-limit.ts
    identifier.ts
```

Responsibilities:

```text
client.ts
→ Redis client configuration

chat-rate-limit.ts
→ burst/daily limiter configuration and checks

identifier.ts
→ safe client identifier resolution
```

Adapt filenames if the existing project structure suggests a better location.

---

## 4. Implement Two Limits

### Burst Protection

Start with:

```text
10 AI requests / minute / visitor
```

Prefer a sliding-window limiter.

Conceptually:

```ts
const burstLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "sql-agent:burst",
});
```

Purpose:

- stop rapid repeated requests,
- reduce scripted spam,
- protect against accidental repeated submissions.

### Daily Protection

Start with:

```text
50 AI requests / day / visitor
```

Conceptually:

```ts
const dailyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(50, "1 d"),
  prefix: "sql-agent:daily",
});
```

Purpose:

Prevent someone from bypassing the minute limit by repeatedly waiting and continuing throughout the day.

Keep limit values centralized/configurable rather than scattering magic numbers through the code.

---

## 5. Identify Anonymous Visitors

The project currently has no authentication, so initially rate-limit by a trusted deployment-provided client IP identifier.

Create a helper conceptually like:

```ts
getRateLimitIdentifier(request)
```

returning an internal identifier such as:

```text
ip:<client-ip>
```

Do not blindly trust arbitrary client-controlled identity headers.

For Vercel deployment, verify the appropriate current Vercel/Next.js mechanism for determining the client address.

Do not add authentication just for this phase.

Future extension:

```text
Authenticated → user:<userId>
Anonymous     → ip:<client-address>
```

---

## 6. API Processing Order

Update `app/api/chat/route.ts` approximately as follows:

```text
1. Parse JSON.
2. Perform basic body validation.
3. Resolve rate-limit identifier.
4. Check burst limit.
5. Check daily limit.
6. Validate message/conversation size.
7. Create SQL Agent tools.
8. Validate UI messages.
9. Convert model messages.
10. Call streamText().
11. Stream response.
```

Existing validation may be reordered where technically appropriate.

The invariant is:

> Rate/input rejected requests must never reach Gemini.

---

## 7. Proper HTTP 429 Errors

A rate-limit violation must return:

```http
429 Too Many Requests
```

Do not return `500`.

Burst example:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please wait a moment before asking another question.",
    "retryAfterSeconds": 42
  }
}
```

Daily example:

```json
{
  "error": {
    "code": "DAILY_LIMIT_EXCEEDED",
    "message": "You've reached today's AI demo limit. Please try again tomorrow."
  }
}
```

Use machine-readable error codes.

---

## 8. Rate-Limit Headers

Where appropriate return:

```text
Retry-After
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
```

Use actual limiter metadata (`limit`, `remaining`, `reset`, etc.) to calculate these values.

Do not invent retry/reset times.

---

## 9. Friendly Frontend Errors

Do not expose errors such as:

```text
POST /api/chat failed: 429
Upstash Redis rate limit exceeded
Gemini quota exhausted
```

Display friendly messages.

Burst limit:

> Too many requests. Please wait a moment before asking another question.

Daily limit:

> You've reached today's AI demo limit. Please try again tomorrow.

Protection service unavailable:

> The AI service is temporarily unavailable. Please try again shortly.

Never expose Redis keys, IP addresses, credentials, stack traces, database information, or infrastructure internals.

---

## 10. Input / Token-Abuse Protection

Rate limiting alone is insufficient because one request can contain a very large conversation.

Keep the existing:

```ts
MAX_MESSAGES_PER_REQUEST = 50;
```

Add initial limits such as:

```text
MAX_USER_MESSAGE_LENGTH = 1,000 characters
MAX_TOTAL_TEXT_LENGTH = approximately 10,000 characters
```

These can be tuned after testing.

### Individual Message Limit

If a user message exceeds the configured limit:

```text
HTTP 400 Bad Request
Gemini NOT called
```

Friendly message:

> Your message is too long. Please shorten your question and try again.

This is input validation, so use `400`, not `429`.

### Conversation Limit

Calculate the total relevant textual content being sent to the model.

If the total exceeds the configured limit:

```text
HTTP 400
Gemini NOT called
```

Friendly message:

> This conversation has become too long. Please start a new chat or shorten the conversation.

Do not implement complicated token accounting merely for this check. A deterministic text-size limit is enough for this portfolio project.

---

## 11. Keep Existing Agent Protection

Do not remove:

```ts
stopWhen: isStepCount(5)
```

It protects against excessive agent execution **inside one accepted request**, while rate limiting protects against excessive requests.

Final defense-in-depth model:

```text
Visitor
  ↓
10 requests/minute
  ↓
50 requests/day
  ↓
Message count/size protection
  ↓
Conversation-size protection
  ↓
Gemini
  ↓
Maximum 5 agent steps
  ↓
Validated read-only tools
  ↓
Database
```

Gemini's provider quota remains a final external safeguard, not the application's primary abuse control.

---

## 12. Rate-Limiter Infrastructure Failure

Explicitly handle Redis/Upstash failures.

For this public AI demo, prefer **fail closed**:

```text
Rate-limit service unavailable
        ↓
Do NOT invoke Gemini
        ↓
HTTP 503 Service Unavailable
```

Return:

> The AI service is temporarily unavailable. Please try again shortly.

Reason: if the protection system fails and traffic is automatically allowed, the shared/potentially paid AI resource becomes unprotected.

Log the actual infrastructure error server-side.

---

## 13. Logging and Observability

Log useful rate-limit metadata server-side:

```text
requestId
rateLimitType
status (allowed/blocked/error)
remaining
reset
timestamp
```

Example:

```text
[sql-agent:rate-limit]
requestId: ...
type: burst
status: blocked
remaining: 0
```

Avoid unnecessarily logging:

- full prompts,
- secrets,
- database credentials,
- full raw IP addresses.

Minimize/hash identifiers where practical.

---

## 14. Prevent Duplicate Frontend Submissions

Inspect the chat UI.

While a response is streaming:

```text
Send button → disabled
Enter        → must not create another submission
```

This reduces accidental token usage.

Frontend protection is only a UX optimization. It can be bypassed, so server-side rate limiting remains mandatory.

---

## 15. Automated Tests

Do not make real Gemini calls just to test the limiter.

Use mocks/test doubles and explicitly verify that rejected requests do not reach the model path.

### Test A — Within Burst Limit

Requests within the configured window:

```text
→ allowed
→ normal request flow
```

### Test B — Burst Limit Exceeded

Next request beyond the limit:

```text
→ HTTP 429
→ RATE_LIMIT_EXCEEDED
→ Gemini NOT called
→ DB tools NOT called
```

### Test C — Daily Limit Exceeded

Beyond daily allowance:

```text
→ HTTP 429
→ DAILY_LIMIT_EXCEEDED
→ Gemini NOT called
```

### Test D — Oversized Message

```text
→ HTTP 400
→ friendly validation error
→ Gemini NOT called
```

### Test E — Oversized Conversation

```text
→ HTTP 400
→ friendly conversation-size error
→ Gemini NOT called
```

### Test F — Redis Failure

```text
→ HTTP 503
→ safe error
→ Gemini NOT called
```

### Test G — Normal SQL Question

Example:

```text
What is our top-selling product?
```

Expected:

```text
→ limiter allows request
→ existing agent behavior remains unchanged
```

### Test H — Regression

All existing SQL Agent tests, DB integration tests, and agent evaluations must continue to pass.

The most important test requirement is:

> Rejected requests must consume zero Gemini requests.

---

## 16. Development/Test Limits

Do not manually consume 51 Gemini requests just to test the daily limiter.

Make limits configurable.

Example controlled test configuration:

```text
2 requests/minute
5 requests/day
```

Manual test:

```text
Question 1 → allowed
Question 2 → allowed
Question 3 → blocked (429)
```

Production should use:

```text
10 requests/minute
50 requests/day
```

unless intentionally adjusted.

Verify test limits are not accidentally deployed to production.

---

## 17. Browser Validation

Use the browser Network tab.

For a blocked request confirm:

```text
POST /api/chat
Status: 429 Too Many Requests
```

Verify:

- streaming does not begin,
- Gemini is not invoked,
- friendly UI error appears,
- retry information is correct,
- normal usage resumes after reset.

---

## 18. Production Validation on Vercel

After deployment verify:

```text
Normal request
→ limiter allows
→ Gemini responds
```

and:

```text
Excess request
→ application blocks
→ Gemini never reached
```

Also verify:

- Upstash variables are configured in Vercel.
- Secrets are absent from client bundles.
- Secrets are absent from browser/API responses.
- Limits work across separate serverless invocations.
- Streaming still works for allowed requests.
- Existing SQL Agent behavior remains correct.

---

## 19. Do Not Build Token Billing Yet

Do not add:

- token wallets,
- per-user token balances,
- AI billing plans,
- purchases,
- complex quota dashboards,
- monetary accounting.

For this portfolio project use:

```text
burst limit
+
daily limit
+
message-size limit
+
conversation-size limit
+
existing agent-step limit
```

This gives strong protection without turning the SQL Agent into a billing platform.

Token-aware quotas can be considered later if this becomes a real product. That is explicitly out of scope for Phase 1.5.

---

## 20. Error Response Matrix

| Scenario | HTTP | Code |
| --- | ---: | --- |
| Invalid request | 400 | `INVALID_REQUEST` |
| Message too long | 400 | `MESSAGE_TOO_LONG` |
| Conversation too large | 400 | `CONVERSATION_TOO_LARGE` |
| Burst limit exceeded | 429 | `RATE_LIMIT_EXCEEDED` |
| Daily limit exceeded | 429 | `DAILY_LIMIT_EXCEEDED` |
| Limiter service unavailable | 503 | `RATE_LIMIT_SERVICE_UNAVAILABLE` |
| Unexpected server failure | 500 | Existing safe server error |

Never return raw internal exception messages to users.

---

## 21. Implementation Order

```text
1. Configure Upstash Redis
       ↓
2. Create reusable limiter module
       ↓
3. Implement safe client identifier
       ↓
4. Implement burst limit
       ↓
5. Implement daily limit
       ↓
6. Add 429 / Retry-After handling
       ↓
7. Add message + conversation limits
       ↓
8. Add friendly frontend errors
       ↓
9. Prevent duplicate submissions
       ↓
10. Add automated tests
       ↓
11. Run existing regression/evaluation tests
       ↓
12. Verify on Vercel
```

Do not start Phase 2 until this phase passes its Definition of Done.

---

# Definition of Done

- [ ] Upstash Redis configured.
- [ ] Required server-side environment variables configured.
- [ ] Redis credentials never exposed client-side.
- [ ] Rate-limit implementation separated from `route.ts`.
- [ ] Anonymous visitor identification implemented safely.
- [ ] Burst protection implemented.
- [ ] Production burst limit is 10 requests/minute/visitor unless intentionally changed.
- [ ] Daily protection implemented.
- [ ] Production daily limit is 50 requests/day/visitor unless intentionally changed.
- [ ] Rate limiting happens before `streamText()`.
- [ ] Blocked requests do not invoke Gemini.
- [ ] Blocked requests do not invoke DB tools.
- [ ] Burst violations return HTTP 429.
- [ ] Daily violations return HTTP 429.
- [ ] Correct `Retry-After` information returned where appropriate.
- [ ] Friendly UI rate-limit messages implemented.
- [ ] Individual user-message size limited.
- [ ] Total conversation text limited.
- [ ] Existing `MAX_MESSAGES_PER_REQUEST` protection retained.
- [ ] Existing `stopWhen: isStepCount(5)` retained.
- [ ] Redis failure handled safely with HTTP 503.
- [ ] Limiter failure cannot silently bypass AI protection.
- [ ] Duplicate frontend submissions prevented during streaming.
- [ ] Safe server-side rate-limit logging added.
- [ ] Burst-limit automated tests pass.
- [ ] Daily-limit automated tests pass.
- [ ] Oversized-input tests pass.
- [ ] Limiter-failure test passes.
- [ ] Tests prove Gemini is not called for rejected requests.
- [ ] Existing SQL Agent tests pass.
- [ ] Existing database integration tests pass.
- [ ] Existing agent evaluations pass.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Production behavior verified on Vercel.

---

# Final Architecture

```text
                         AI SQL AGENT

                             User
                               |
                               v
                    +---------------------+
                    | Next.js /api/chat   |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    | Request Validation  |
                    +----------+----------+
                               |
                               v
                    +---------------------+
                    | Rate Limiting       |
                    | 10 requests/minute  |
                    | 50 requests/day     |
                    +----------+----------+
                               |
                   blocked ----+---- allowed
                      |                  |
                      v                  v
                 HTTP 429       +------------------+
                                | Input Protection |
                                | message count    |
                                | message length   |
                                | total text size  |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | Gemini           |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | Agent            |
                                | max 5 steps      |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | Validated Tools  |
                                +--------+---------+
                                         |
                                         v
                                +------------------+
                                | Prisma / Neon    |
                                +------------------+
```

# Phase Completion

When every Definition of Done item passes:

> **Phase 1.5 — API & AI Usage Protection is complete.**

Then proceed to:

```text
Phase 2 — AI SQL Agent Final Improvements & Portfolio Readiness
```

Do not add unrelated features during this phase.
