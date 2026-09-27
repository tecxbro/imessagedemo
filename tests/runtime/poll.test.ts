import { describe, expect, it } from "vitest";
import { compileDemo } from "@/compiler/compile";
import { validateDemo } from "@/compiler/validate";
import { applyPollVote } from "@/components/owned/ios-poll";
import { stateAt } from "@/runtime";
import type { DemoFlow } from "@/contracts";

const base = {
  id: "poll-flow",
  title: "Poll",
  platform: "ios" as const,
  theme: "light" as const,
  contact: { name: "Alex Morgan", initials: "AM" },
  nowMs: 1_700_000_000_000,
  draft: "",
  typing: false,
  screen: "conversation" as const,
  participants: [
    { id: "me", name: "You", me: true },
    { id: "alex", name: "Alex Morgan", initials: "AM" },
    { id: "jordan", name: "Jordan Lee", initials: "JL" },
  ],
};

function flow(extra: Partial<DemoFlow>): DemoFlow {
  return { ...base, messages: [], ...extra };
}

describe("polls", () => {
  it("rejects more than 12 options and a vote for a missing option", () => {
    const tooMany = validateDemo(flow({
      messages: [{
        id: "p",
        text: "Where?",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: { question: "Where?", options: Array.from({ length: 13 }, (_, index) => ({ id: `o${index}`, text: `Option ${index}` })) },
      }],
    }));
    expect(tooMany.ok).toBe(false);
    const missing = validateDemo(flow({
      messages: [{
        id: "p",
        text: "Where?",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: { question: "Where?", options: [{ id: "a", text: "A" }], votes: [{ participantId: "me", optionId: "missing" }] },
      }],
    }));
    expect(missing.ok).toBe(false);
  });

  it("keeps vote totals idempotent and does not vote for an added choice", () => {
    const validated = validateDemo(flow({
      messages: [{
        id: "p",
        text: "Lunch?",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: {
          question: "Lunch?",
          options: [{ id: "yes", text: "Yes" }, { id: "no", text: "No" }],
          votes: [{ participantId: "alex", optionId: "yes" }],
        },
      }],
      events: [
        { type: "poll-vote", atMs: 100, messageId: "p", participantId: "me", optionId: "yes", voted: true },
        { type: "poll-vote", atMs: 150, messageId: "p", participantId: "me", optionId: "yes", voted: true },
        { type: "poll-vote", atMs: 200, messageId: "p", participantId: "me", optionId: "no", voted: true },
        { type: "poll-vote", atMs: 250, messageId: "p", participantId: "alex", optionId: "yes", voted: false },
        { type: "poll-option", atMs: 300, messageId: "p", optionId: "later", text: "Later" },
        { type: "overlay", atMs: 400, overlay: { kind: "poll-details", messageId: "p" } },
      ],
    }));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    const mid = stateAt(compiled, 200);
    const yes = mid.messages[0]?.poll?.votes?.filter((vote) => vote.optionId === "yes") ?? [];
    expect(yes).toEqual([
      { participantId: "alex", optionId: "yes" },
      { participantId: "me", optionId: "yes" },
    ]);
    const end = stateAt(compiled, 400);
    expect(end.messages[0]?.poll?.options.map((option) => option.id)).toEqual(["yes", "no", "later"]);
    expect(end.messages[0]?.poll?.votes).toEqual([
      { participantId: "me", optionId: "yes" },
      { participantId: "me", optionId: "no" },
    ]);
    expect(end.overlay).toEqual({ kind: "poll-details", messageId: "p" });
    const replay = stateAt(compiled, 0);
    expect(replay.messages[0]?.poll?.votes).toEqual([{ participantId: "alex", optionId: "yes" }]);
    expect(replay.overlay.kind).toBe("closed");
  });

  it("does not double-count a vote that is applied twice", () => {
    expect(applyPollVote([{ participantId: "me", optionId: "yes" }], { participantId: "me", optionId: "yes" }, true)).toEqual([
      { participantId: "me", optionId: "yes" },
    ]);
  });

  it("rejects a poll on macOS", () => {
    const result = validateDemo(flow({
      platform: "macos",
      messages: [{
        id: "p",
        text: "Lunch?",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: { question: "Lunch?", options: [{ id: "yes", text: "Yes" }] },
      }],
    }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.some((issue) => issue.message.includes("PLATFORM_MISMATCH"))).toBe(true);
  });
});
