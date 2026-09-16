import "server-only";

import { Redis } from "@upstash/redis";

let redisClient: Redis | undefined;

export const createRateLimitConfigurationError = () =>
  Object.assign(
    new Error("Rate-limit service configuration is unavailable."),
    { name: "RateLimitConfigurationError" },
  );

export const getRateLimitRedisClient = () => {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw createRateLimitConfigurationError();
  }

  redisClient = new Redis({ url, token });
  return redisClient;
};
