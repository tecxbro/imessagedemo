import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { authoringDocumentSchema, toDemoFlow } from "@/cli/authoring";
import type { CompiledDemo } from "@/contracts";
import { effectiveSourceIndex, frameAt } from "@/runtime/project";
import { toUpstreamMessage } from "@/renderers/ios/adapt";
import { deriveCues, typingDotPhaseMs } from "@/renderers/ios/cues";
import { projectFrame } from "@/renderers/ios/project";

const nowMs = Date.parse("2026-09-21T16:41:00.000Z");

function compile(overrides: Record<string, unknown> = {}) {
  const validated = validateDemo({
    id: "typing-order",
    title: "Typing order",
    platform: "ios",
    theme: "light",
    contact: { name: "Harbor", initials: "HA" },
    nowMs,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [{ id: "customer-1", text: "Hello", direction: "outgoing", atMs: 0, status: "delivered" }],
    ...overrides,
  });
  expect(validated.ok, validated.ok ? "" : validated.issues.map((issue) => issue.message).join("\n")).toBe(true);
  if (!validated.ok) throw new Error("invalid flow");
  return compileDemo(validated.demo);
}

function elapsedAt(compiled: CompiledDemo, timeMs: number): number | null {
  return deriveCues(compiled, projectFrame(compiled, timeMs)).typingElapsed;
}

describe("typing timeline", () => {
  it("lets an explicit typing-on at time zero override the initial false value", () => {
    const compiled = compile({
      draft: "stale",
      typing: false,
      events: [
        { type: "typing", atMs: 0, typing: true },
        { type: "draft", atMs: 0, value: "kept" },
      ],
    });
    const opening = frameAt(compiled, 0);
    expect(opening.typing).toBe(true);
    expect(opening.draft).toBe("kept");
    expect(elapsedAt(compiled, 0)).toBe(0);
    expect(elapsedAt(compiled, 360)).toBe(360);
    const authoredIndex = compiled.events.findIndex((event) => event.type === "typing" && event.typing === true);
    const initialIndex = compiled.events.findIndex((event) => event.type === "typing" && event.typing === false);
    const authored = compiled.events[authoredIndex];
    const initial = compiled.events[initialIndex];
    expect(authored && initial).toBeTruthy();
    if (!authored || !initial) return;
    expect(effectiveSourceIndex(authored, authoredIndex)).toBeGreaterThan(effectiveSourceIndex(initial, initialIndex));
    expect(compiled.events.filter((event) => event.type === "typing" || event.type === "draft").map((event) => event.type)).toEqual([
      "typing",
      "draft",
      "draft",
      "typing",
    ]);
  });

  it("keeps authored event order and calculates each typing interval from the ordered clock", () => {
    const compiled = compile({
      messages: [
        { id: "customer-1", text: "Hello", direction: "outgoing", atMs: 0, status: "delivered" },
        { id: "company-1", text: "On it", direction: "incoming", atMs: 2000 },
        { id: "company-2", text: "Done", direction: "incoming", atMs: 5000 },
      ],
      events: [
        { type: "typing", atMs: 400, typing: true },
        { type: "draft", atMs: 900, value: "note" },
        { type: "typing", atMs: 2000, typing: false },
        { type: "typing", atMs: 3500, typing: true },
        { type: "typing", atMs: 5000, typing: false },
      ],
    });
    expect(compiled.events.filter((event) => event.sourceIndex === undefined || event.sourceIndex >= 0).map((event) => event.type)).toEqual([
      "message",
      "message",
      "message",
      "typing",
      "draft",
      "typing",
      "typing",
      "typing",
    ]);
    expect(frameAt(compiled, 0).typing).toBe(false);
    expect(frameAt(compiled, 399).typing).toBe(false);
    expect(frameAt(compiled, 400).typing).toBe(true);
    expect(frameAt(compiled, 1999).typing).toBe(true);
    expect(frameAt(compiled, 2000).typing).toBe(false);
    expect(frameAt(compiled, 2000).messages.map((message) => message.id)).toEqual(["customer-1", "company-1"]);
    expect(frameAt(compiled, 3500).typing).toBe(true);
    expect(frameAt(compiled, 4999).typing).toBe(true);
    expect(frameAt(compiled, 5000).typing).toBe(false);
    expect(elapsedAt(compiled, 900)).toBe(500);
    expect(elapsedAt(compiled, 2000)).toBeNull();
    expect(elapsedAt(compiled, 3900)).toBe(400);
    expect(frameAt(compiled, 1000).draft).toBe("note");
  });

  it("does not clear typing when a message arrives", () => {
    const compiled = compile({
      messages: [
        { id: "customer-1", text: "Hello", direction: "outgoing", atMs: 0 },
        { id: "company-1", text: "Hi", direction: "incoming", atMs: 1000 },
      ],
      events: [{ type: "typing", atMs: 200, typing: true }],
    });
    expect(frameAt(compiled, 1000).typing).toBe(true);
    expect(frameAt(compiled, 1000).messages.map((message) => message.id)).toEqual(["customer-1", "company-1"]);
  });

  it("orders an unsorted typing timeline before measuring the interval", () => {
    const compiled: CompiledDemo = {
      id: "unsorted-typing",
      platform: "ios",
      theme: "light",
      durationMs: 5000,
      contact: { name: "Harbor" },
      nowMs,
      screen: "conversation",
      events: [
        { type: "typing", atMs: 3500, typing: true },
        { type: "typing", atMs: 5000, typing: false },
        { type: "typing", atMs: 400, typing: true },
        { type: "typing", atMs: 2000, typing: false },
        { type: "typing", atMs: 0, typing: false, sourceIndex: -1 },
      ],
    };
    expect(frameAt(compiled, 900).typing).toBe(true);
    expect(elapsedAt(compiled, 900)).toBe(500);
    expect(frameAt(compiled, 2500).typing).toBe(false);
    expect(elapsedAt(compiled, 2500)).toBeNull();
    expect(frameAt(compiled, 4000).typing).toBe(true);
    expect(elapsedAt(compiled, 4000)).toBe(500);
    expect(elapsedAt(compiled, 5000)).toBeNull();
  });

  it("places the dot phase on the same clock as the freeze delay", () => {
    expect(typingDotPhaseMs(0, 360)).toBe(360);
    expect(typingDotPhaseMs(1, 360)).toBe(160);
    expect(typingDotPhaseMs(1, 0)).toBe(1000);
  });
});

describe("reaction timeline", () => {
  it("adds, replaces, removes, and resets classic tapbacks and custom emoji on the owning message", () => {
    const compiled = compile({
      messages: [
        { id: "customer-1", text: "Hello", direction: "outgoing", atMs: 0, status: "delivered" },
        { id: "company-1", text: "Hi", direction: "incoming", atMs: 1000 },
      ],
      events: [
        { type: "reaction", atMs: 1500, messageId: "company-1", reactionId: "tap-company", reaction: { type: "love", byMe: true } },
        { type: "reaction", atMs: 1800, messageId: "customer-1", reactionId: "emoji-customer", reaction: { type: "custom", emoji: "🎉", byMe: false } },
        { type: "reaction", atMs: 2200, messageId: "company-1", reactionId: "tap-company", reaction: { type: "emphasize", byMe: true } },
        { type: "reaction", atMs: 2600, messageId: "company-1", reactionId: "tap-company", reaction: null },
      ],
    });

    const at = (timeMs: number) => frameAt(compiled, timeMs).messages;

    expect(at(1400).every((message) => (message.reactions ?? []).length === 0)).toBe(true);

    const added = at(1600);
    expect(added.find((message) => message.id === "company-1")?.reactions).toEqual([{ id: "tap-company", type: "love", byMe: true }]);
    expect(added.find((message) => message.id === "customer-1")?.reactions ?? []).toEqual([]);
    expect(toUpstreamMessage(added.find((message) => message.id === "company-1")!).reactions).toEqual([{ type: "love", byMe: true }]);

    const both = at(2000);
    expect(both.find((message) => message.id === "customer-1")?.reactions).toEqual([{ id: "emoji-customer", type: "custom", emoji: "🎉", byMe: false }]);
    expect(toUpstreamMessage(both.find((message) => message.id === "customer-1")!).reactions).toEqual([{ type: "custom", emoji: "🎉", byMe: false }]);
    expect(both.find((message) => message.id === "company-1")?.reactions).toEqual([{ id: "tap-company", type: "love", byMe: true }]);

    expect(at(2400).find((message) => message.id === "company-1")?.reactions).toEqual([{ id: "tap-company", type: "emphasize", byMe: true }]);

    const removed = at(2600);
    expect(removed.find((message) => message.id === "company-1")?.reactions ?? []).toEqual([]);
    expect(removed.find((message) => message.id === "customer-1")?.reactions).toEqual([{ id: "emoji-customer", type: "custom", emoji: "🎉", byMe: false }]);

    const reset = at(1000);
    expect(reset.every((message) => (message.reactions ?? []).length === 0)).toBe(true);
  });
});

describe("typing and reactions example", () => {
  it("compiles the runnable example with explicit typing intervals and owned reactions", () => {
    const raw = JSON.parse(readFileSync(new URL("../../examples/typing-reactions.flow.json", import.meta.url), "utf8"));
    const parsed = authoringDocumentSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const validated = validateDemo(toDemoFlow(parsed.data, "ios"));
    expect(validated.ok, validated.ok ? "" : validated.issues.map((issue) => issue.message).join("\n")).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    expect(compiled.screen).toBe("conversation");
    expect(frameAt(compiled, 0).typing).toBe(false);
    expect(frameAt(compiled, 0).messages[0]).toMatchObject({ id: "customer-1", direction: "outgoing" });
    expect(frameAt(compiled, 900).typing).toBe(true);
    expect(elapsedAt(compiled, 900)).toBe(100);
    expect(frameAt(compiled, 2200).typing).toBe(false);
    expect(frameAt(compiled, 2200).messages.find((message) => message.id === "company-1")?.direction).toBe("incoming");
    expect(frameAt(compiled, 3600).messages.find((message) => message.id === "company-1")?.reactions).toEqual([
      { id: "love-company-1", type: "love", byMe: true },
    ]);
    expect(frameAt(compiled, 4600).messages.find((message) => message.id === "customer-1")?.reactions).toEqual([
      { id: "emoji-customer-1", type: "custom", emoji: "🎉", byMe: false },
    ]);
    expect(frameAt(compiled, 6400).typing).toBe(true);
    expect(elapsedAt(compiled, 6400)).toBe(400);
    expect(frameAt(compiled, 7600).typing).toBe(false);
    expect(frameAt(compiled, 8000).messages.map((message) => message.id)).toEqual(["customer-1", "company-1", "customer-2", "company-2"]);
  });
});
