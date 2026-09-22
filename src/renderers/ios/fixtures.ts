import type { CompiledDemo, CompiledEvent, DemoMessage, DemoTheme, RenderFrame } from "@/contracts";
import { compileFrame, projectFrame } from "./project";

export const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export const nowMs = Date.parse("2026-09-21T16:41:00.000Z");
export const contact = { name: "Alex Morgan", initials: "AM" };

export type IosFixture = { compiled: CompiledDemo; frame: RenderFrame };

function message(partial: DemoMessage): DemoMessage {
  return partial;
}

const incoming = message({
  id: "in-1",
  text: "Are you close?",
  direction: "incoming",
  atMs: nowMs - 120_000,
  status: "read",
});

const outgoing = message({
  id: "out-1",
  text: "See you there.",
  direction: "outgoing",
  atMs: nowMs - 60_000,
  status: "delivered",
});

function staged(frame: RenderFrame, events: CompiledEvent[]): IosFixture {
  const compiled: CompiledDemo = {
    id: "ios-fixture",
    platform: "ios",
    theme: frame.theme,
    durationMs: Math.max(frame.timeMs, ...events.map((event) => event.atMs)),
    contact: frame.contact,
    nowMs: frame.nowMs,
    screen: frame.screen,
    events,
  };
  return { compiled, frame: projectFrame(compiled, frame.timeMs) };
}

function staticFrame(theme: DemoTheme, timeMs: number, messages: DemoMessage[], extra: Partial<RenderFrame> = {}): IosFixture {
  const frame: RenderFrame = {
    timeMs,
    platform: "ios",
    theme,
    screen: "conversation",
    contact,
    nowMs,
    typing: false,
    draft: "On my way over.",
    messages,
    ...extra,
  };
  const compiled = compileFrame(frame);
  return { compiled, frame: projectFrame(compiled, timeMs) };
}

export function textFixture(theme: DemoTheme = "light", timeMs = 5000): IosFixture {
  return arrivalFixture(timeMs, theme);
}

/** Incoming at playback 0, outgoing at playback 1000. Times inside those windows are mid-arrival. */
export function arrivalFixture(timeMs: number, theme: DemoTheme = "light"): IosFixture {
  const frame: RenderFrame = {
    timeMs,
    platform: "ios",
    theme,
    screen: "conversation",
    contact,
    nowMs,
    typing: false,
    draft: "On my way over.",
    messages: [],
  };
  return staged(frame, [
    { type: "message", atMs: 0, message: incoming },
    { type: "message", atMs: 1000, message: outgoing },
    { type: "draft", atMs: 0, value: frame.draft },
    { type: "typing", atMs: 0, typing: false },
  ]);
}

export function emojiFixture(timeMs: number): IosFixture {
  const emojiIn = message({ id: "emoji-in", text: "🎉", direction: "incoming", atMs: nowMs - 120_000 });
  const emojiOut = message({ id: "emoji-out", text: "👍", direction: "outgoing", atMs: nowMs - 60_000, status: "delivered" });
  const frame: RenderFrame = {
    timeMs,
    platform: "ios",
    theme: "light",
    screen: "conversation",
    contact,
    nowMs,
    typing: false,
    draft: "",
    messages: [],
  };
  return staged(frame, [
    { type: "message", atMs: 0, message: emojiIn },
    { type: "message", atMs: 1000, message: emojiOut },
    { type: "draft", atMs: 0, value: "" },
    { type: "typing", atMs: 0, typing: false },
  ]);
}

export function linkFixture(): IosFixture {
  return staticFrame("light", 5000, [
    incoming,
    message({
      id: "link-1",
      text: "Notes",
      direction: "outgoing",
      atMs: nowMs - 30_000,
      kind: "link",
      status: "delivered",
      link: { url: "https://example.com/notes", title: "Notes", host: "example.com" },
    }),
  ]);
}

export function imageFixture(src = pixel): IosFixture {
  return staticFrame("light", 5000, [
    message({
      id: "image-1",
      text: "",
      direction: "incoming",
      atMs: nowMs - 30_000,
      kind: "image",
      images: [{ src, alt: "Still", width: 4, height: 4 }],
    }),
  ]);
}

export function audioFixture(): IosFixture {
  return staticFrame("light", 5000, [
    message({
      id: "audio-1",
      text: "",
      direction: "outgoing",
      atMs: nowMs - 30_000,
      kind: "audio",
      status: "delivered",
      audio: { duration: 8, peaks: [0.2, 0.8, 0.4, 0.9, 0.3] },
    }),
  ]);
}

export function attachmentFixture(): IosFixture {
  return staticFrame("light", 5000, [
    message({
      id: "file-1",
      text: "",
      direction: "incoming",
      atMs: nowMs - 30_000,
      kind: "attachment",
      attachments: [{ name: "Notes.txt", size: "4 KB" }],
    }),
  ]);
}

export function typingFixture(timeMs: number): IosFixture {
  return staticFrame("light", timeMs, [incoming], { typing: true, draft: "" });
}

export function inkFixture(timeMs: number): IosFixture {
  return staticFrame("light", timeMs, [
    message({
      id: "ink-1",
      text: "Hidden until you look",
      direction: "incoming",
      atMs: nowMs - 30_000,
      effect: "invisible-ink",
    }),
  ]);
}

export function slamFixture(timeMs: number): IosFixture {
  return staticFrame("light", timeMs, [
    message({
      id: "slam-1",
      text: "Loud and clear",
      direction: "outgoing",
      atMs: nowMs - 30_000,
      status: "delivered",
      effect: "slam",
    }),
  ]);
}

export function statusFixture(): IosFixture {
  return staticFrame("light", 5000, [
    message({ id: "sent-1", text: "Sent", direction: "outgoing", atMs: nowMs - 180_000, status: "sent" }),
    message({ id: "read-1", text: "Read", direction: "outgoing", atMs: nowMs - 120_000, status: "read" }),
    message({ id: "failed-1", text: "Failed", direction: "outgoing", atMs: nowMs - 60_000, status: "failed" }),
  ]);
}

export function smsFixture(): IosFixture {
  return staticFrame("light", 5000, [
    message({ id: "sms-1", text: "Sent as a text", direction: "outgoing", atMs: nowMs - 60_000, service: "sms", status: "delivered" }),
  ]);
}

export function listFixture(): IosFixture {
  return staticFrame("light", 5000, [incoming, outgoing], { screen: "list", draft: "" });
}

export function newMessageFixture(): IosFixture {
  return staticFrame("light", 5000, [], { screen: "new-message", draft: "Hello" });
}

export function scrollFixture(timeMs: number): IosFixture {
  const messages = Array.from({ length: 14 }, (_, index) => message({
    id: `line-${index}`,
    text: `Line ${index} stays in the transcript for the scroll checkpoint.`,
    direction: index % 2 === 0 ? "incoming" : "outgoing",
    atMs: nowMs - (14 - index) * 60_000,
    ...(index === 13 ? { status: "delivered" as const } : {}),
  }));
  return staticFrame("light", timeMs, messages, { draft: "" });
}
