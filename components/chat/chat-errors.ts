const FRIENDLY_CHAT_ERRORS: Record<string, string> = {
  RATE_LIMIT_EXCEEDED:
    "Too many requests. Please wait a moment before asking another question.",
  DAILY_LIMIT_EXCEEDED:
    "You've reached today's AI demo limit. Please try again tomorrow.",
  RATE_LIMIT_SERVICE_UNAVAILABLE:
    "The AI service is temporarily unavailable. Please try again shortly.",
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
