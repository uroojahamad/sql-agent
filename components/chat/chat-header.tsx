import { Button, Tooltip } from "antd";
import type { Ref } from "react";
import { DatabaseIcon, MenuIcon, MoreIcon } from "./icons";

interface ChatHeaderProps {
  title: string;
  onOpenMenu: () => void;
  menuButtonRef: Ref<HTMLButtonElement | HTMLAnchorElement>;
}

const ChatHeader = ({
  title,
  onOpenMenu,
  menuButtonRef,
}: ChatHeaderProps) => {
  return (
    <header className="relative z-10 flex items-center gap-3 border-b border-white/8 bg-[rgba(7,9,13,0.7)] px-3.5 backdrop-blur-2xl min-[541px]:px-6">
      <Tooltip title="Open navigation">
        <Button
          type="text"
          ref={menuButtonRef}
          shape="circle"
          icon={<MenuIcon />}
          className="!grid !size-8 !place-items-center !text-agent-soft hover:!bg-agent-raised hover:!text-agent-text focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75 min-[801px]:!hidden"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        />
      </Tooltip>
      <div className="min-w-0 flex-1">
        <strong className="block overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap">
          {title}
        </strong>
        <span className="mt-[3px] block overflow-hidden text-[10px] text-agent-faint text-ellipsis whitespace-nowrap">
          SQL Agent · Gemini 3.5 Flash Lite
        </span>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Button
          type="text"
          href="/database"
          className="!hidden !h-[30px] !items-center !gap-2 !rounded-full !border !border-white/8 !bg-white/2.5 !px-2.5 !text-[10.5px] !text-agent-soft hover:!border-agent-accent/25 hover:!text-agent-text min-[541px]:!inline-flex"
        >
          <span className="size-1.5 rounded-full bg-agent-success" />
          Production DB
        </Button>
        <Tooltip title="View database records">
          <Button
            type="text"
            shape="circle"
            href="/database"
            icon={<DatabaseIcon size={16} />}
            className="!grid !size-8 !place-items-center !text-agent-soft hover:!bg-agent-raised hover:!text-agent-text focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75"
            aria-label="View database records"
          />
        </Tooltip>
        <span
          className="hidden h-8 w-6 place-items-center text-agent-faint min-[541px]:grid"
          aria-hidden="true"
        >
          <MoreIcon size={16} />
        </span>
      </div>
    </header>
  );
}

export default ChatHeader;
