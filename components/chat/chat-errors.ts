const FRIENDLY_CHAT_ERRORS: Record<string, string> = {
  RATE_LIMIT_EXCEEDED:
    "Too many requests. Please wait a moment and try again.",
  DAILY_LIMIT_EXCEEDED:
    "You've reached today's demo usage limit. Please try again tomorrow.",
  RATE_LIMIT_SERVICE_UNAVAILABLE:
    "The AI service is temporarily unavailable. Please try again shortly.",
  AI_RATE_LIMITED:
    "The AI service is temporarily busy. Please try again shortly.",
  AI_DAILY_QUOTA_EXCEEDED:
    "The AI service has reached its daily usage limit. Please try again after the quota resets.",
  AI_SERVICE_UNAVAILABLE:
    "The AI service is temporarily unavailable. Please try again shortly.",
  AI_REQUEST_TIMEOUT:
    "The AI service took too long to respond. Please try again.",
  AI_CONFIGURATION_ERROR:
    "The AI service is temporarily unavailable. Please try again shortly.",
  AI_CONTENT_BLOCKED:
    "The AI service couldn't answer that request because it was blocked by safety filters. Please rephrase it and try again.",
  AI_REQUEST_CANCELLED: "The AI request was cancelled.",
  AI_PROVIDER_ERROR:
    "The AI service couldn't complete the request. Please try again.",
  MESSAGE_TOO_LONG:
    "Your message is too long. Please shorten your question and try again.",
  CONVERSATION_TOO_LARGE:
    "This conversation has become too long. Please start a new chat or shorten the conversation.",
  INVALID_REQUEST: "The chat request is invalid. Please try again.",
};

const DEFAULT_CHAT_ERROR =
  "Something went wrong while generating the response.";

export const getFriendlyChatError = (error: Error | undefined) => {
  if (!error) return DEFAULT_CHAT_ERROR;

  try {
    const payload = JSON.parse(error.message) as {
      error?: { code?: unknown };
    };
    const code = payload.error?.code;

    return typeof code === "string" && code in FRIENDLY_CHAT_ERRORS
      ? FRIENDLY_CHAT_ERRORS[code]
      : DEFAULT_CHAT_ERROR;
  } catch {
    return DEFAULT_CHAT_ERROR;
  }
};
