"use client";

import { Alert, Avatar, Button, Spin } from "antd";
import { Fragment, useEffect, useRef } from "react";
import { DatabaseIcon, RetryIcon } from "./icons";
import type { ChatMessageViewModel, ChatToolActivity } from "./types";

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

const InlineText = ({ text }: { text: string }) => {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return (
        <strong className="font-semibold text-agent-text" key={`${segment}-${index}`}>
          {segment.slice(2, -2)}
        </strong>
      );
    }

    if (segment.startsWith("`") && segment.endsWith("`")) {
      return (
        <code
          className="rounded-[5px] border border-white/8 bg-[#090c11] px-[5px] py-0.5 font-mono text-[0.9em] text-[#9ae9f7]"
          key={`${segment}-${index}`}
        >
          {segment.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={`${segment}-${index}`}>{segment}</Fragment>;
  });
}

const FormattedMessage = ({ text }: { text: string }) => {
  return (
    <div>
      {text.split("\n").map((line, index) => {
        const listMatch = line.match(/^\s*(?:[-*]|\d+[.)])\s+(.*)$/);

        if (listMatch) {
          return (
            <div
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-[3px] py-0.5"
              key={`${line}-${index}`}
            >
              <span className="text-agent-accent" aria-hidden="true">
                {/^\s*\d/.test(line)
                  ? line.match(/^\s*(\d+[.)])/)?.[1]
                  : "•"}
              </span>
              <span>
                <InlineText text={listMatch[1]} />
              </span>
            </div>
          );
        }

        if (line.trim().length === 0) {
          return <div className="h-[9px]" key={`break-${index}`} />;
        }

        return (
          <p className="m-0 wrap-anywhere whitespace-pre-wrap" key={`${line}-${index}`}>
            <InlineText text={line} />
          </p>
        );
      })}
    </div>
  );
}

const ToolActivity = ({ activity }: { activity: ChatToolActivity }) => {
  const label = toolLabels[activity.name] ?? "Querying database";
  const description =
    activity.status === "complete"
      ? `${activity.rowCount ?? 0} ${activity.rowCount === 1 ? "row" : "rows"}`
      : activity.status === "error"
        ? "Query failed"
        : "Working";
  const iconColor =
    activity.status === "complete"
      ? "text-agent-success"
      : activity.status === "error"
        ? "text-agent-danger"
        : "animate-[agent-pulse_1.2s_ease-in-out_infinite] text-agent-accent";

  return (
    <div className="flex min-w-[240px] items-center gap-[7px] rounded-[10px] border border-white/8 bg-[#090c11] px-2.5 py-2 text-[10px] font-semibold text-agent-soft">
      <span className={`grid place-items-center ${iconColor}`}>
        <DatabaseIcon size={13} />
      </span>
      <span>
        {activity.status === "complete" ? label.replace(/ing\b/, "ed") : label}
      </span>
      <span className="ml-auto font-medium text-agent-faint">{description}</span>
    </div>
  );
}

const MessageRow = ({ message }: { message: ChatMessageViewModel }) => {
  const isUser = message.role === "user";

  return (
    <article
      className={`mb-[22px] flex w-full gap-2.5 animate-[agent-message-in_260ms_ease_both] min-[541px]:mb-7 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <Avatar
          shape="square"
          size={30}
          icon={<DatabaseIcon size={16} />}
          className="!mt-0.5 !shrink-0 !border !border-agent-accent/20 !bg-agent-accent/8 !text-agent-accent"
        />
      )}
      <div className="min-w-0 max-w-[min(680px,calc(100%-44px))]">
        <div
          className={`mb-[7px] flex items-center gap-[7px] text-[10px] text-agent-faint ${isUser ? "justify-end" : "justify-start"}`}
        >
          {isUser ? (
            <>
              <span>Just now</span>
              <strong className="font-semibold text-agent-soft">You</strong>
            </>
          ) : (
            <>
              <strong className="font-semibold text-agent-soft">SQL Agent</strong>
              <span>Just now</span>
            </>
          )}
        </div>
        <div
          className={`overflow-hidden border text-[13px] leading-[1.65] ${
            isUser
              ? "max-w-[520px] rounded-[16px_5px_16px_16px] border-agent-accent/20 bg-[linear-gradient(145deg,rgba(38,89,102,0.54),rgba(25,55,68,0.66))] px-[15px] py-[11px] text-[#f1fbfd]"
              : "rounded-[5px_16px_16px_16px] border-white/8 bg-[rgba(15,19,26,0.84)] px-[13px] py-3 text-[#d9dee7] min-[541px]:px-4 min-[541px]:py-3.5"
          }`}
        >
          {message.tools.length > 0 && (
            <div className={`grid gap-[7px] ${message.text ? "mb-3" : ""}`}>
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

const TypingMessage = () => {
  return (
    <article className="mb-[22px] flex w-full gap-2.5 animate-[agent-message-in_260ms_ease_both] min-[541px]:mb-7">
      <Avatar
        shape="square"
        size={30}
        icon={<DatabaseIcon size={16} />}
        className="!mt-0.5 !shrink-0 !border !border-agent-accent/20 !bg-agent-accent/8 !text-agent-accent"
      />
      <div className="min-w-0 max-w-[min(680px,calc(100%-44px))]">
        <div className="mb-[7px] flex items-center gap-[7px] text-[10px] text-agent-faint">
          <strong className="font-semibold text-agent-soft">SQL Agent</strong>
          <span>Thinking</span>
        </div>
        <div className="rounded-[5px_16px_16px_16px] border border-white/8 bg-[rgba(15,19,26,0.84)] px-[13px] py-3 min-[541px]:px-4 min-[541px]:py-3.5">
          <div className="flex items-center gap-2 text-[11px] text-agent-soft" role="status">
            <Spin size="small" />
            <span>SQL Agent is responding</span>
          </div>
        </div>
      </div>
    </article>
  );
}

const ChatMessages = ({ messages, isWaiting, hasError, onRetry }: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;

    scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
  }, [messages, isWaiting, hasError]);

  return (
    <div
      className="min-h-0 min-w-0 w-full overflow-y-auto overscroll-contain [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin]"
      ref={scrollRef}
    >
      <section
        className="mx-auto min-h-full w-full max-w-[860px] px-3.5 pt-7 pb-[18px] min-[541px]:px-6 min-[541px]:pt-11 min-[541px]:pb-6"
        aria-live="polite"
        aria-busy={isWaiting}
      >
        {messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
        {isWaiting && <TypingMessage />}
        {hasError && (
          <Alert
            type="error"
            showIcon
            className="!mt-1 !mb-6 min-[541px]:!ml-[41px]"
            message="Something went wrong while generating the response."
            action={
              <Button size="small" icon={<RetryIcon />} onClick={onRetry}>
                Try again
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

export default ChatMessages;