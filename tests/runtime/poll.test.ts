import { describe, expect, it } from "vitest";
import { compileDemo } from "@/compiler/compile";
import { validateDemo } from "@/compiler/validate";
import { applyPollVote } from "@/components/owned/ios-poll";
import { pollOptionElapsed } from "@/runtime/poll";
import { stateAt } from "@/runtime";
import { samplePollVote, sampleRecordingTranscriptOffset } from "@/renderers/ios/poll/motion";
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
      { participantId: "me", optionId: "yes", atMs: 100 },
    ]);
    const end = stateAt(compiled, 400);
    expect(end.messages[0]?.poll?.options.map((option) => option.id)).toEqual(["yes", "no", "later"]);
    expect(end.messages[0]?.poll?.votes).toEqual([
      { participantId: "me", optionId: "yes", atMs: 100 },
      { participantId: "me", optionId: "no", atMs: 200 },
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

  it("keeps a single-choice vote idempotent and seeks the recorded pose", () => {
    const validated = validateDemo(flow({
      messages: [{
        id: "dinner-poll",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: {
          question: "",
          selectionMode: "single",
          options: [
            { id: "heidis", text: "Heidi’s" },
            { id: "sushis", text: "Sushi’s" },
          ],
          voters: [{ id: "me", avatar: "/demo-assets/ios-poll-reference-voter.png" }],
        },
      }],
      events: [
        { type: "poll-vote", atMs: 1567, messageId: "dinner-poll", participantId: "me", optionId: "heidis", voted: true },
        { type: "poll-vote", atMs: 1800, messageId: "dinner-poll", participantId: "me", optionId: "heidis", voted: true },
      ],
    }));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    const before = stateAt(compiled, 1533);
    expect(before.messages[0]?.poll?.votes ?? []).toEqual([]);
    expect(pollOptionElapsed(before.messages[0]?.poll?.votes, 1533)).toBeNull();
    const onset = stateAt(compiled, 1567);
    expect(onset.messages[0]?.poll?.votes).toEqual([{ participantId: "me", optionId: "heidis", atMs: 1567 }]);
    expect(samplePollVote(pollOptionElapsed(onset.messages[0]?.poll?.votes, 1567) ?? -1).widthProgress).toBe(0);
    expect(samplePollVote(0).label).toEqual([255, 250, 243]);
    const peak = samplePollVote(1900 - 1567);
    expect(peak.widthProgress).toBeGreaterThan(1);
    expect(peak.rowWidth).toBeGreaterThan(606);
    const rest = stateAt(compiled, 2434);
    expect(rest.messages[0]?.poll?.votes).toEqual([{ participantId: "me", optionId: "heidis", atMs: 1567 }]);
    const settled = samplePollVote(pollOptionElapsed(rest.messages[0]?.poll?.votes, 2434) ?? 0);
    expect(settled.widthProgress).toBe(1);
    expect(settled.rowWidth).toBe(606);
    const replay = stateAt(compiled, 0);
    expect(replay.messages[0]?.poll?.votes ?? []).toEqual([]);
    expect(sampleRecordingTranscriptOffset(3000)).toBe(0);
    expect(sampleRecordingTranscriptOffset(3466.666667)).toBeGreaterThan(200);
  });

  it("does not let one poll's vote change another poll with the same label", () => {
    const validated = validateDemo(flow({
      messages: [
        {
          id: "a",
          text: "",
          direction: "incoming",
          atMs: 0,
          kind: "poll",
          poll: { question: "", options: [{ id: "same", text: "Yes" }] },
        },
        {
          id: "b",
          text: "",
          direction: "incoming",
          atMs: 0,
          kind: "poll",
          poll: { question: "", options: [{ id: "same", text: "Yes" }] },
        },
      ],
      events: [{ type: "poll-vote", atMs: 50, messageId: "a", participantId: "me", optionId: "same", voted: true }],
    }));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const end = stateAt(compileDemo(validated.demo), 50);
    expect(end.messages[0]?.poll?.votes).toEqual([{ participantId: "me", optionId: "same", atMs: 50 }]);
    expect(end.messages[1]?.poll?.votes ?? []).toEqual([]);
  });

  it("rejects duplicate options, a missing avatar, a dangling voter, and a vote on text", () => {
    const duplicate = validateDemo(flow({
      messages: [{
        id: "p",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: { question: "Q", options: [{ id: "a", text: "A" }, { id: "a", text: "B" }] },
      }],
    }));
    expect(duplicate.ok).toBe(false);
    const avatar = validateDemo(flow({
      messages: [{
        id: "p",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: { question: "", options: [{ id: "a", text: "A" }], voters: [{ id: "me", avatar: "https://example.com/a.png" }] },
      }],
    }));
    expect(avatar.ok).toBe(false);
    const dangling = validateDemo(flow({
      messages: [{
        id: "p",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: {
          question: "",
          options: [{ id: "a", text: "A" }],
          voters: [{ id: "me", avatar: "/demo-assets/ios-poll-reference-voter.png" }],
        },
      }],
      events: [{ type: "poll-vote", atMs: 10, messageId: "p", participantId: "nope", optionId: "a", voted: true }],
    }));
    expect(dangling.ok).toBe(false);
    const text = validateDemo(flow({
      messages: [{ id: "m", text: "Hi", direction: "incoming", atMs: 0 }],
      events: [{ type: "poll-vote", atMs: 10, messageId: "m", participantId: "me", optionId: "a", voted: true }],
    }));
    expect(text.ok).toBe(false);
    const early = validateDemo(flow({
      messages: [{
        id: "p",
        text: "",
        direction: "incoming",
        atMs: 100,
        kind: "poll",
        poll: { question: "", options: [{ id: "a", text: "A" }] },
      }],
      events: [{ type: "poll-vote", atMs: 10, messageId: "p", participantId: "me", optionId: "a", voted: true }],
    }));
    expect(early.ok).toBe(false);
  });

  it("accepts a label alias and an omitted voted flag as a cast vote", () => {
    const validated = validateDemo({
      ...base,
      messages: [{
        id: "p",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "poll",
        poll: {
          selectionMode: "single",
          options: [{ id: "a", label: "Cedar" }, { id: "b", label: "Maple" }],
          voters: [{ id: "me", avatar: "/demo-assets/ios-poll-reference-voter.png" }],
        },
      }],
      events: [{ type: "poll-vote", atMs: 40, messageId: "p", voterId: "me", optionId: "a" }],
    });
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.demo.messages[0]?.poll?.options[0]?.text).toBe("Cedar");
    const voted = stateAt(compileDemo(validated.demo), 40);
    expect(voted.messages[0]?.poll?.votes).toEqual([{ participantId: "me", optionId: "a", atMs: 40 }]);
  });
});
