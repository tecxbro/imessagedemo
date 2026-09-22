import type { RuntimeDemo, SceneMessage } from "@/runtime";

const sentAt = 1_758_470_000_000;

export function message(id: string, text: string, direction: SceneMessage["direction"], extra: Partial<SceneMessage> = {}): SceneMessage {
  return { id, text, direction, atMs: sentAt, ...extra };
}

export const richDemo: RuntimeDemo = {
  id: "main",
  platform: "ios",
  theme: "light",
  durationMs: 5000,
  contact: { name: "Alex Morgan", initials: "AM" },
  nowMs: sentAt + 60_000,
  screen: "conversation",
  reducedMotion: false,
  initialState: {
    selectedConversationId: "main",
    conversations: [
      { id: "main", contact: { name: "Alex Morgan", initials: "AM" } },
      {
        id: "other",
        contact: { name: "Blair", initials: "B" },
        messages: [message("earlier", "Earlier", "incoming")],
      },
    ],
  },
  events: [
    { type: "message", atMs: 0, conversationId: "main", message: message("m1", "Hello", "incoming") },
    { type: "typing", atMs: 100, conversationId: "main", typing: true },
    { type: "draft", atMs: 200, conversationId: "main", value: "Hey" },
    {
      type: "message",
      atMs: 500,
      conversationId: "main",
      message: message("m2", "Hi", "outgoing", { replyTo: { id: "m1", text: "Hello", direction: "incoming" } }),
    },
    { type: "edit", atMs: 800, messageId: "m1", text: "Hello there" },
    { type: "reaction", atMs: 900, messageId: "m2", reactionId: "r1", reaction: { type: "love", byMe: true } },
    { type: "reaction", atMs: 1000, messageId: "m2", reactionId: "r1", reaction: { type: "emphasize", byMe: true } },
    { type: "reaction", atMs: 1100, messageId: "m2", reactionId: "r2", reaction: { type: "like", byMe: false } },
    { type: "reaction", atMs: 1200, messageId: "m2", reactionId: "r1", reaction: null },
    { type: "status", atMs: 1400, messageId: "m2", status: "read" },
    { type: "edit", atMs: 1500, sourceIndex: 1, messageId: "same", text: "after" },
    { type: "message", atMs: 1500, sourceIndex: 0, conversationId: "main", message: message("same", "before", "incoming") },
    { type: "scroll", atMs: 1600, conversationId: "main", offset: 40 },
    { type: "overlay", atMs: 1800, overlay: { kind: "thread", rootId: "m1" } },
    {
      type: "message",
      atMs: 2000,
      conversationId: "main",
      message: message("m3", "in thread", "incoming", { replyTo: { id: "m1", text: "Hello there", direction: "incoming" } }),
    },
    { type: "overlay", atMs: 2200, overlay: { kind: "closed" } },
    { type: "select-conversation", atMs: 2400, conversationId: "other" },
    { type: "draft", atMs: 2600, conversationId: "other", value: "Blair draft" },
    { type: "typing", atMs: 2800, conversationId: "other", typing: true },
    { type: "scroll", atMs: 3000, conversationId: "other", offset: 12 },
    { type: "select-conversation", atMs: 3200, conversationId: "main" },
    { type: "remove", atMs: 3400, messageId: "m3" },
    { type: "screen", atMs: 3600, screen: "list" },
    { type: "screen", atMs: 4000, screen: "conversation" },
    { type: "window-active", atMs: 4200, active: false },
    { type: "window-active", atMs: 4500, active: true },
    { type: "message", atMs: 4800, conversationId: "main", message: message("ink", "secret", "outgoing", { effect: "invisible-ink" }) },
    { type: "message", atMs: 5000, conversationId: "main", message: message("end", "done", "incoming") },
  ],
};
