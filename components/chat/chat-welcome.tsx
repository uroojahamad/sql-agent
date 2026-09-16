import { Button } from "antd";
import { ChartIcon, DatabaseIcon, SalesIcon, SearchIcon, SparkIcon } from "./icons";
import type { ChatPromptOption } from "./types";

interface ChatWelcomeProps {
  suggestions: ChatPromptOption[];
  onPromptSelect: (prompt: string) => void;
}

const suggestionIcons = {
  chart: ChartIcon,
  search: SearchIcon,
  sales: SalesIcon,
};

const suggestionIconClasses = {
  chart: "bg-agent-accent/8 text-agent-accent",
  search: "bg-agent-violet/10 text-[#b8adff]",
  sales: "bg-agent-success/9 text-agent-success",
};

const ChatWelcome = ({ suggestions, onPromptSelect }: ChatWelcomeProps) => {
  return (
    <section
      className="flex min-h-full w-full min-w-0 items-start justify-center px-[18px] pt-[50px] pb-6 min-[541px]:items-center min-[541px]:px-6 min-[541px]:pt-12 min-[541px]:pb-8"
      aria-labelledby="welcome-title"
    >
      <div className="w-full max-w-[720px] min-w-0 text-center min-[541px]:-mt-6">
        <div
          className="relative mx-auto mb-[19px] grid size-[104px] place-items-center min-[541px]:mb-[25px] min-[541px]:size-[124px]"
          aria-hidden="true"
        >
          <div className="absolute inset-[5px] rounded-full bg-[radial-gradient(circle,rgba(112,225,245,0.18),transparent_68%)] blur-[9px]" />
          <div className="absolute inset-2.5 animate-[agent-orbit_16s_linear_infinite] rounded-full border border-agent-accent/20">
            <span className="absolute top-2 left-[17px] size-1.5 rounded-full bg-agent-accent shadow-[0_0_14px_rgba(112,225,245,0.9)]" />
            <span className="absolute right-[5px] bottom-[23px] size-1 rounded-full bg-agent-violet shadow-[0_0_14px_rgba(155,138,251,0.7)]" />
          </div>
          <div className="relative grid size-[68px] place-items-center rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(21,26,35,0.95),rgba(11,15,21,0.98))] text-agent-accent shadow-[0_24px_50px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] min-[541px]:size-[76px] min-[541px]:rounded-3xl">
            <DatabaseIcon size={40} />
            <SparkIcon className="absolute top-3 right-3 text-[#d0caff] drop-shadow-[0_0_7px_rgba(155,138,251,0.65)]" />
          </div>
        </div>
        <span className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-agent-accent uppercase before:h-px before:w-[18px] before:bg-current before:content-['']">
          AI-powered database assistant
        </span>
        <h1
          className="m-0 text-[30px] leading-[1.08] font-bold tracking-[-0.045em] min-[541px]:text-[clamp(30px,4vw,44px)]"
          id="welcome-title"
        >
          Turn questions into{" "}
          <span className="bg-[linear-gradient(110deg,#fff_18%,#9ae9f7_56%,#b9afff_92%)] bg-clip-text text-transparent">
            clear answers.
          </span>
        </h1>
        <p className="mx-auto mt-3.5 max-w-[540px] text-[13px] leading-[1.65] text-agent-soft min-[541px]:text-sm">
          Ask about your categories, products, inventory, and sales in plain English.
          SQL Agent securely queries your data and explains the result.
        </p>

        <div
          className="mx-auto mt-6 grid w-full max-w-[400px] grid-cols-1 gap-2.5 min-[541px]:mt-[34px] min-[801px]:max-w-none min-[801px]:grid-cols-3"
          aria-label="Example questions"
        >
          {suggestions.map((suggestion) => {
            const Icon = suggestionIcons[suggestion.icon];

            return (
              <Button
                type="text"
                className="!block !h-auto !min-h-[72px] !whitespace-normal !rounded-[14px] !border !border-white/8 !bg-[rgba(15,19,26,0.7)] !p-3.5 !text-left !text-agent-text hover:!-translate-y-0.5 hover:!border-agent-accent/25 hover:!bg-agent-raised focus-visible:!outline-2 focus-visible:!outline-offset-2 focus-visible:!outline-agent-accent/75 min-[801px]:!min-h-[92px]"
                key={suggestion.prompt}
                onClick={() => onPromptSelect(suggestion.prompt)}
              >
                <span
                  className={`float-left mr-2.5 mb-0.5 grid size-[26px] place-items-center rounded-lg min-[801px]:float-none min-[801px]:mr-0 min-[801px]:mb-2.5 ${suggestionIconClasses[suggestion.icon]}`}
                >
                  <Icon />
                </span>
                <strong className="mb-1 block text-[11.5px] font-semibold">
                  {suggestion.title}
                </strong>
                <span className="block text-[10.5px] leading-[1.45] text-agent-faint">
                  {suggestion.description}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default ChatWelcome;