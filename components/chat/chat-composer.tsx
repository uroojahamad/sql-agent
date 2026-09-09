"use client";

import { useEffect, useRef } from "react";
import { SendIcon, StopIcon } from "./icons";
import type { ChatViewStatus } from "./types";
import styles from "./chat.module.css";

interface ChatComposerProps {
  value: string;
  status: ChatViewStatus;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatComposer({
  value,
  status,
  onChange,
  onSubmit,
  onStop,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const canSubmit = value.trim().length > 0 && status === "ready";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 130)}px`;
  }, [value]);

  return (
    <div className={styles.composerZone}>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className={styles.composerBox}>
          <textarea
            ref={textareaRef}
            className={styles.prompt}
            rows={1}
            aria-label="Ask SQL Agent"
            placeholder="Ask a question about your data…"
            autoComplete="off"
            value={value}
            disabled={status === "error"}
            onChange={(event) => onChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canSubmit) event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          {isBusy ? (
            <button
              className={`${styles.sendButton} ${styles.stopButton}`}
              type="button"
              aria-label="Stop response"
              title="Stop response"
              onClick={onStop}
            >
              <StopIcon />
            </button>
          ) : (
            <button
              className={styles.sendButton}
              type="submit"
              aria-label="Send message"
              disabled={!canSubmit}
            >
              <SendIcon />
            </button>
          )}
        </div>
        <div className={styles.composerCaption}>
          Press <kbd>Enter</kbd> to send · Use <kbd>Shift + Enter</kbd> for a new line
        </div>
      </form>
    </div>
  );
}
