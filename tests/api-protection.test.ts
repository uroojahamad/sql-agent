import assert from "node:assert/strict";
import test from "node:test";
import nextEnv from "@next/env";
import { APICallError } from "ai";
import type { SqlAgentTools } from "../database/ai-tools";
import {
  checkChatRateLimitWithClients,
  DEFAULT_CHAT_RATE_LIMITS,
  type ChatRateLimitDecision,
  type RateLimitMetadata,
} from "../lib/rate-limit/chat-rate-limit";
import { getRateLimitIdentifier } from "../lib/rate-limit/identifier";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const getHandleChatRequest = async () =>
  (await import("../lib/chat/handle-chat-request")).handleChatRequest;

const reset = 2_000_000;

const metadata = (
  success: boolean,
  overrides: Partial<RateLimitMetadata> = {},
): RateLimitMetadata => ({
  success,
  limit: 10,
  remaining: success ? 9 : 0,
  reset,
  ...overrides,
});

const allowedDecision: ChatRateLimitDecision = {
  allowed: true,
  burst: metadata(true),
  daily: metadata(true, { limit: 50, remaining: 49 }),
};

const createRequest = (messages: unknown[]) =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

const textMessage = (role: "user" | "assistant", text: string) => ({
  id: `${role}-${text.length}`,
  role,
  parts: [{ type: "text", text }],
});

const readErrorCode = async (response: Response) => {
  const body = (await response.json()) as {
    error: { code: string; message: string; retryAfterSeconds?: number };
  };
  return body.error;
};

const createProtectedDependencies = (
  checkRateLimit: () => Promise<ChatRateLimitDecision>,
) => {
  const calls = { tools: 0, model: 0 };

  return {
    calls,
    dependencies: {
      checkRateLimit,
      getIdentifier: () => "anonymous:test",
      createTools: () => {
        calls.tools += 1;
        return {} as SqlAgentTools;
      },
      runAgent: async () => {
        calls.model += 1;
        return new Response("model-called");
      },
    },
  };
};

test("production rate-limit defaults remain 10 per minute and 50 per day", () => {
  assert.deepEqual(DEFAULT_CHAT_RATE_LIMITS, { burst: 10, daily: 50 });
});

test("requests within both limits are allowed", async () => {
  let burstCalls = 0;
  let dailyCalls = 0;

  const result = await checkChatRateLimitWithClients(
    {
      burst: {
        limit: async () => {
          burstCalls += 1;
          return metadata(true);
        },
      },
      daily: {
        limit: async () => {
          dailyCalls += 1;
          return metadata(true, { limit: 50, remaining: 49 });
        },
      },
    },
    { identifier: "anonymous:test", requestId: "request-allowed" },
  );

  assert.equal(result.allowed, true);
  assert.equal(burstCalls, 1);
  assert.equal(dailyCalls, 1);
});

test("a blocked burst limit short-circuits the daily limiter", async () => {
  let dailyCalls = 0;

  const result = await checkChatRateLimitWithClients(
    {
      burst: { limit: async () => metadata(false) },
      daily: {
        limit: async () => {
          dailyCalls += 1;
          return metadata(true, { limit: 50 });
        },
      },
    },
    {
      identifier: "anonymous:test",
      requestId: "request-burst-blocked",
      now: () => reset - 42_000,
    },
  );

  assert.equal(result.allowed, false);
  assert.equal(result.allowed ? undefined : result.type, "burst");
  assert.equal(result.allowed ? undefined : result.retryAfterSeconds, 42);
  assert.equal(dailyCalls, 0);
});

test("a blocked daily limit is returned after burst allowance", async () => {
  const result = await checkChatRateLimitWithClients(
    {
      burst: { limit: async () => metadata(true) },
      daily: {
        limit: async () => metadata(false, { limit: 50, remaining: 0 }),
      },
    },
    {
      identifier: "anonymous:test",
      requestId: "request-daily-blocked",
      now: () => reset - 3_600_000,
    },
  );

  assert.equal(result.allowed, false);
  assert.equal(result.allowed ? undefined : result.type, "daily");
  assert.equal(result.allowed ? undefined : result.retryAfterSeconds, 3_600);
});

test("burst-limit rejection returns 429 before tools or Gemini", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const blocked: ChatRateLimitDecision = {
    allowed: false,
    type: "burst",
    metadata: metadata(false),
    retryAfterSeconds: 42,
  };
  const { calls, dependencies } = createProtectedDependencies(async () => blocked);

  const response = await handleChatRequest(
    createRequest([textMessage("user", "What is our top-selling product?")]),
    dependencies,
  );
  const error = await readErrorCode(response);

  assert.equal(response.status, 429);
  assert.equal(error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(error.retryAfterSeconds, 42);
  assert.equal(response.headers.get("Retry-After"), "42");
  assert.equal(response.headers.get("X-RateLimit-Limit"), "10");
  assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
  assert.equal(response.headers.get("X-RateLimit-Reset"), "2000");
  assert.deepEqual(calls, { tools: 0, model: 0 });
});

test("daily-limit rejection returns 429 before tools or Gemini", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const blocked: ChatRateLimitDecision = {
    allowed: false,
    type: "daily",
    metadata: metadata(false, { limit: 50 }),
    retryAfterSeconds: 3_600,
  };
  const { calls, dependencies } = createProtectedDependencies(async () => blocked);

  const response = await handleChatRequest(
    createRequest([textMessage("user", "Show recent sales")]),
    dependencies,
  );
  const error = await readErrorCode(response);

  assert.equal(response.status, 429);
  assert.equal(error.code, "DAILY_LIMIT_EXCEEDED");
  assert.deepEqual(calls, { tools: 0, model: 0 });
});

test("an oversized user message is rejected before tools or Gemini", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const { calls, dependencies } = createProtectedDependencies(
    async () => allowedDecision,
  );

  const response = await handleChatRequest(
    createRequest([textMessage("user", "x".repeat(1_001))]),
    dependencies,
  );
  const error = await readErrorCode(response);

  assert.equal(response.status, 400);
  assert.equal(error.code, "MESSAGE_TOO_LONG");
  assert.deepEqual(calls, { tools: 0, model: 0 });
});

test("an oversized conversation is rejected before tools or Gemini", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const { calls, dependencies } = createProtectedDependencies(
    async () => allowedDecision,
  );
  const messages = [textMessage("user", "Summarize our sales")];

  for (let index = 0; index < 11; index += 1) {
    messages.push(textMessage("assistant", "x".repeat(950)));
  }

  const response = await handleChatRequest(createRequest(messages), dependencies);
  const error = await readErrorCode(response);

  assert.equal(response.status, 400);
  assert.equal(error.code, "CONVERSATION_TOO_LARGE");
  assert.deepEqual(calls, { tools: 0, model: 0 });
});

test("a limiter infrastructure failure fails closed before tools or Gemini", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const { calls, dependencies } = createProtectedDependencies(async () => {
    throw new Error("Redis unavailable");
  });

  const response = await handleChatRequest(
    createRequest([textMessage("user", "Show revenue")]),
    dependencies,
  );
  const error = await readErrorCode(response);

  assert.equal(response.status, 503);
  assert.equal(error.code, "RATE_LIMIT_SERVICE_UNAVAILABLE");
  assert.deepEqual(calls, { tools: 0, model: 0 });
});

test("a pre-stream Gemini quota failure returns a safe normalized response", async () => {
  const handleChatRequest = await getHandleChatRequest();
  const { calls, dependencies } = createProtectedDependencies(
    async () => allowedDecision,
  );
  dependencies.runAgent = async () => {
    calls.model += 1;
    throw new APICallError({
      message: "raw quota error containing secret-token",
      url: "https://generativelanguage.googleapis.com/test",
      requestBodyValues: { sensitive: "request-data" },
      statusCode: 429,
      responseHeaders: { "retry-after": "30" },
      responseBody: "raw response containing secret-token",
      data: {
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          details: [
            {
              "@type": "type.googleapis.com/google.rpc.QuotaFailure",
              violations: [
                {
                  quotaId:
                    "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                },
              ],
            },
          ],
        },
      },
    });
  };

  const response = await handleChatRequest(
    createRequest([textMessage("user", "Show revenue")]),
    dependencies,
  );
  const responseText = await response.text();
  const body = JSON.parse(responseText) as {
    error: { code: string; message: string; retryAfterSeconds?: number };
  };

  assert.equal(response.status, 429);
  assert.equal(body.error.code, "AI_DAILY_QUOTA_EXCEEDED");
  assert.equal(body.error.retryAfterSeconds, 30);
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.equal(responseText.includes("secret-token"), false);
  assert.deepEqual(calls, { tools: 1, model: 1 });
});

test("client identity trusts Vercel forwarding headers only on Vercel", () => {
  const address = "203.0.113.42";
  const request = new Request("http://localhost/api/chat", {
    headers: { "x-vercel-forwarded-for": address },
  });

  const localIdentifier = getRateLimitIdentifier(request, { isVercel: false });
  const vercelIdentifier = getRateLimitIdentifier(request, { isVercel: true });

  assert.equal(localIdentifier, "anonymous:local");
  assert.match(vercelIdentifier, /^ip:[a-f0-9]{64}$/);
  assert.equal(vercelIdentifier.includes(address), false);
});
