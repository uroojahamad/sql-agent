"use client";

import { useChat } from "@ai-sdk/react";
import { getToolName, isToolUIPart } from "ai";
import { useMemo, useState } from "react";
import {
  ChatWorkspace,
  type ChatMessageViewModel,
  type ChatPromptOption,
  type ChatToolActivity,
  type RecentQuery,
} from "@/components/chat";

const suggestions: ChatPromptOption[] = [
  {
    title: "Analyze revenue",
    description: "How much revenue did we make in August 2026?",
    prompt: "How much revenue did we make in August 2026?",
    icon: "chart",
  },
  {
    title: "Find products",
    description: "Find products related to audio",
    prompt: "Find products related to audio.",
    icon: "search",
  },
  {
    title: "Explore recent sales",
    description: "Show the 10 most recent sales",
    prompt: "Show the 10 most recent sales.",
    icon: "sales",
  },
];

const recentQueries: RecentQuery[] = [
  {
    label: "Monthly revenue analysis",
    prompt: "How much revenue did we make in August 2026?",
  },
  {
    label: "Top-performing products",
    prompt: "Which product generated the most revenue in August 2026?",
  },
  {
    label: "Recent sales overview",
    prompt: "Show the 10 most recent sales.",
  },
];

const toolRowCount = (output: unknown) => {
  if (
    typeof output === "object" &&
    output !== null &&
    "meta" in output &&
    typeof output.meta === "object" &&
    output.meta !== null &&
    "rowCount" in output.meta &&
    typeof output.meta.rowCount === "number"
  ) {
    return output.meta.rowCount;
  }

  return undefined;
};

export default function Chat() {
  const [input, setInput] = useState("");
  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    regenerate,
    clearError,
  } = useChat();

  const viewMessages = useMemo<ChatMessageViewModel[]>(
    () =>
      messages.flatMap((message) => {
        if (message.role !== "user" && message.role !== "assistant") return [];

        const text = message.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");

        const tools = message.parts.flatMap<ChatToolActivity>((part) => {
          if (!isToolUIPart(part)) return [];

          const isComplete = part.state === "output-available";
          const isError = part.state === "output-error" || part.state === "output-denied";

          return [{
            id: part.toolCallId,
            name: getToolName(part),
            status: isError ? "error" : isComplete ? "complete" : "running",
            rowCount: isComplete ? toolRowCount(part.output) : undefined,
          }];
        });

        if (!text && tools.length === 0) return [];

        return [{ id: message.id, role: message.role, text, tools }];
      }),
    [messages],
  );

  const firstUserMessage = viewMessages.find((message) => message.role === "user");
  const title = firstUserMessage?.text
    ? firstUserMessage.text.length > 42
      ? `${firstUserMessage.text.slice(0, 42)}…`
      : firstUserMessage.text
    : "New conversation";

  const sendPrompt = (prompt = input) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || status !== "ready") return;

    setInput("");
    void sendMessage({ text: cleanPrompt });
  };

  return (
    <ChatWorkspace
      title={title}
      input={input}
      status={status}
      messages={viewMessages}
      suggestions={suggestions}
      recentQueries={recentQueries}
      onInputChange={setInput}
      onSend={sendPrompt}
      onStop={() => void stop()}
      onRetry={() => void regenerate()}
      onNewConversation={() => {
        if (status === "submitted" || status === "streaming") void stop();
        clearError();
        setMessages([]);
        setInput("");
      }}
    />
  );
}
