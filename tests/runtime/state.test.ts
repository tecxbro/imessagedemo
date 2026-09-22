import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compiledFixture } from "../contracts/compiled.fixture";
import { frameAtDouble } from "../contracts/doubles";
import { frameAt, logicalState, stateAt, type RuntimeDemo } from "@/runtime";
import { message, richDemo } from "./fixture";

const checkpoints = [0, 50, 150, 500, 845, 1000, 1150, 1300, 1500, 2100, 2300, 2399, 2400, 2700, 3300, 3500, 3700, 4900, 5000];

function prefix(demo: RuntimeDemo, timeMs: number): RuntimeDemo {
  return { ...demo, events: demo.events.filter((event) => event.atMs <= timeMs) };
}

function freeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) freeze(nested);
  return value;
}

describe("stateAt", () => {
  it("matches a prefix replay at checkpoints, boundaries, and mid-animation times", () => {
    for (const timeMs of checkpoints) {
      expect(stateAt(richDemo, timeMs)).toEqual(stateAt(prefix(richDemo, timeMs), timeMs));
      const later = stateAt(prefix(richDemo, timeMs), 99_999);
      expect({ ...later, timeMs }).toEqual(stateAt(richDemo, timeMs));
    }
  });

  it("keeps the declared reference time and the frozen fixture projection", () => {
    expect(stateAt(richDemo, 2400).nowMs).toBe(richDemo.nowMs);
    expect(stateAt(compiledFixture, 0).messages.map((item) => item.id)).toEqual(["in-1"]);
    expect(stateAt(compiledFixture, 1000).messages.map((item) => item.id)).toEqual(
      frameAtDouble(compiledFixture, 1000).messages.map((item) => item.id),
    );
    expect(stateAt(compiledFixture, 1000)).toMatchObject({
      playing: false,
      durationMs: compiledFixture.durationMs,
      draft: "",
      typing: false,
      nowMs: compiledFixture.nowMs,
    });
  });

  it("preserves sourceIndex order for changes at the same millisecond", () => {
    const state = stateAt(richDemo, 1500);
    expect(state.messages.find((item) => item.id === "same")?.text).toBe("after");
    expect(stateAt(richDemo, 1499).messages.some((item) => item.id === "same")).toBe(false);
  });

  it("replaces and removes reactions by id, edits text, and drops removed messages", () => {
    const during = stateAt(richDemo, 1150);
    const replaced = during.messages.find((item) => item.id === "m2");
    expect(replaced?.reactions.map((reaction) => reaction.id)).toEqual(["r1", "r2"]);
    expect(replaced?.reactions[0]).toMatchObject({ type: "emphasize", byMe: true });
    const after = stateAt(richDemo, 1300);
    expect(after.messages.find((item) => item.id === "m2")?.reactions).toEqual([{ id: "r2", type: "like", byMe: false }]);
    expect(after.messages.find((item) => item.id === "m2")?.status).toBeUndefined();
    expect(stateAt(richDemo, 1400).messages.find((item) => item.id === "m2")?.status).toBe("read");
    const removed = stateAt(richDemo, 3500);
    expect(removed.messages.some((item) => item.id === "m3")).toBe(false);
    expect(removed.messages.some((item) => item.text.toLowerCase().includes("remov"))).toBe(false);
  });

  it("keeps reply snapshots fixed and counts live replies", () => {
    const edited = stateAt(richDemo, 2100);
    const root = edited.messages.find((item) => item.id === "m1");
    const reply = edited.messages.find((item) => item.id === "m2");
    expect(root).toMatchObject({ text: "Hello there", edited: true, replyCount: 2 });
    expect(reply?.replyTo).toEqual({ id: "m1", text: "Hello", direction: "incoming" });
    expect(stateAt(richDemo, 5000).messages.find((item) => item.id === "m1")?.replyCount).toBe(1);
  });

  it("does not auto-stop typing or clear a composer, and keeps each conversation's scroll", () => {
    const sent = stateAt(richDemo, 500);
    expect(sent.typing).toBe(true);
    expect(sent.draft).toBe("Hey");
    const away = stateAt(richDemo, 2700);
    expect(away.selectedConversationId).toBe("other");
    expect(away.draft).toBe("Blair draft");
    expect(away.typing).toBe(false);
    expect(away.messages.map((item) => item.id)).toEqual(["earlier"]);
    expect(away.conversations.find((conversation) => conversation.id === "main")).toMatchObject({
      draft: "Hey",
      typing: true,
      scroll: 40,
    });
    const back = stateAt(richDemo, 3300);
    expect(back.selectedConversationId).toBe("main");
    expect(back.draft).toBe("Hey");
    expect(back.typing).toBe(true);
    expect(back.scroll).toBe(40);
    expect(back.conversations.find((conversation) => conversation.id === "other")).toMatchObject({
      draft: "Blair draft",
      typing: true,
      scroll: 12,
    });
  });

  it("does not mutate the compiled input", () => {
    const demo = freeze(structuredClone(richDemo));
    const before = structuredClone(demo);
    stateAt(demo, 2400);
    frameAt(demo, 2400);
    expect(demo).toEqual(before);
    const first = stateAt(richDemo, 1000);
    first.messages.push(message("leak", "nope", "incoming") as typeof first.messages[number]);
    expect(stateAt(richDemo, 1000).messages.some((item) => item.id === "leak")).toBe(false);
  });

  it("does not read the wall clock or the pinned components", () => {
    const files = readdirSync(new URL("../../src/runtime/", import.meta.url)).filter((file) => file.endsWith(".ts"));
    const source = files.map((file) => readFileSync(new URL(`../../src/runtime/${file}`, import.meta.url), "utf8")).join("\n");
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("setTimeout");
    expect(source).not.toContain("components/imessage");
  });
});

describe("logical state", () => {
  it("omits cues from stateAt", () => {
    expect(stateAt(richDemo, 2300)).not.toHaveProperty("cues");
    expect(stateAt(richDemo, 2300)).not.toHaveProperty("beforeState");
    expect(logicalState(frameAt(richDemo, 2300))).toEqual(stateAt(richDemo, 2300));
  });
});
