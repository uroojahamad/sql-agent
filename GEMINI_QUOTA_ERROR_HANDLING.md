# Gemini Quota & Provider Error Handling

## Objective

Extend the already-completed Phase 1.5 protection so the SQL Agent handles **Gemini provider-side quota and availability errors** cleanly, without redesigning the existing rate limiter.

The application must distinguish:

1. Our 10 requests/minute limit
2. Our 50 requests/day demo limit
3. Gemini short-term RPM/TPM throttling
4. Gemini daily quota exhaustion
5. Gemini temporary service unavailability (503)
6. Unknown AI-provider failures

Keep user messages safe and simple while retaining useful server-side diagnostics.

---

## 1. Preserve Existing Application Limits

Do not rewrite Phase 1.5.

### 10/minute

Message:

> Too many requests. Please wait a moment and try again.

Use the existing error code (for example `RATE_LIMIT_EXCEEDED`) and HTTP `429`.

Preserve useful existing headers such as `Retry-After` and `X-RateLimit-*`.

### 50/day

Message:

> You've reached today's demo usage limit. Please try again tomorrow.

Use the existing error code (for example `DAILY_LIMIT_EXCEEDED`) and HTTP `429`.

These errors happen before Gemini is called.

---

## 2. Centralize Gemini Error Classification

Create or extend one small server-only provider-error utility, following the repository's existing structure. For example:

```text
lib/ai/provider-errors.ts
```

Do not duplicate Gemini parsing in the API route, UI, and tools.

Conceptual flow:

```text
Raw Gemini / AI SDK error
        ↓
classifyProviderError()
        ↓
Normalized application error
        ↓
API / stream handling
        ↓
Friendly UI message
```

A normalized representation may conceptually contain:

```ts
type AIProviderError = {
  code:
    | "AI_RATE_LIMITED"
    | "AI_DAILY_QUOTA_EXCEEDED"
    | "AI_SERVICE_UNAVAILABLE"
    | "AI_REQUEST_TIMEOUT"
    | "AI_CONFIGURATION_ERROR"
    | "AI_CONTENT_BLOCKED"
    | "AI_REQUEST_CANCELLED"
    | "AI_PROVIDER_ERROR";
  message: string;
  status: number;
  retryAfterSeconds?: number;
};
```

Adapt this to existing project conventions rather than adding unnecessary abstractions.

---

## 3. Gemini Short-Term RPM / TPM Limit

Gemini can return `429` for requests-per-minute, tokens-per-minute, or temporary throttling.

Normalize as:

```text
AI_RATE_LIMITED
HTTP 429
```

Message:

> The AI service is temporarily busy. Please try again shortly.

If trustworthy provider/SDK retry metadata is available, preserve it and expose `Retry-After` where the response architecture permits it.

Never invent a retry duration.

---

## 4. Gemini Daily Quota Exhaustion

Distinguish daily quota exhaustion from short-term throttling **only when reliable provider information supports that classification**.

Normalize as:

```text
AI_DAILY_QUOTA_EXCEEDED
HTTP 429
```

Message:

> The AI service has reached its daily usage limit. Please try again after the quota resets.

### Reset time

Do not hard-code or guess a reset time.

If trustworthy provider metadata supplies enough information to determine a reset/retry time, the UI may show it. Otherwise use the generic quota-reset message above.

Do not calculate a reset time merely from assumptions about Google's quota schedule.

---

## 5. Avoid Fragile Classification

Do not rely only on exact message comparisons such as:

```ts
error.message === "quota exceeded"
```

Prefer, in order where available:

1. HTTP/provider status
2. AI SDK/provider error type
3. provider error code/status
4. structured provider metadata/details
5. retry metadata
6. controlled message inspection only as a fallback

A generic `429` alone does **not** prove daily quota exhaustion.

If only `429` is known, classify conservatively as:

```text
AI_RATE_LIMITED
```

and show:

> The AI service is temporarily busy. Please try again shortly.

Only classify `AI_DAILY_QUOTA_EXCEEDED` when reliable details identify a daily/quota exhaustion condition.

---

## 6. Gemini 503

Handle provider temporary unavailability separately.

Normalize as:

```text
AI_SERVICE_UNAVAILABLE
HTTP 503
```

Message:

> The AI service is temporarily unavailable. Please try again shortly.

Never expose Google's raw response, stack trace, credentials, or internal details to the browser.

---

## 7. Unknown Provider Errors

Unclassified upstream AI failures should use a safe fallback.

Normalize as:

```text
AI_PROVIDER_ERROR
```

Prefer HTTP `502` when appropriate and possible.

Message:

> The AI service couldn't complete the request. Please try again.

Do not mislabel unknown errors as quota exhaustion.

## 7A. Additional Gemini Outcomes Found During Implementation

The original plan did not explicitly cover several outcomes documented by the
Gemini API. They are now part of the normalized error model:

| Provider outcome | Normalized handling | Client behavior |
|---|---|---|
| `400` invalid provider request or invalid generated tool call | `AI_PROVIDER_ERROR`, HTTP `502` when headers have not started | Safe generic provider message |
| `401` authentication failure | `AI_CONFIGURATION_ERROR`, HTTP `502` | Safe unavailable message; never expose API-key details |
| `403` permission failure | `AI_CONFIGURATION_ERROR`, HTTP `502` | Safe unavailable message |
| `404` model/resource not found | `AI_CONFIGURATION_ERROR`, HTTP `502` | Safe unavailable message; no automatic model fallback |
| `408` or `504` deadline/timeout | `AI_REQUEST_TIMEOUT`, HTTP `504` | Ask the user to try again |
| `409`, `500`, `501`, `502`, other upstream `5xx`, or a retryable network failure | `AI_SERVICE_UNAVAILABLE`, HTTP `503` | Safe temporarily-unavailable message |
| `499`, SDK abort, or browser cancellation | `AI_REQUEST_CANCELLED`, HTTP `499` before streaming where possible | The chat rollback removes the cancelled turn; do not show raw provider errors |
| Gemini safety/content-filter finish reason | `AI_CONTENT_BLOCKED`, HTTP `422` before streaming or a safe stream error after headers start | Ask the user to rephrase the question |
| Malformed/invalid provider output | `AI_PROVIDER_ERROR`, HTTP `502` before streaming or a safe stream error after headers start | Safe generic provider message |

The classifier also understands Gemini's structured machine codes such as
`quota_exceeded`, `rate_limit_exceeded`, `authentication`,
`permission_denied`, `model_not_found`, `service_unavailable`, and
`deadline_exceeded`. HTTP status remains the primary signal when present.

References: [Gemini API errors](https://ai.google.dev/gemini-api/docs/api-errors),
[Gemini troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting),
and [Gemini safety settings](https://ai.google.dev/gemini-api/docs/safety-settings).

---

## 8. Streaming-Aware Error Handling

The SQL Agent streams responses using the Vercel AI SDK.

Inspect the exact installed SDK APIs before changing this logic.

Handle both:

```text
error before streaming begins
```

and:

```text
error after streaming has started
```

Rules:

- Before streaming, return appropriate `429`, `503`, or `502` when possible.
- After headers/streaming have started, do not assume the HTTP status can still be changed.
- Use the safe stream-error mechanism supported by the project's installed AI SDK version.
- Preserve current `useChat` / UI-message streaming behavior.
- Do not use outdated AI SDK examples.

---

## 9. Required Frontend Messages

| Scenario | User message |
|---|---|
| Our 10/min limit | `Too many requests. Please wait a moment and try again.` |
| Our 50/day limit | `You've reached today's demo usage limit. Please try again tomorrow.` |
| Gemini RPM/TPM/throttling | `The AI service is temporarily busy. Please try again shortly.` |
| Gemini daily quota | `The AI service has reached its daily usage limit. Please try again after the quota resets.` |
| Gemini 503 | `The AI service is temporarily unavailable. Please try again shortly.` |
| Gemini timeout/deadline | `The AI service took too long to respond. Please try again.` |
| Gemini authentication/permission/model configuration | `The AI service is temporarily unavailable. Please try again shortly.` |
| Gemini safety/content filter | `The AI service couldn't answer that request because it was blocked by safety filters. Please rephrase it and try again.` |
| Cancelled request | `The AI request was cancelled.` (normally removed by chat rollback) |
| Unknown provider error | `The AI service couldn't complete the request. Please try again.` |

If reliable reset/retry metadata exists, the UI may enhance the relevant message.

Do not display raw Gemini JSON, stack traces, API keys, provider headers, SDK exceptions, or internal debug details.

Keep the existing chat design.

---

## 10. Do Not Automatically Switch Models

Do not implement:

```text
Gemini 3.5 Flash-Lite exhausted
        ↓
automatically use another Gemini model
```

Model behavior, tool calling, evaluations, capabilities, and quotas may differ.

Keep the configured/tested model explicit. Model fallback can be a separate future design if ever required.

---

## 11. Retry Policy

Do not blindly retry every `429`.

### Short-term 429

A small bounded retry may be considered only if reliable retry metadata exists and it fits the current SDK architecture.

If retrying:

```text
small bounded retry count
respect provider delay
respect request abort signal
never infinite-loop
```

### Daily quota

Do **not** retry confirmed daily quota exhaustion in the same request.

### 503

If the AI SDK already performs safe bounded retries, preserve that behavior. Do not accidentally create another uncontrolled retry layer.

The goal here is reliable classification and UX, not a complex retry system.

---

## 12. Logging

Use safe server-side categories such as:

```text
application_rate_limit
application_daily_limit
gemini_rate_limit
gemini_daily_quota
gemini_service_unavailable
gemini_provider_error
```

Useful safe fields may include:

```text
requestId
errorCategory
provider status
model identifier
retry metadata when available
timestamp
```

Never log secrets such as Gemini API keys, Upstash tokens, `DATABASE_URL`, authorization headers, or sensitive environment values. Follow the existing privacy approach for visitor identifiers/IPs.

---

## 13. Expected Request Flow

```text
Incoming /api/chat
        ↓
Request validation
        ↓
Application rate limiter
        ├── 10/min exceeded
        │     → RATE_LIMIT_EXCEEDED → 429
        │
        ├── 50/day exceeded
        │     → DAILY_LIMIT_EXCEEDED → 429
        │
        ▼
Gemini
        ├── generic/short-term 429
        │     → AI_RATE_LIMITED
        │
        ├── confirmed daily quota
        │     → AI_DAILY_QUOTA_EXCEEDED
        │
        ├── 503
        │     → AI_SERVICE_UNAVAILABLE
        │
        ├── timeout / deadline
        │     → AI_REQUEST_TIMEOUT
        │
        ├── authentication / permission / model configuration
        │     → AI_CONFIGURATION_ERROR
        │
        ├── safety/content filter
        │     → AI_CONTENT_BLOCKED
        │
        ├── client cancellation
        │     → AI_REQUEST_CANCELLED
        │
        ├── unknown provider failure
        │     → AI_PROVIDER_ERROR
        ▼
Agent tools
        ↓
Stream response
```

Application rate-limit rejection must remain before Gemini invocation.

---

## 14. Automated Tests

Do not intentionally exhaust real Gemini quota in automated tests. Mock representative provider/SDK errors using shapes supported by installed dependencies.

Test at least:

1. **10/min exceeded**
   - Gemini is not called
   - correct message/code

2. **50/day exceeded**
   - Gemini is not called
   - correct message/code

3. **Gemini short-term 429**
   - `AI_RATE_LIMITED`
   - friendly busy message
   - trustworthy retry metadata preserved if supplied

4. **Confirmed Gemini daily quota**
   - `AI_DAILY_QUOTA_EXCEEDED`
   - correct quota message
   - no immediate retry

5. **Generic 429 without daily-quota evidence**
   - classified as `AI_RATE_LIMITED`
   - must not claim daily exhaustion

6. **Gemini 503**
   - `AI_SERVICE_UNAVAILABLE`
   - correct unavailable message

7. **Unknown provider failure**
   - `AI_PROVIDER_ERROR`
   - safe generic message

8. **Sensitive/raw provider error**
   - raw details do not reach client

9. **Successful SQL Agent request**
   - still streams normally
   - tool calling works

10. **Existing agent evaluations**
   - continue to pass

11. **Authentication/permission/model configuration**
   - normalized as `AI_CONFIGURATION_ERROR`
   - credentials and raw provider details are not exposed

12. **Timeout/deadline and network failure**
   - timeout is normalized as `AI_REQUEST_TIMEOUT`
   - retryable network/upstream failure is normalized as `AI_SERVICE_UNAVAILABLE`

13. **Cancellation**
   - normalized as `AI_REQUEST_CANCELLED`
   - cancelled chat turn remains rolled back

14. **Safety/content filtering**
   - content-filter finish becomes `AI_CONTENT_BLOCKED`
   - no raw safety metadata reaches the browser

---

## 15. Manual Validation

Prefer mocks/dev-only testing rather than intentionally exhausting real provider quota.

Validate:

```text
Application 10/min
Application 50/day
Gemini short-term 429
Gemini daily quota
Gemini 503
Unknown provider error
Normal successful response
```

For every case verify:

```text
correct UI message
correct normalized code
correct HTTP/stream behavior
no raw provider details
no secrets
no unnecessary provider call/retry
```

Do not expose production debug endpoints that allow arbitrary users to simulate internal failures.

---

## 16. Regression Checks

Run all applicable existing project checks, including:

```bash
npm test
npm run test:database
npm run test:agent
npm run lint
npm run build
```

Also run any Phase 1.5-specific tests already present.

---

## 17. Keep This Change Focused

Do not add:

- model fallback pools
- automatic model rotation
- billing systems
- token wallets
- authentication
- retry queues/background jobs
- another Redis database
- another rate-limiting service
- unnecessary infrastructure

Reuse the existing Phase 1.5 implementation.

---

## Implementation Record

Implemented on September 16, 2026:

- Centralized classification, retry metadata parsing, stream normalization, and
  daily-quota retry prevention in `lib/ai/provider-errors.ts`.
- Integrated safe pre-stream HTTP responses and post-header stream errors in
  `lib/chat/handle-chat-request.ts`.
- Added frontend allowlisted messages in `components/chat/chat-errors.ts`.
- Added provider and route regression coverage in
  `tests/provider-errors.test.ts` and `tests/api-protection.test.ts`.
- Kept the configured Gemini model explicit; no fallback model was added.

Validation completed with mocked provider failures rather than intentionally
exhausting Gemini quota. The live SQL-agent evaluation was used only to confirm
the normal success path and existing tool calling.

---

# Definition of Done

- [x] Existing 10/min limit still works
- [x] Existing 50/day limit still works
- [x] Application limits reject before Gemini invocation
- [x] Gemini short-term 429 handled
- [x] Gemini daily quota handled separately when reliably identifiable
- [x] Generic Gemini 429 is not falsely called daily exhaustion
- [x] Gemini 503 handled
- [x] Gemini timeout/deadline handled
- [x] Gemini authentication/permission/model configuration handled safely
- [x] Gemini safety/content-filter termination handled
- [x] Client cancellation handled without leaking provider errors
- [x] Retryable network and other upstream 5xx failures handled
- [x] Unknown provider errors have safe fallback
- [x] Pre-stream and in-stream errors handled correctly
- [x] Retry/reset metadata used only when trustworthy
- [x] Reset time is never guessed/hard-coded
- [x] Daily quota is not immediately retried
- [x] No automatic model switching
- [x] Friendly UI messages shown
- [x] Raw Gemini/SDK errors not exposed
- [x] Safe error categories logged
- [x] Provider-error tests pass
- [x] Existing rate-limit tests pass
- [x] Database tests pass
- [x] Agent evaluations pass
- [x] Lint passes
- [x] Production build passes

---

# Final Protection Model

```text
User
  ↓
Request/Input Validation
  ↓
Application Rate Limiting
  ├── 10/min → friendly 429
  └── 50/day → friendly 429
  ↓
Gemini
  ├── RPM/TPM 429 → temporarily busy
  ├── Daily quota → quota reset message
  ├── 503 → temporarily unavailable
  ├── Timeout/deadline → timeout message
  ├── Authentication/configuration → safe unavailable message
  ├── Safety/content filter → rephrase message
  ├── Cancellation → cancelled turn rolled back
  └── Unknown → safe provider error
  ↓
Validated SQL Agent Tools
  ↓
Prisma / Neon
  ↓
Streamed Business Response
```

Once these checks pass, consider **Gemini provider quota/error handling complete** and continue with the previously planned Phase 2 work.
