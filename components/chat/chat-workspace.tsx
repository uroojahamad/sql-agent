"use client";

import { useRef, useState } from "react";
import ChatComposer from "./chat-composer";
import ChatHeader from "./chat-header";
import ChatMessages from "./chat-messages";
import ChatWelcome  from "./chat-welcome";
import ChatSidebar from "./chat-sidebar";
import type {
  ChatMessageViewModel,
  ChatPromptOption,
  ChatViewStatus,
  RecentQuery,
} from "./types";

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

const ChatWorkspace = ({
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
}: ChatWorkspaceProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
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
    <main className="grid h-dvh w-full grid-cols-1 overflow-hidden bg-[radial-gradient(circle_at_62%_-18%,rgba(112,225,245,0.07),transparent_34%),radial-gradient(circle_at_105%_62%,rgba(155,138,251,0.05),transparent_32%),#07090d] text-agent-text min-[801px]:grid-cols-[264px_minmax(0,1fr)]">
      <ChatSidebar
        isOpen={isSidebarOpen}
        recentQueries={recentQueries}
        onClose={() => setIsSidebarOpen(false)}
        onDrawerVisibilityChange={(open) => {
          if (!open) {
            window.requestAnimationFrame(() => {
              menuButtonRef.current?.focus({ preventScroll: true });
            });
          }
        }}
        onNewConversation={() => {
          setIsSidebarOpen(false);
          onNewConversation();
        }}
        onPromptSelect={handlePromptSelect}
      />

      <section
        className="grid min-h-0 min-w-0 grid-rows-[58px_minmax(0,1fr)] min-[541px]:grid-rows-[64px_minmax(0,1fr)]"
        aria-label="Chat workspace"
      >
        <ChatHeader
          title={title}
          menuButtonRef={menuButtonRef}
          onOpenMenu={() => setIsSidebarOpen(true)}
        />
        <div className="relative grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          {messages.length === 0 ? (
            <div className="min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]">
              <ChatWelcome
                suggestions={suggestions}
                onPromptSelect={handlePromptSelect}
              />
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

export default ChatWorkspace;