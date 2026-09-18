import assert from "node:assert/strict";
import test from "node:test";
import { APICallError, type TextStreamPart, type ToolSet } from "ai";
import { getFriendlyChatError } from "../components/chat/chat-errors";
import {
  classifyProviderError,
  createContentBlockedError,
  createProviderStreamTransform,
  preventDailyQuotaRetry,
  serializeProviderError,
} from "../lib/ai/provider-errors";

interface ApiErrorOptions {
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  data?: unknown;
  message?: string;
  isRetryable?: boolean;
}

const createApiError = ({
  statusCode,
  responseHeaders,
  data,
  message = "raw provider detail containing secret-token",
  isRetryable,
}: ApiErrorOptions) =>
  new APICallError({
    message,
    url: "https://generativelanguage.googleapis.com/test",
    requestBodyValues: { hidden: "request-data" },
    statusCode,
    responseHeaders,
    responseBody: "raw response containing secret-token",
    data,
    isRetryable,
  });

const googleErrorData = (
  status: string,
  details?: unknown[],
): Record<string, unknown> => ({
  error: {
    code: 429,
    status,
    message: "provider message",
    details,
  },
});

test("generic Gemini 429 is treated as temporary throttling", () => {
  const error = createApiError({
    statusCode: 429,
    responseHeaders: { "retry-after": "12" },
    data: googleErrorData("RESOURCE_EXHAUSTED"),
  });

  const result = classifyProviderError(error);

  assert.equal(result.code, "AI_RATE_LIMITED");
  assert.equal(result.status, 429);
  assert.equal(result.retryAfterSeconds, 12);
});

test("structured per-day quota metadata identifies daily exhaustion", () => {
  const error = createApiError({
    statusCode: 429,
    data: googleErrorData("RESOURCE_EXHAUSTED", [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaId:
              "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
          },
        ],
      },
      {
        "@type": "type.googleapis.com/google.rpc.RetryInfo",
        retryDelay: "45.5s",
      },
    ]),
  });

  const result = classifyProviderError(error);

  assert.equal(result.code, "AI_DAILY_QUOTA_EXCEEDED");
  assert.equal(result.retryAfterSeconds, 46);
});

test("an explicit structured QUOTA_EXCEEDED code identifies daily quota", () => {
  const error = createApiError({
    statusCode: 429,
    data: {
      error: {
        code: "quota_exceeded",
        status: "RESOURCE_EXHAUSTED",
      },
    },
  });

  assert.equal(
    classifyProviderError(error).code,
    "AI_DAILY_QUOTA_EXCEEDED",
  );
});

test("daily quota errors are made non-retryable before AI SDK retry logic", () => {
  const dailyError = createApiError({
    statusCode: 429,
    data: googleErrorData("QUOTA_EXCEEDED"),
  });
  const genericRateLimit = createApiError({
    statusCode: 429,
    data: googleErrorData("RESOURCE_EXHAUSTED"),
  });

  const nonRetryable = preventDailyQuotaRetry(dailyError);

  assert.equal(APICallError.isInstance(nonRetryable), true);
  assert.equal(
    APICallError.isInstance(nonRetryable)
      ? nonRetryable.isRetryable
      : undefined,
    false,
  );
  assert.equal(preventDailyQuotaRetry(genericRateLimit), genericRateLimit);
  assert.equal(genericRateLimit.isRetryable, true);
});

test("Gemini availability, timeout, and configuration errors are distinct", () => {
  assert.equal(
    classifyProviderError(createApiError({ statusCode: 503 })).code,
    "AI_SERVICE_UNAVAILABLE",
  );
  assert.equal(
    classifyProviderError(createApiError({ statusCode: 504 })).code,
    "AI_REQUEST_TIMEOUT",
  );
  assert.equal(
    classifyProviderError(createApiError({ statusCode: 401 })).code,
    "AI_CONFIGURATION_ERROR",
  );
  assert.equal(
    classifyProviderError(createApiError({ statusCode: 403 })).code,
    "AI_CONFIGURATION_ERROR",
  );
  assert.equal(
    classifyProviderError(createApiError({ statusCode: 404 })).code,
    "AI_CONFIGURATION_ERROR",
  );
});

test("retryable network failures without an HTTP status are unavailable", () => {
  const error = createApiError({ isRetryable: true });

  assert.equal(
    classifyProviderError(error).code,
    "AI_SERVICE_UNAVAILABLE",
  );
});

test("client aborts and safety filtering have dedicated outcomes", () => {
  const abortError = Object.assign(new Error("request stopped"), {
    name: "AbortError",
  });

  assert.equal(
    classifyProviderError(abortError).code,
    "AI_REQUEST_CANCELLED",
  );
  assert.equal(
    classifyProviderError(createContentBlockedError()).code,
    "AI_CONTENT_BLOCKED",
  );
});

test("unknown and sensitive provider details never reach the client", () => {
  const providerError = classifyProviderError(
    new Error("raw provider failure containing secret-token"),
  );
  const serialized = serializeProviderError(providerError);

  assert.equal(providerError.code, "AI_PROVIDER_ERROR");
  assert.equal(serialized.includes("secret-token"), false);
  assert.deepEqual(JSON.parse(serialized), {
    error: {
      code: "AI_PROVIDER_ERROR",
      message: "The AI service couldn't complete the request. Please try again.",
    },
  });
});

test("the frontend maps normalized stream errors to friendly messages", () => {
  const error = new Error(
    JSON.stringify({
      error: {
        code: "AI_RATE_LIMITED",
        message: "ignored in favor of the local allowlist",
      },
    }),
  );

  assert.equal(
    getFriendlyChatError(error),
    "The AI service is temporarily busy. Please try again shortly.",
  );
});

test("an in-stream content-filter finish becomes a normalized safe error", async () => {
  const finishPart = {
    type: "finish",
    finishReason: "content-filter",
    rawFinishReason: "SAFETY",
    totalUsage: {
      inputTokens: undefined,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: undefined,
      outputTokenDetails: {
        textTokens: undefined,
        reasoningTokens: undefined,
      },
      totalTokens: undefined,
    },
  } satisfies TextStreamPart<ToolSet>;
  const source = new ReadableStream<TextStreamPart<ToolSet>>({
    start: (controller) => {
      controller.enqueue(finishPart);
      controller.close();
    },
  });
  const reader = source
    .pipeThrough(createProviderStreamTransform<ToolSet>())
    .getReader();
  const parts: TextStreamPart<ToolSet>[] = [];

  while (true) {
    const result = await reader.read();
    if (result.done) break;
    parts.push(result.value);
  }

  assert.deepEqual(
    parts.map((part) => part.type),
    ["error", "finish"],
  );
  const streamError = parts.find((part) => part.type === "error");
  assert.equal(
    classifyProviderError(streamError?.error).code,
    "AI_CONTENT_BLOCKED",
  );
});
