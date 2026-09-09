export type ChatViewStatus = "ready" | "submitted" | "streaming" | "error";

export interface ChatToolActivity {
  id: string;
  name: string;
  status: "running" | "complete" | "error";
  rowCount?: number;
}

export interface ChatMessageViewModel {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools: ChatToolActivity[];
}

export interface ChatPromptOption {
  title: string;
  description: string;
  prompt: string;
  icon: "chart" | "search" | "sales";
}

export interface RecentQuery {
  label: string;
  prompt: string;
}
