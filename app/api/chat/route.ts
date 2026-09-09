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

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGES_PER_REQUEST = 50;
const SAFE_STREAM_ERROR = "I couldn't complete that request right now. Please try again.";

type SqlAgentUIMessage = UIMessage<
  unknown,
  Record<string, unknown>,
  InferUITools<SqlAgentTools>
>;

const logRouteError = (requestId: string, errorCategory: string) => {
  console.error("[sql-agent:route]", {
    requestId,
    status: "error",
    errorCategory,
  });
};

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await request.json();
  } 
  catch {
    return Response.json(
      { error: "The request body must be valid JSON.", requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > MAX_MESSAGES_PER_REQUEST
  ) {
    return Response.json(
      {
        error: `The request must contain between 1 and ${MAX_MESSAGES_PER_REQUEST} messages.`,
        requestId,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const tools = createSqlAgentTools({ requestId });
  const validatedMessages = await safeValidateUIMessages<SqlAgentUIMessage>({
    messages: body.messages,
    tools,
  });

  if (!validatedMessages.success) {
    return Response.json(
      { error: "The chat messages are invalid.", requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (validatedMessages.data.some((message) => message.role === "system")) {
    return Response.json(
      { error: "System messages are not accepted from clients.", requestId },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = streamText({
      model: google("gemini-3.5-flash-lite"),
      instructions: createSqlAgentSystemPrompt(),
      messages: await convertToModelMessages(validatedMessages.data, { tools }),
      tools,
      stopWhen: isStepCount(5),
      abortSignal: request.signal,
      onError: () => logRouteError(requestId, "model_stream_failed"),
    });

    return createUIMessageStreamResponse({
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
      stream: toUIMessageStream({
        stream: result.stream,
        onError: () => SAFE_STREAM_ERROR,
      }),
    });
  } 
  catch {
    logRouteError(requestId, "request_orchestration_failed");

    return Response.json(
      { error: SAFE_STREAM_ERROR, requestId },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
