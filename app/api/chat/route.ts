import { handleChatRequest } from "@/lib/chat/handle-chat-request";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = (request: Request) => handleChatRequest(request);
