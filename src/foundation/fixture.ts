import type { Message } from "@/components/imessage/message-list";
import type { SidebarConversation } from "@/components/imessage/macos-sidebar";

export const foundationNow = new Date("2026-09-21T16:41:00.000Z");
export const foundationDraft = "On my way over.";

export const foundationMessages: Message[] = [
  {
    id: "in-1",
    text: "Are you close?",
    direction: "incoming",
    sentAt: new Date("2026-09-21T16:39:00.000Z"),
    status: "read",
  },
  {
    id: "out-1",
    text: "See you there.",
    direction: "outgoing",
    sentAt: new Date("2026-09-21T16:40:00.000Z"),
    status: "delivered",
  },
];

export const foundationConversations: SidebarConversation[] = [
  {
    id: "alex",
    name: "Alex Morgan",
    initials: "AM",
    preview: "See you there.",
    time: "9:41",
  },
];

export function foundationSend(_text: string): void {}
