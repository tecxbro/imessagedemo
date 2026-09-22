import type { CompiledDemo } from "@/contracts";

export const compiledFixture: CompiledDemo = {
  id: "foundation-text",
  platform: "ios",
  theme: "light",
  durationMs: 2000,
  contact: { name: "Alex Morgan", initials: "AM" },
  nowMs: Date.parse("2026-09-21T16:41:00.000Z"),
  screen: "conversation",
  events: [
    {
      type: "message",
      atMs: 0,
      message: {
        id: "in-1",
        text: "Are you close?",
        direction: "incoming",
        atMs: Date.parse("2026-09-21T16:39:00.000Z"),
        status: "read",
      },
    },
    {
      type: "message",
      atMs: 1000,
      message: {
        id: "out-1",
        text: "See you there.",
        direction: "outgoing",
        atMs: Date.parse("2026-09-21T16:40:00.000Z"),
        status: "delivered",
      },
    },
  ],
};
