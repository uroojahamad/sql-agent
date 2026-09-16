"use client";

import { Button, Tooltip } from "antd";
import TextArea from "antd/es/input/TextArea";
import { SendIcon, StopIcon } from "./icons";
import type { ChatViewStatus } from "./types";

interface ChatComposerProps {
  value: string;
  status: ChatViewStatus;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

const ChatComposer = ({
  value,
  status,
  onChange,
  onSubmit,
  onStop,
}: ChatComposerProps) => {
  const isBusy = status === "submitted" || status === "streaming";
  const canSubmit = value.trim().length > 0 && status === "ready";

  return (
    <div className="relative z-5 min-w-0 bg-[linear-gradient(to_top,#07090d_60%,rgba(7,9,13,0))] px-3 pt-2.5 pb-3 min-[541px]:px-6 min-[541px]:pt-3 min-[541px]:pb-5">
      <form
        className="mx-auto w-full max-w-[860px] min-w-0"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="relative flex items-end gap-2.5 rounded-[17px] border border-white/13 bg-[rgba(17,22,30,0.94)] py-2.5 pr-2.5 pl-[15px] shadow-[0_24px_70px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.035)] transition-[border-color,box-shadow] duration-180 focus-within:border-agent-accent/35 focus-within:shadow-[0_24px_70px_rgba(0,0,0,0.4),0_0_0_3px_rgba(112,225,245,0.055)]">
          <TextArea
            className="!min-h-9 !min-w-0 !flex-1 !resize-none !border-0 !bg-transparent !px-0 !py-1.5 !text-[13px] !leading-6 !text-agent-text !shadow-none placeholder:!text-[#717a88] focus:!shadow-none"
            autoSize={{ minRows: 1, maxRows: 5 }}
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
            <Tooltip title="Stop response">
              <Button
                type="text"
                htmlType="button"
                shape="circle"
                icon={<StopIcon />}
                className="!grid !size-9 !shrink-0 !place-items-center !border !border-agent-danger/25 !bg-agent-danger/10 !text-agent-danger hover:!bg-agent-danger/15 focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75"
                aria-label="Stop response"
                onClick={onStop}
              />
            </Tooltip>
          ) : (
            <Tooltip title="Send message">
              <Button
                type="primary"
                htmlType="submit"
                shape="circle"
                icon={<SendIcon />}
                className="!grid !size-9 !shrink-0 !place-items-center !border-0 !bg-agent-accent !text-[#082129] enabled:hover:!bg-[#91ebfa] focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75 disabled:!bg-white/8 disabled:!text-agent-faint"
                aria-label="Send message"
                disabled={!canSubmit}
              />
            </Tooltip>
          )}
        </div>
        <div className="mt-2 hidden text-center text-[9.5px] text-agent-faint min-[541px]:block">
          Press <kbd className="rounded-sm border border-white/8 bg-white/3.5 px-1 py-px font-inherit">Enter</kbd> to send · Use{" "}
          <kbd className="rounded-sm border border-white/8 bg-white/3.5 px-1 py-px font-inherit">Shift + Enter</kbd> for a new line
        </div>
      </form>
    </div>
  );
}

export default ChatComposer;