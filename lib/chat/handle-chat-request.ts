import "server-only";

import { google } from "@ai-sdk/google";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  type InferUITools,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import {
  createSqlAgentTools,
  type SqlAgentTools,
} from "@/database/ai-tools";
import { createSqlAgentSystemPrompt } from "@/database/sql-agent-prompt";
import {
  checkChatRateLimit,
  type ChatRateLimitDecision,
} from "@/lib/rate-limit/chat-rate-limit";
import { getRateLimitIdentifier } from "@/lib/rate-limit/identifier";
import {
  validateBasicChatRequest,
  validateChatRequestSize,
} from "./request-validation";

const SAFE_STREAM_ERROR =
  "I couldn't complete that request right now. Please try again.";
const RATE_LIMIT_SERVICE_ERROR =
  "The AI service is temporarily unavailable. Please try again shortly.";

type SqlAgentUIMessage = UIMessage<
  unknown,
  Record<string, unknown>,
  InferUITools<SqlAgentTools>
>;

interface RunAgentOptions {
  request: Request;
  requestId: string;
  messages: SqlAgentUIMessage[];
  tools: SqlAgentTools;
}

interface ChatRequestDependencies {
  checkRateLimit: (options: {
    identifier: string;
    requestId: string;
  }) => Promise<ChatRateLimitDecision>;
  createTools: typeof createSqlAgentTools;
  getIdentifier: typeof getRateLimitIdentifier;
  runAgent: (options: RunAgentOptions) => Response | Promise<Response>;
}

interface ApiErrorBody {
  code:
    | "INVALID_REQUEST"
    | "MESSAGE_TOO_LONG"
    | "CONVERSATION_TOO_LARGE"
    | "RATE_LIMIT_EXCEEDED"
    | "DAILY_LIMIT_EXCEEDED"
    | "RATE_LIMIT_SERVICE_UNAVAILABLE"
    | "INTERNAL_ERROR";
  message: string;
  retryAfterSeconds?: number;
}

const baseHeaders = (requestId: string) => ({
  "Cache-Control": "no-store",
  "X-Request-Id": requestId,
});

const errorResponse = (
  status: number,
  error: ApiErrorBody,
  requestId: string,
  headers?: HeadersInit,
) =>
  Response.json(
    { error, requestId },
    {
      status,
      headers: { ...baseHeaders(requestId), ...headers },
    },
  );

const logRouteError = (requestId: string, errorCategory: string) => {
  console.error("[sql-agent:route]", {
    requestId,
    status: "error",
    errorCategory,
  });
};

const runSqlAgent = async ({
  request,
  requestId,
  messages,
  tools,
}: RunAgentOptions) => {
  const result = streamText({
    model: google("gemini-3.5-flash-lite"),
    instructions: createSqlAgentSystemPrompt(),
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: isStepCount(5),
    abortSignal: request.signal,
    onError: () => logRouteError(requestId, "model_stream_failed"),
  });

  return createUIMessageStreamResponse({
    headers: baseHeaders(requestId),
    stream: toUIMessageStream({
      stream: result.stream,
      onError: () => SAFE_STREAM_ERROR,
    }),
  });
};

const defaultDependencies: ChatRequestDependencies = {
  checkRateLimit: checkChatRateLimit,
  createTools: createSqlAgentTools,
  getIdentifier: getRateLimitIdentifier,
  runAgent: runSqlAgent,
};

const rateLimitHeaders = (
  decision: Extract<ChatRateLimitDecision, { allowed: false }>,
) => ({
  "Retry-After": String(decision.retryAfterSeconds),
  "X-RateLimit-Limit": String(decision.metadata.limit),
  "X-RateLimit-Remaining": String(decision.metadata.remaining),
  "X-RateLimit-Reset": String(Math.ceil(decision.metadata.reset / 1_000)),
});

export const handleChatRequest = async (
  request: Request,
  dependencyOverrides: Partial<ChatRequestDependencies> = {},
) => {
  const requestId = crypto.randomUUID();
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      {
        code: "INVALID_REQUEST",
        message: "The request body must be valid JSON.",
      },
      requestId,
    );
  }

  const basicValidation = validateBasicChatRequest(body);
  if (!basicValidation.valid) {
    return errorResponse(
      400,
      {
        code: basicValidation.code,
        message: basicValidation.message,
      },
      requestId,
    );
  }

  let rateLimitDecision: ChatRateLimitDecision;
  try {
    rateLimitDecision = await dependencies.checkRateLimit({
      identifier: dependencies.getIdentifier(request),
      requestId,
    });
  } catch (error) {
    logRouteError(
      requestId,
      error instanceof Error
        ? `rate_limit_service_unavailable:${error.name}`
        : "rate_limit_service_unavailable:UnknownError",
    );
    return errorResponse(
      503,
      {
        code: "RATE_LIMIT_SERVICE_UNAVAILABLE",
        message: RATE_LIMIT_SERVICE_ERROR,
      },
      requestId,
    );
  }

  if (!rateLimitDecision.allowed) {
    const isBurstLimit = rateLimitDecision.type === "burst";
    return errorResponse(
      429,
      {
        code: isBurstLimit
          ? "RATE_LIMIT_EXCEEDED"
          : "DAILY_LIMIT_EXCEEDED",
        message: isBurstLimit
          ? "Too many requests. Please wait a moment before asking another question."
          : "You've reached today's AI demo limit. Please try again tomorrow.",
        retryAfterSeconds: rateLimitDecision.retryAfterSeconds,
      },
      requestId,
      rateLimitHeaders(rateLimitDecision),
    );
  }

  const sizeValidation = validateChatRequestSize(basicValidation.messages);
  if (!sizeValidation.valid) {
    return errorResponse(
      400,
      {
        code: sizeValidation.code,
        message: sizeValidation.message,
      },
      requestId,
    );
  }

  let tools: SqlAgentTools;
  let validatedMessages: Awaited<
    ReturnType<typeof safeValidateUIMessages<SqlAgentUIMessage>>
  >;

  try {
    tools = dependencies.createTools({ requestId });
    validatedMessages = await safeValidateUIMessages<SqlAgentUIMessage>({
      messages: sizeValidation.messages,
      tools,
    });
  } catch {
    logRouteError(requestId, "message_validation_failed");
    return errorResponse(
      500,
      { code: "INTERNAL_ERROR", message: SAFE_STREAM_ERROR },
      requestId,
    );
  }

  if (
    !validatedMessages.success ||
    validatedMessages.data.some((message) => message.role === "system")
  ) {
    return errorResponse(
      400,
      {
        code: "INVALID_REQUEST",
        message: "The chat messages are invalid.",
      },
      requestId,
    );
  }

  try {
    return await dependencies.runAgent({
      request,
      requestId,
      messages: validatedMessages.data,
      tools,
    });
  } catch {
    logRouteError(requestId, "request_orchestration_failed");
    return errorResponse(
      500,
      { code: "INTERNAL_ERROR", message: SAFE_STREAM_ERROR },
      requestId,
    );
  }
};
