import "server-only";

export const CHAT_REQUEST_LIMITS = {
  messages: 50,
  userMessageCharacters: 1_000,
  totalTextCharacters: 10_000,
} as const;

export type ChatRequestErrorCode =
  | "INVALID_REQUEST"
  | "MESSAGE_TOO_LONG"
  | "CONVERSATION_TOO_LARGE";

export type ChatRequestValidationResult =
  | { valid: true; messages: unknown[] }
  | {
      valid: false;
      code: ChatRequestErrorCode;
      message: string;
    };

const invalidRequest = (): ChatRequestValidationResult => ({
  valid: false,
  code: "INVALID_REQUEST",
  message: `The request must contain between 1 and ${CHAT_REQUEST_LIMITS.messages} messages.`,
});

export const validateBasicChatRequest = (
  body: unknown,
): ChatRequestValidationResult => {
  if (
    typeof body !== "object" ||
    body === null ||
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > CHAT_REQUEST_LIMITS.messages
  ) {
    return invalidRequest();
  }

  if (
    body.messages.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        message.role === "system",
    )
  ) {
    return {
      valid: false,
      code: "INVALID_REQUEST",
      message: "System messages are not accepted from clients.",
    };
  }

  return { valid: true, messages: body.messages };
};

const getUserMessageTextLength = (message: unknown) => {
  if (
    typeof message !== "object" ||
    message === null ||
    !("role" in message) ||
    message.role !== "user"
  ) {
    return 0;
  }

  let length = 0;

  if ("content" in message && typeof message.content === "string") {
    length += message.content.length;
  }

  if ("parts" in message && Array.isArray(message.parts)) {
    for (const part of message.parts) {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        length += part.text.length;
      }
    }
  }

  return length;
};

const getTotalStringLength = (value: unknown) => {
  const queue: unknown[] = [value];
  let total = 0;

  while (queue.length > 0) {
    const current = queue.pop();

    if (typeof current === "string") {
      total += current.length;
      if (total > CHAT_REQUEST_LIMITS.totalTextCharacters) return total;
      continue;
    }

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    if (typeof current === "object" && current !== null) {
      queue.push(...Object.values(current));
    }
  }

  return total;
};

export const validateChatRequestSize = (
  messages: unknown[],
): ChatRequestValidationResult => {
  if (
    messages.some(
      (message) =>
        getUserMessageTextLength(message) >
        CHAT_REQUEST_LIMITS.userMessageCharacters,
    )
  ) {
    return {
      valid: false,
      code: "MESSAGE_TOO_LONG",
      message:
        "Your message is too long. Please shorten your question and try again.",
    };
  }

  if (getTotalStringLength(messages) > CHAT_REQUEST_LIMITS.totalTextCharacters) {
    return {
      valid: false,
      code: "CONVERSATION_TOO_LARGE",
      message:
        "This conversation has become too long. Please start a new chat or shorten the conversation.",
    };
  }

  return { valid: true, messages };
};
