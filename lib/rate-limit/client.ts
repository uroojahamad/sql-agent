import "server-only";

import { Redis } from "@upstash/redis";

let redisClient: Redis | undefined;

export class RateLimitConfigurationError extends Error {
  constructor() {
    super("Rate-limit service configuration is unavailable.");
    this.name = "RateLimitConfigurationError";
  }
}

export const getRateLimitRedisClient = () => {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    throw new RateLimitConfigurationError();
  }

  redisClient = new Redis({ url, token });
  return redisClient;
};
