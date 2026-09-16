import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { getRateLimitRedisClient } from "./client";

export const DEFAULT_CHAT_RATE_LIMITS = {
  burst: 10,
  daily: 50,
} as const;

export interface RateLimitMetadata {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimiter {
  limit: (identifier: string) => Promise<RateLimitMetadata>;
}

interface ChatRateLimitClients {
  burst: RateLimiter;
  daily: RateLimiter;
}

interface CheckChatRateLimitOptions {
  identifier: string;
  requestId: string;
  now?: () => number;
}

export type ChatRateLimitDecision =
  | {
      allowed: true;
      burst: RateLimitMetadata;
      daily: RateLimitMetadata;
    }
  | {
      allowed: false;
      type: "burst" | "daily";
      metadata: RateLimitMetadata;
      retryAfterSeconds: number;
    };

export const createRateLimitServiceError = (options?: ErrorOptions) =>
  Object.assign(new Error("Rate-limit service is unavailable.", options), {
    name: "RateLimitServiceError",
  });

const readPositiveInteger = (value: string | undefined, fallback: number) => {
  if (!value) return fallback;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getChatRateLimitConfig = () => ({
  burst: readPositiveInteger(
    process.env.CHAT_RATE_LIMIT_BURST_MAX,
    DEFAULT_CHAT_RATE_LIMITS.burst,
  ),
  daily: readPositiveInteger(
    process.env.CHAT_RATE_LIMIT_DAILY_MAX,
    DEFAULT_CHAT_RATE_LIMITS.daily,
  ),
});

const logRateLimit = (
  requestId: string,
  type: "burst" | "daily",
  status: "allowed" | "blocked" | "error",
  metadata?: Pick<RateLimitMetadata, "remaining" | "reset">,
  error?: unknown,
) => {
  const logData = {
    requestId,
    rateLimitType: type,
    status,
    remaining: metadata?.remaining,
    reset: metadata?.reset,
    timestamp: new Date().toISOString(),
    errorCategory:
      error instanceof Error ? error.name : error ? "UnknownError" : undefined,
  };

  if (status === "error") {
    console.error("[sql-agent:rate-limit]", logData);
  } else {
    console.info("[sql-agent:rate-limit]", logData);
  }
};

const checkLimit = async (
  limiter: RateLimiter,
  identifier: string,
  requestId: string,
  type: "burst" | "daily",
) => {
  try {
    const result = await limiter.limit(identifier);
    logRateLimit(
      requestId,
      type,
      result.success ? "allowed" : "blocked",
      result,
    );
    return result;
  } catch (error) {
    logRateLimit(requestId, type, "error", undefined, error);
    throw createRateLimitServiceError({ cause: error });
  }
};

const retryAfterSeconds = (reset: number, now: number) =>
  Math.max(1, Math.ceil((reset - now) / 1_000));

export const checkChatRateLimitWithClients = async (
  clients: ChatRateLimitClients,
  {
    identifier,
    requestId,
    now = Date.now,
  }: CheckChatRateLimitOptions,
): Promise<ChatRateLimitDecision> => {
  const burst = await checkLimit(
    clients.burst,
    identifier,
    requestId,
    "burst",
  );

  if (!burst.success) {
    return {
      allowed: false,
      type: "burst",
      metadata: burst,
      retryAfterSeconds: retryAfterSeconds(burst.reset, now()),
    };
  }

  const daily = await checkLimit(
    clients.daily,
    identifier,
    requestId,
    "daily",
  );

  if (!daily.success) {
    return {
      allowed: false,
      type: "daily",
      metadata: daily,
      retryAfterSeconds: retryAfterSeconds(daily.reset, now()),
    };
  }

  return { allowed: true, burst, daily };
};

let rateLimitClients: ChatRateLimitClients | undefined;

const getChatRateLimitClients = () => {
  if (rateLimitClients) return rateLimitClients;

  const redis = getRateLimitRedisClient();
  const limits = getChatRateLimitConfig();

  rateLimitClients = {
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limits.burst, "1 m"),
      prefix: "sql-agent:burst",
      ephemeralCache: false,
    }),
    daily: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limits.daily, "1 d"),
      prefix: "sql-agent:daily",
      ephemeralCache: false,
    }),
  };

  return rateLimitClients;
};

export const checkChatRateLimit = (options: CheckChatRateLimitOptions) =>
  checkChatRateLimitWithClients(getChatRateLimitClients(), options);
