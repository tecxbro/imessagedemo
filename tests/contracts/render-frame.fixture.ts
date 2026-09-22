import type { RenderFrame } from "@/contracts";

export const renderFrameFixture: RenderFrame = {
  timeMs: 1000,
  platform: "ios",
  theme: "light",
  screen: "conversation",
  contact: { name: "Alex Morgan", initials: "AM" },
  nowMs: Date.parse("2026-09-21T16:41:00.000Z"),
  typing: false,
  draft: "On my way over.",
  messages: [
    {
      id: "in-1",
      text: "Are you close?",
      direction: "incoming",
      atMs: Date.parse("2026-09-21T16:39:00.000Z"),
      status: "read",
    },
    {
      id: "out-1",
      text: "See you there.",
      direction: "outgoing",
      atMs: Date.parse("2026-09-21T16:40:00.000Z"),
      status: "delivered",
    },
  ],
};
