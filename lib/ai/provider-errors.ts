import "server-only";

import {
  APICallError,
  LoadAPIKeyError,
  NoSuchModelError,
  RetryError,
  type LanguageModelMiddleware,
  type TextStreamPart,
  type ToolSet,
} from "ai";

export type AIProviderErrorCode =
  | "AI_RATE_LIMITED"
  | "AI_DAILY_QUOTA_EXCEEDED"
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_REQUEST_TIMEOUT"
  | "AI_CONFIGURATION_ERROR"
  | "AI_CONTENT_BLOCKED"
  | "AI_REQUEST_CANCELLED"
  | "AI_PROVIDER_ERROR";

export interface AIProviderError {
  code: AIProviderErrorCode;
  category: string;
  message: string;
  status: number;
  providerStatus?: number;
  retryAfterSeconds?: number;
}

type ProviderErrorSignal = {
  type: "sql-agent-provider-error";
  code: "AI_CONTENT_BLOCKED" | "AI_PROVIDER_ERROR";
};

const ERROR_DEFINITIONS: Record<
  AIProviderErrorCode,
  Pick<AIProviderError, "category" | "message" | "status">
> = {
  AI_RATE_LIMITED: {
    category: "gemini_rate_limit",
    message: "The AI service is temporarily busy. Please try again shortly.",
    status: 429,
  },
  AI_DAILY_QUOTA_EXCEEDED: {
    category: "gemini_daily_quota",
    message:
      "The AI service has reached its daily usage limit. Please try again after the quota resets.",
    status: 429,
  },
  AI_SERVICE_UNAVAILABLE: {
    category: "gemini_service_unavailable",
    message:
      "The AI service is temporarily unavailable. Please try again shortly.",
    status: 503,
  },
  AI_REQUEST_TIMEOUT: {
    category: "gemini_request_timeout",
    message: "The AI service took too long to respond. Please try again.",
    status: 504,
  },
  AI_CONFIGURATION_ERROR: {
    category: "gemini_configuration_error",
    message:
      "The AI service is temporarily unavailable. Please try again shortly.",
    status: 502,
  },
  AI_CONTENT_BLOCKED: {
    category: "gemini_content_blocked",
    message:
      "The AI service couldn't answer that request because it was blocked by safety filters. Please rephrase it and try again.",
    status: 422,
  },
  AI_REQUEST_CANCELLED: {
    category: "ai_request_cancelled",
    message: "The AI request was cancelled.",
    status: 499,
  },
  AI_PROVIDER_ERROR: {
    category: "gemini_provider_error",
    message: "The AI service couldn't complete the request. Please try again.",
    status: 502,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorCandidates = (error: unknown) => {
  const candidates: unknown[] = [];
  const pending: unknown[] = [error];
  const visited = new Set<object>();

  while (pending.length > 0 && candidates.length < 20) {
    const candidate = pending.shift();
    candidates.push(candidate);

    if (!isRecord(candidate) || visited.has(candidate)) continue;
    visited.add(candidate);

    if (RetryError.isInstance(candidate)) {
      pending.push(candidate.lastError, ...candidate.errors.slice().reverse());
    }

    if ("cause" in candidate && candidate.cause !== undefined) {
      pending.push(candidate.cause);
    }
  }

  return candidates;
};

const getApiError = (candidates: unknown[]) =>
  candidates.find(APICallError.isInstance);

const getStructuredError = (apiError: APICallError | undefined) => {
  if (!isRecord(apiError?.data) || !isRecord(apiError.data.error)) {
    return undefined;
  }

  return apiError.data.error;
};

const getProviderCode = (structuredError: Record<string, unknown> | undefined) => {
  const code = structuredError?.code;
  const status = structuredError?.status;

  if (typeof code === "string") return code.toUpperCase();
  return typeof status === "string" ? status.toUpperCase() : undefined;
};

const getProviderStatus = (
  apiError: APICallError | undefined,
  structuredError: Record<string, unknown> | undefined,
) => {
  if (apiError?.statusCode !== undefined) return apiError.statusCode;
  return typeof structuredError?.code === "number"
    ? structuredError.code
    : undefined;
};

const collectStructuredStrings = (
  value: unknown,
  depth = 0,
  result: string[] = [],
) => {
  if (depth > 6 || result.length >= 100) return result;

  if (typeof value === "string") {
    result.push(value);
    return result;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredStrings(item, depth + 1, result));
    return result;
  }

  if (isRecord(value)) {
    Object.entries(value).forEach(([key, item]) => {
      result.push(key);
      collectStructuredStrings(item, depth + 1, result);
    });
  }

  return result;
};

const isConfirmedDailyQuota = (
  structuredError: Record<string, unknown> | undefined,
) => {
  const providerCode = getProviderCode(structuredError);
  if (providerCode === "QUOTA_EXCEEDED") return true;

  const details = structuredError?.details;
  if (!Array.isArray(details)) return false;

  return details.some((detail) => {
    if (!isRecord(detail)) return false;

    const detailType = detail["@type"];
    if (
      typeof detailType !== "string" ||
      !detailType.endsWith("google.rpc.QuotaFailure")
    ) {
      return false;
    }

    return collectStructuredStrings(detail).some((value) => {
      const normalizedValue = value.toLowerCase().replace(/[^a-z]/g, "");
      return (
        normalizedValue.includes("daily") ||
        normalizedValue.includes("perday")
      );
    });
  });
};

const readHeader = (
  headers: Record<string, string> | undefined,
  requestedName: string,
) =>
  Object.entries(headers ?? {}).find(
    ([name]) => name.toLowerCase() === requestedName,
  )?.[1];

const parseRetryAfterHeader = (
  headers: Record<string, string> | undefined,
  now: number,
) => {
  const retryAfterMilliseconds = readHeader(headers, "retry-after-ms");
  if (retryAfterMilliseconds !== undefined) {
    const milliseconds = Number(retryAfterMilliseconds);
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      return Math.ceil(milliseconds / 1_000);
    }
  }

  const retryAfter = readHeader(headers, "retry-after");
  if (retryAfter === undefined) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const date = Date.parse(retryAfter);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.ceil((date - now) / 1_000));
};

const parseGoogleDuration = (value: unknown) => {
  if (typeof value === "string") {
    const match = /^(\d+)(?:\.(\d+))?s$/.exec(value);
    if (!match) return undefined;

    const wholeSeconds = Number(match[1]);
    const fractionalSeconds = Number(`0.${match[2] ?? "0"}`);
    return Math.ceil(wholeSeconds + fractionalSeconds);
  }

  if (!isRecord(value)) return undefined;

  const seconds = Number(value.seconds ?? 0);
  const nanoseconds = Number(value.nanos ?? 0);
  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(nanoseconds) ||
    seconds < 0 ||
    nanoseconds < 0
  ) {
    return undefined;
  }

  return Math.ceil(seconds + nanoseconds / 1_000_000_000);
};

const parseRetryInfo = (structuredError: Record<string, unknown> | undefined) => {
  const details = structuredError?.details;
  if (!Array.isArray(details)) return undefined;

  for (const detail of details) {
    if (
      isRecord(detail) &&
      typeof detail["@type"] === "string" &&
      detail["@type"].endsWith("google.rpc.RetryInfo")
    ) {
      const retryAfterSeconds = parseGoogleDuration(
        detail.retryDelay ?? detail.retry_delay,
      );
      if (retryAfterSeconds !== undefined) return retryAfterSeconds;
    }
  }

  return undefined;
};

const isProviderErrorSignal = (error: unknown): error is ProviderErrorSignal =>
  isRecord(error) &&
  error.type === "sql-agent-provider-error" &&
  (error.code === "AI_CONTENT_BLOCKED" || error.code === "AI_PROVIDER_ERROR");

const createNormalizedError = (
  code: AIProviderErrorCode,
  providerStatus?: number,
  retryAfterSeconds?: number,
): AIProviderError => ({
  code,
  ...ERROR_DEFINITIONS[code],
  ...(providerStatus !== undefined ? { providerStatus } : {}),
  ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
});

export const createContentBlockedError = (): ProviderErrorSignal => ({
  type: "sql-agent-provider-error",
  code: "AI_CONTENT_BLOCKED",
});

export const createInvalidProviderResponseError = (): ProviderErrorSignal => ({
  type: "sql-agent-provider-error",
  code: "AI_PROVIDER_ERROR",
});

export const createProviderStreamTransform = <TOOLS extends ToolSet>() => {
  let hasStreamError = false;

  return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
    transform: (part, controller) => {
      if (part.type === "error") hasStreamError = true;

      if (part.type === "finish" && !hasStreamError) {
        if (part.finishReason === "content-filter") {
          controller.enqueue({
            type: "error",
            error: createContentBlockedError(),
          });
          hasStreamError = true;
        } else if (part.finishReason === "error") {
          controller.enqueue({
            type: "error",
            error: createInvalidProviderResponseError(),
          });
          hasStreamError = true;
        }
      }

      controller.enqueue(part);
    },
  });
};

export const classifyProviderError = (
  error: unknown,
  now = Date.now(),
): AIProviderError => {
  if (isProviderErrorSignal(error)) return createNormalizedError(error.code);

  const candidates = getErrorCandidates(error);
  const apiError = getApiError(candidates);
  const structuredError = getStructuredError(apiError);
  const providerStatus = getProviderStatus(apiError, structuredError);
  const providerCode = getProviderCode(structuredError);
  const retryAfterSeconds =
    parseRetryAfterHeader(apiError?.responseHeaders, now) ??
    parseRetryInfo(structuredError);

  const isCancelled =
    providerStatus === 499 ||
    providerCode === "CANCELLED" ||
    candidates.some(
      (candidate) =>
        (RetryError.isInstance(candidate) && candidate.reason === "abort") ||
        (candidate instanceof Error && candidate.name === "AbortError"),
    );

  if (isCancelled) {
    return createNormalizedError("AI_REQUEST_CANCELLED", providerStatus);
  }

  if (providerCode === "QUOTA_EXCEEDED") {
    return createNormalizedError(
      "AI_DAILY_QUOTA_EXCEEDED",
      providerStatus,
      retryAfterSeconds,
    );
  }

  if (
    providerStatus === 429 ||
    providerCode === "RATE_LIMIT_EXCEEDED" ||
    providerCode === "TOO_MANY_REQUESTS" ||
    providerCode === "RESOURCE_EXHAUSTED"
  ) {
    return createNormalizedError(
      isConfirmedDailyQuota(structuredError)
        ? "AI_DAILY_QUOTA_EXCEEDED"
        : "AI_RATE_LIMITED",
      providerStatus,
      retryAfterSeconds,
    );
  }

  if (
    providerStatus === 408 ||
    providerStatus === 504 ||
    providerCode === "DEADLINE_EXCEEDED"
  ) {
    return createNormalizedError(
      "AI_REQUEST_TIMEOUT",
      providerStatus,
      retryAfterSeconds,
    );
  }

  if (
    candidates.some(LoadAPIKeyError.isInstance) ||
    candidates.some(NoSuchModelError.isInstance) ||
    providerStatus === 401 ||
    providerStatus === 403 ||
    providerStatus === 404 ||
    providerCode === "AUTHENTICATION" ||
    providerCode === "PERMISSION_DENIED" ||
    providerCode === "NOT_FOUND" ||
    providerCode === "MODEL_NOT_FOUND"
  ) {
    return createNormalizedError("AI_CONFIGURATION_ERROR", providerStatus);
  }

  if (
    providerStatus === 409 ||
    (providerStatus !== undefined && providerStatus >= 500) ||
    providerCode === "ABORTED" ||
    providerCode === "API_ERROR" ||
    providerCode === "UNIMPLEMENTED" ||
    providerCode === "SERVICE_UNAVAILABLE" ||
    (apiError !== undefined && providerStatus === undefined && apiError.isRetryable)
  ) {
    return createNormalizedError(
      "AI_SERVICE_UNAVAILABLE",
      providerStatus,
      retryAfterSeconds,
    );
  }

  return createNormalizedError("AI_PROVIDER_ERROR", providerStatus);
};

export const serializeProviderError = (error: AIProviderError) =>
  JSON.stringify({
    error: {
      code: error.code,
      message: error.message,
      ...(error.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: error.retryAfterSeconds }
        : {}),
    },
  });

export const getProviderErrorHeaders = (error: AIProviderError) =>
  error.retryAfterSeconds === undefined
    ? undefined
    : { "Retry-After": String(error.retryAfterSeconds) };

export const preventDailyQuotaRetry = (error: unknown) => {
  if (classifyProviderError(error).code !== "AI_DAILY_QUOTA_EXCEEDED") {
    return error;
  }

  const apiError = getApiError(getErrorCandidates(error));
  if (!apiError || !apiError.isRetryable) return error;

  return new APICallError({
    message: apiError.message,
    url: apiError.url,
    requestBodyValues: apiError.requestBodyValues,
    statusCode: apiError.statusCode,
    responseHeaders: apiError.responseHeaders,
    responseBody: apiError.responseBody,
    cause: apiError.cause,
    data: apiError.data,
    isRetryable: false,
  });
};

export const createGeminiErrorMiddleware = (): LanguageModelMiddleware => ({
  wrapGenerate: async ({ doGenerate }) => {
    try {
      return await doGenerate();
    } catch (error) {
      throw preventDailyQuotaRetry(error);
    }
  },
  wrapStream: async ({ doStream }) => {
    try {
      return await doStream();
    } catch (error) {
      throw preventDailyQuotaRetry(error);
    }
  },
});
