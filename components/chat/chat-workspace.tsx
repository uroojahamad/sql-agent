"use client";

import { useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatHeader } from "./chat-header";
import { ChatMessages } from "./chat-messages";
import { ChatSidebar } from "./chat-sidebar";
import { ChatWelcome } from "./chat-welcome";
import type {
  ChatMessageViewModel,
  ChatPromptOption,
  ChatViewStatus,
  RecentQuery,
} from "./types";
import styles from "./chat.module.css";

interface ChatWorkspaceProps {
  title: string;
  input: string;
  status: ChatViewStatus;
  messages: ChatMessageViewModel[];
  suggestions: ChatPromptOption[];
  recentQueries: RecentQuery[];
  onInputChange: (value: string) => void;
  onSend: (prompt?: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onNewConversation: () => void;
}

export function ChatWorkspace({
  title,
  input,
  status,
  messages,
  suggestions,
  recentQueries,
  onInputChange,
  onSend,
  onStop,
  onRetry,
  onNewConversation,
}: ChatWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const isWaiting =
    isBusy &&
    (status === "submitted" ||
      !lastMessage ||
      lastMessage.role === "user" ||
      lastMessage.text.length === 0);

  const handlePromptSelect = (prompt: string) => {
    setIsSidebarOpen(false);
    onSend(prompt);
  };

  return (
    <main className={styles.shell}>
      <ChatSidebar
        isOpen={isSidebarOpen}
        recentQueries={recentQueries}
        onClose={() => setIsSidebarOpen(false)}
        onNewConversation={() => {
          setIsSidebarOpen(false);
          onNewConversation();
        }}
        onPromptSelect={handlePromptSelect}
      />

      <section className={styles.workspace} aria-label="Chat workspace">
        <ChatHeader title={title} onOpenMenu={() => setIsSidebarOpen(true)} />
        <div className={styles.chatStage}>
          {messages.length === 0 ? (
            <div className={styles.scrollArea}>
              <ChatWelcome suggestions={suggestions} onPromptSelect={handlePromptSelect} />
            </div>
          ) : (
            <ChatMessages
              messages={messages}
              isWaiting={isWaiting}
              hasError={status === "error"}
              onRetry={onRetry}
            />
          )}
          <ChatComposer
            value={input}
            status={status}
            onChange={onInputChange}
            onSubmit={() => onSend()}
            onStop={onStop}
          />
        </div>
      </section>
    </main>
  );
}
