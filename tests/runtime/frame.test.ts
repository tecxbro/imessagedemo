import { describe, expect, it } from "vitest";
import {
  cueProgress,
  frameAt,
  macTransitions,
  messageMotion,
  pendingCueDurations,
  screenTransitionDuration,
  type RuntimeDemo,
} from "@/runtime";
import { message, richDemo } from "./fixture";

function ios(events: RuntimeDemo["events"], screen: RuntimeDemo["screen"] = "list"): RuntimeDemo {
  return {
    id: "ios",
    platform: "ios",
    theme: "light",
    durationMs: 5000,
    contact: { name: "Alex" },
    nowMs: 50,
    screen,
    events,
  };
}

describe("frameAt", () => {
  it("holds only in-progress cues and settles when progress reaches one", () => {
    const opened = frameAt(richDemo, 0);
    const receive = opened.cues.find((cue) => cue.kind === "receive" && cue.subjectId === "m1");
    expect(receive).toMatchObject({ elapsedMs: 0, progress: 0, durationMs: messageMotion().receive.duration });
    const midway = frameAt(richDemo, 150);
    expect(midway.cues.find((cue) => cue.subjectId === "m1" && cue.kind === "receive")?.progress).toBe(0.5);
    const settled = frameAt(richDemo, messageMotion().receive.duration);
    expect(settled.cues.some((cue) => cue.subjectId === "m1")).toBe(false);
    expect(settled.messages.some((item) => item.id === "m1")).toBe(true);
  });

  it("does not divide by zero for invisible ink", () => {
    expect(cueProgress(10, 0)).toBeNull();
    expect(cueProgress(0, 0)).toBeNull();
    const frame = frameAt(richDemo, 4900);
    const ink = frame.messages.find((item) => item.id === "ink");
    expect(ink).toMatchObject({ effect: "invisible-ink", revealed: false });
    expect(frame.cues.some((cue) => cue.kind === "bubble-effect" && cue.subjectId === "ink")).toBe(false);
    expect(frame.cues.every((cue) => cue.durationMs > 0 && Number.isFinite(cue.progress) && cue.progress < 1)).toBe(true);
    const send = frame.cues.find((cue) => cue.kind === "send" && cue.subjectId === "ink");
    expect(send?.durationMs).toBe(messageMotion().send.duration);
  });

  it("uses reduced send duration only when the demo asks for it", () => {
    const demo: RuntimeDemo = {
      ...richDemo,
      reducedMotion: true,
      events: [{ type: "message", atMs: 0, message: message("out", "Go", "outgoing") }],
      initialState: { conversations: [{ id: "main" }] },
    };
    expect(frameAt(demo, 100).cues.find((cue) => cue.kind === "send")?.durationMs).toBe(messageMotion().reduced.duration);
  });

  it("keeps exiting thread content in beforeState until the exit duration ends", () => {
    const exit = pendingCueDurations.threadExit;
    const during = frameAt(richDemo, 2200 + exit / 2);
    expect(during.overlay).toEqual({ kind: "closed" });
    expect(during.beforeState?.overlay).toEqual({ kind: "thread", rootId: "m1" });
    expect(during.beforeState?.messages.some((item) => item.id === "m1")).toBe(true);
    expect(during.cues.find((cue) => cue.kind === "overlay-exit")?.progress).toBe(0.5);
    const done = frameAt(richDemo, 2200 + exit);
    expect(done.beforeState).toBeNull();
    expect(done.cues.some((cue) => cue.kind === "overlay-exit")).toBe(false);
    expect(done.overlay).toEqual({ kind: "closed" });
  });

  it("seeks iOS navigation from the prepared screen", () => {
    const push = screenTransitionDuration("push");
    const present = screenTransitionDuration("present");
    const dismiss = screenTransitionDuration("dismiss");
    const pop = screenTransitionDuration("pop");
    const demo = ios([
      { type: "screen", atMs: 100, screen: "conversation" },
      { type: "screen", atMs: 500, screen: "new-message" },
      { type: "screen", atMs: 1000, screen: "list" },
      { type: "screen", atMs: 1400, screen: "conversation" },
    ]);
    expect(frameAt(demo, 100)).toMatchObject({
      screen: "conversation",
      beforeState: { screen: "list" },
    });
    expect(frameAt(demo, 100).cues.find((cue) => cue.kind === "screen")).toMatchObject({ transition: "push", progress: 0, durationMs: push });
    expect(frameAt(demo, 100 + push).beforeState).toBeNull();
    expect(frameAt(demo, 500 + present / 2).cues.find((cue) => cue.kind === "screen")).toMatchObject({
      transition: "present",
      progress: 0.5,
      durationMs: present,
    });
    expect(frameAt(demo, 500 + present / 2).beforeState?.screen).toBe("conversation");
    expect(frameAt(demo, 1000 + dismiss / 2).cues.find((cue) => cue.kind === "screen")?.transition).toBe("dismiss");
    expect(frameAt(demo, 1400).cues.find((cue) => cue.kind === "screen")?.transition).toBe("push");
    expect(pop).toBe(screenTransitionDuration("pop"));
  });

  it("pops from a conversation back to the list and pushes out of a new-message sheet", () => {
    const back = ios([{ type: "screen", atMs: 0, screen: "list" }], "conversation");
    expect(frameAt(back, 0).cues[0]).toMatchObject({ transition: "pop", durationMs: screenTransitionDuration("pop") });
    const chosen = ios([{ type: "screen", atMs: 0, screen: "conversation" }], "new-message");
    expect(frameAt(chosen, 0).cues[0]?.transition).toBe("push");
  });

  it("keeps the previous macOS conversation mounted for the switch", () => {
    const duration = macTransitions().conversation.duration;
    const demo: RuntimeDemo = {
      id: "mac",
      platform: "macos",
      theme: "dark",
      durationMs: 1000,
      contact: { name: "Alex" },
      nowMs: 10,
      screen: "conversation",
      initialState: {
        selectedConversationId: "a",
        conversations: [
          { id: "a", contact: { name: "Alex" }, messages: [message("a1", "from a", "incoming")], draft: "keep-a", typing: true, scroll: 8 },
          { id: "b", contact: { name: "Blair" }, messages: [message("b1", "from b", "outgoing")] },
        ],
      },
      events: [
        { type: "select-conversation", atMs: 100, conversationId: "b" },
        { type: "draft", atMs: 120, conversationId: "b", value: "blair" },
      ],
    };
    const during = frameAt(demo, 100 + duration / 2);
    expect(during.selectedConversationId).toBe("b");
    expect(during.draft).toBe("blair");
    expect(during.messages.map((item) => item.id)).toEqual(["b1"]);
    expect(during.beforeState).toMatchObject({
      selectedConversationId: "a",
      draft: "keep-a",
      typing: true,
      scroll: 8,
    });
    expect(during.beforeState?.messages.map((item) => item.id)).toEqual(["a1"]);
    expect(during.cues.find((cue) => cue.kind === "conversation")?.progress).toBe(0.5);
    expect(frameAt(demo, 100 + duration).beforeState).toBeNull();
    expect(frameAt(demo, 50).selectedConversationId).toBe("a");
    expect(frameAt(demo, 50).conversations.find((conversation) => conversation.id === "b")?.draft).toBe("");
  });

  it("retains a closing menu through its exit", () => {
    const demo = ios([
      { type: "overlay", atMs: 0, overlay: { kind: "context-menu", messageId: "m1", x: 4, y: 9 } },
      { type: "overlay", atMs: 300, overlay: { kind: "closed" } },
    ], "conversation");
    const during = frameAt(demo, 300 + pendingCueDurations.contextMenuExit / 2);
    expect(during.overlay).toEqual({ kind: "closed" });
    expect(during.beforeState?.overlay).toEqual({ kind: "context-menu", messageId: "m1", x: 4, y: 9 });
    expect(frameAt(demo, 300 + pendingCueDurations.contextMenuExit).beforeState).toBeNull();
  });

  it("gives a screen effect a finite verified duration", () => {
    const demo = ios([{ type: "screen-effect", atMs: 0, effect: "celebration" }], "conversation");
    const frame = frameAt(demo, 1800);
    expect(frame.cues[0]).toMatchObject({ kind: "screen-effect", progress: 0.5, durationMs: 3600 });
  });
});
