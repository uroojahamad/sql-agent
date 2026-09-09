"use client";

import { Fragment, useEffect, useRef } from "react";
import { DatabaseIcon, RetryIcon } from "./icons";
import type { ChatMessageViewModel, ChatToolActivity } from "./types";
import styles from "./chat.module.css";

interface ChatMessagesProps {
  messages: ChatMessageViewModel[];
  isWaiting: boolean;
  hasError: boolean;
  onRetry: () => void;
}

const toolLabels: Record<string, string> = {
  listCategories: "Loading categories",
  findProducts: "Searching products",
  listSales: "Loading recent sales",
  getSalesSummary: "Calculating sales summary",
  getTopProducts: "Ranking products",
  getCategoryPerformance: "Analyzing categories",
};

function InlineText({ text }: { text: string }) {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={`${segment}-${index}`}>{segment.slice(2, -2)}</strong>;
    }

    if (segment.startsWith("`") && segment.endsWith("`")) {
      return <code key={`${segment}-${index}`}>{segment.slice(1, -1)}</code>;
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

function FormattedMessage({ text }: { text: string }) {
  return (
    <div className={styles.formattedMessage}>
      {text.split("\n").map((line, index) => {
        const listMatch = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/);

        if (listMatch) {
          return (
            <div className={styles.messageListLine} key={`${line}-${index}`}>
              <span aria-hidden="true">{/^\s*\d/.test(line) ? line.match(/^\s*(\d+[.)])/)?.[1] : "•"}</span>
              <span><InlineText text={listMatch[1]} /></span>
            </div>
          );
        }

        if (line.trim().length === 0) {
          return <div className={styles.messageBreak} key={`break-${index}`} />;
        }

        return <p key={`${line}-${index}`}><InlineText text={line} /></p>;
      })}
    </div>
  );
}

function ToolActivity({ activity }: { activity: ChatToolActivity }) {
  const label = toolLabels[activity.name] ?? "Querying database";
  const description =
    activity.status === "complete"
      ? `${activity.rowCount ?? 0} ${activity.rowCount === 1 ? "row" : "rows"}`
      : activity.status === "error"
        ? "Query failed"
        : "Working";

  return (
    <div className={`${styles.toolActivity} ${styles[activity.status]}`}>
      <span className={styles.toolIcon}><DatabaseIcon size={13} /></span>
      <span>{activity.status === "complete" ? label.replace(/ing\b/, "ed") : label}</span>
      <span className={styles.toolActivityMeta}>{description}</span>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessageViewModel }) {
  const isUser = message.role === "user";

  return (
    <article className={`${styles.messageRow} ${isUser ? styles.user : styles.assistant}`}>
      {!isUser && (
        <div className={styles.messageAvatar}>
          <DatabaseIcon size={16} />
        </div>
      )}
      <div className={styles.messageContent}>
        <div className={styles.messageMeta}>
          {isUser ? (
            <><span>Just now</span><strong>You</strong></>
          ) : (
            <><strong>SQL Agent</strong><span>Just now</span></>
          )}
        </div>
        <div className={styles.messageBubble}>
          {message.tools.length > 0 && (
            <div className={styles.toolActivities}>
              {message.tools.map((activity) => (
                <ToolActivity activity={activity} key={activity.id} />
              ))}
            </div>
          )}
          {message.text && <FormattedMessage text={message.text} />}
        </div>
      </div>
    </article>
  );
}

function TypingMessage() {
  return (
    <article className={`${styles.messageRow} ${styles.assistant}`}>
      <div className={styles.messageAvatar}><DatabaseIcon size={16} /></div>
      <div className={styles.messageContent}>
        <div className={styles.messageMeta}><strong>SQL Agent</strong><span>Thinking</span></div>
        <div className={styles.messageBubble}>
          <div className={styles.typing} aria-label="SQL Agent is responding">
            <span /><span /><span />
          </div>
        </div>
      </div>
    </article>
  );
}

export function ChatMessages({ messages, isWaiting, hasError, onRetry }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
  }, [messages, isWaiting, hasError]);

  return (
    <div className={styles.scrollArea} ref={scrollRef}>
      <section className={styles.messages} aria-live="polite" aria-busy={isWaiting}>
        {messages.map((message) => <MessageRow key={message.id} message={message} />)}
        {isWaiting && <TypingMessage />}
        {hasError && (
          <div className={styles.errorNotice} role="alert">
            <span>Something went wrong while generating the response.</span>
            <button type="button" onClick={onRetry}><RetryIcon /> Try again</button>
          </div>
        )}
      </section>
    </div>
  );
}
