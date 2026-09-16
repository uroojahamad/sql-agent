import { Avatar, Button, Drawer, Tooltip } from "antd";
import { CloseIcon, DatabaseIcon, MoreIcon, PlusIcon } from "./icons";
import type { RecentQuery } from "./types";

interface ChatSidebarProps {
  isOpen: boolean;
  recentQueries: RecentQuery[];
  onClose: () => void;
  onDrawerVisibilityChange: (open: boolean) => void;
  onNewConversation: () => void;
  onPromptSelect: (prompt: string) => void;
}

const sideItemClass =
  "!flex !h-auto !min-h-9 !w-full !justify-start !gap-2.5 !rounded-[9px] !border-0 !bg-transparent !px-2.5 !py-2 !text-left !text-[12.5px] !text-agent-soft hover:!bg-white/4.5 hover:!text-agent-text focus-visible:!outline-2 focus-visible:!outline-offset-1 focus-visible:!outline-agent-accent/75";

interface SidebarPanelProps
  extends Omit<ChatSidebarProps, "isOpen" | "onDrawerVisibilityChange"> {
  mobile?: boolean;
}

const SidebarPanel = ({
  recentQueries,
  onClose,
  onNewConversation,
  onPromptSelect,
  mobile = false,
}: SidebarPanelProps) => {
  return (
    <aside
      className="flex h-full min-h-0 min-w-0 flex-col border-r border-white/8 bg-[rgba(10,13,18,0.94)] px-3.5 pt-5 pb-4 backdrop-blur-2xl"
      aria-label="SQL Agent navigation"
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-[22px]">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[11px] border border-agent-accent/28 bg-[linear-gradient(145deg,rgba(112,225,245,0.18),rgba(155,138,251,0.08))] text-agent-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <DatabaseIcon size={19} />
        </span>
        <span className="text-[15px] font-bold tracking-[-0.01em]">SQL Agent</span>
        <span className="rounded-md border border-white/8 px-1.5 py-[3px] text-[9px] font-bold tracking-[0.08em] text-agent-faint">
          BETA
        </span>
        {mobile && (
          <Tooltip title="Close navigation">
            <Button
              type="text"
              shape="circle"
              icon={<CloseIcon />}
              className="!ml-auto !grid !size-8 !place-items-center !text-agent-soft hover:!bg-agent-raised hover:!text-agent-text focus-visible:!outline-2 focus-visible:!outline-agent-accent/75"
              aria-label="Close navigation"
              onClick={onClose}
            />
          </Tooltip>
        )}
      </div>

      <Button
        icon={<PlusIcon />}
        block
        className="!flex !min-h-[42px] !items-center !justify-center !gap-2 !rounded-[11px] !border-white/13 !bg-agent-raised !text-[13px] !font-semibold hover:!-translate-y-px hover:!border-agent-accent/30 hover:!bg-[#191f29] focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75"
        onClick={onNewConversation}
      >
        New conversation
      </Button>

      <section className="mt-6" aria-labelledby={mobile ? "mobile-connections-label" : "connections-label"}>
        <p
          className="mx-2.5 mb-2 text-[10px] font-bold tracking-[0.11em] text-agent-faint uppercase"
          id={mobile ? "mobile-connections-label" : "connections-label"}
        >
          Connections
        </p>
        <Button type="text" href="/database" className={sideItemClass}>
          <DatabaseIcon size={15} />
          <span>Production DB</span>
          <span
            className="ml-auto size-[7px] rounded-full bg-agent-success shadow-[0_0_0_4px_rgba(102,217,165,0.09)]"
            aria-label="Connected"
          />
        </Button>
      </section>

      <section className="mt-6" aria-labelledby={mobile ? "mobile-recent-label" : "recent-label"}>
        <p
          className="mx-2.5 mb-2 text-[10px] font-bold tracking-[0.11em] text-agent-faint uppercase"
          id={mobile ? "mobile-recent-label" : "recent-label"}
        >
          Try asking
        </p>
        <div className="grid gap-0.5">
          {recentQueries.map((query) => (
            <Button
              type="text"
              className={sideItemClass}
              key={query.prompt}
              onClick={() => onPromptSelect(query.prompt)}
            >
              {query.label}
            </Button>
          ))}
        </div>
      </section>

      <div className="flex-1" />

      <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[11px] p-[9px] text-agent-soft">
        <Avatar
          shape="square"
          size={30}
          className="!border !border-agent-violet/35 !bg-agent-violet/12 !text-[11px] !font-bold !text-[#c7beff]"
        >
          UA
        </Avatar>
        <span className="min-w-0">
          <strong className="block overflow-hidden text-[11.5px] font-semibold text-agent-text text-ellipsis whitespace-nowrap">
            Urooj Ahamad
          </strong>
          <span className="mt-0.5 block overflow-hidden text-[10px] text-agent-faint text-ellipsis whitespace-nowrap">
            Workspace admin
          </span>
        </span>
        <MoreIcon size={14} />
      </div>
    </aside>
  );
}

const ChatSidebar = ({
  isOpen,
  recentQueries,
  onClose,
  onDrawerVisibilityChange,
  onNewConversation,
  onPromptSelect,
}: ChatSidebarProps) => {
  return (
    <>
      <div className="hidden min-h-0 min-w-0 min-[801px]:block">
        <SidebarPanel
          recentQueries={recentQueries}
          onClose={onClose}
          onNewConversation={onNewConversation}
          onPromptSelect={onPromptSelect}
        />
      </div>
      <Drawer
        open={isOpen}
        onClose={onClose}
        afterOpenChange={onDrawerVisibilityChange}
        placement="left"
        size="min(86vw, 264px)"
        closable={false}
        rootClassName="min-[801px]:!hidden"
        classNames={{
          mask: "!bg-black/55",
          section: "!bg-agent-sidebar !shadow-[24px_0_70px_rgba(0,0,0,0.46)]",
          body: "!p-0",
        }}
      >
        <SidebarPanel
          mobile
          recentQueries={recentQueries}
          onClose={onClose}
          onNewConversation={onNewConversation}
          onPromptSelect={onPromptSelect}
        />
      </Drawer>
    </>
  );
}

export default ChatSidebar;
