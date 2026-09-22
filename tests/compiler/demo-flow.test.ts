import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import capabilities from "@/contracts/capabilities.json";
import motionTokens from "@/contracts/motion-tokens.json";

const nowMs = Date.parse("2026-09-21T16:41:00.000Z");
const firstAt = Date.parse("2026-09-21T16:39:00.000Z");
const secondAt = Date.parse("2026-09-21T16:40:00.000Z");

function flow(overrides: Record<string, unknown> = {}) {
  return {
    id: "foundation-text",
    title: "Foundation text",
    platform: "ios",
    theme: "light",
    contact: { name: "Alex Morgan", initials: "AM" },
    nowMs,
    draft: "On my way over.",
    typing: false,
    screen: "conversation",
    messages: [
      {
        id: "in-1",
        text: "Are you close?",
        direction: "incoming",
        atMs: firstAt,
        status: "read",
      },
      {
        id: "out-1",
        text: "See you there.",
        direction: "outgoing",
        atMs: secondAt,
        status: "delivered",
      },
    ],
    ...overrides,
  };
}

function messageMotion() {
  const token = motionTokens.tokens.find((entry) => entry.symbol === "messageMotion");
  return token?.value as { send: { duration: number }; receive: { duration: number } };
}

function bubbleDurations() {
  const token = motionTokens.tokens.find((entry) => entry.symbol === "bubbleEffectDuration");
  return token?.value as { slam: number; loud: number; gentle: number; "invisible-ink": number };
}

describe("validateDemo", () => {
  it("accepts the foundation flow and preserves text", () => {
    const validated = validateDemo(flow());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.demo.messages.map((message) => message.text)).toEqual(["Are you close?", "See you there."]);
    expect(validated.demo.messages[0]).not.toHaveProperty("kind");
  });

  it("rejects unknown fields instead of dropping them", () => {
    const validated = validateDemo(flow({ extra: true }));
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.issues).toContainEqual({
      path: "/extra",
      message: 'UNKNOWN_FIELD: unknown field "extra"',
    });
  });

  it("rejects a poll without inventing a text or card fallback", () => {
    const polls = capabilities.unsupported.find((entry) => entry.id === "polls");
    const validated = validateDemo({
      steps: [{ message: { kind: "poll" } }],
    });
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.issues).toEqual([
      {
        path: "/steps/0/message/kind",
        message: `UNSUPPORTED_COMPONENT: ${polls?.reason}`,
      },
    ]);
    expect(JSON.stringify(validated.issues)).not.toMatch(/fallback/i);
  });

  it("classifies a poll message on a flow separately from a catalogue-only system line", () => {
    const poll = validateDemo(
      flow({
        messages: [{ id: "p", text: "", direction: "incoming", atMs: 0, kind: "poll" }],
      }),
    );
    const system = validateDemo(
      flow({
        messages: [{ id: "s", text: "Alex started a call", direction: "incoming", atMs: 0, kind: "system" }],
      }),
    );
    expect(poll.ok).toBe(false);
    expect(system.ok).toBe(false);
    if (poll.ok || system.ok) return;
    expect(poll.issues.some((entry) => entry.path === "/messages/0/kind" && entry.message.startsWith("UNSUPPORTED_COMPONENT:"))).toBe(true);
    expect(system.issues.some((entry) => entry.path === "/messages/0/kind" && entry.message.startsWith("CATALOGUE_ONLY:"))).toBe(true);
  });

  it("rejects duplicate ids, bad timestamps, missing payloads, bad assets, and platform mismatches", () => {
    const duplicate = validateDemo(
      flow({
        messages: [
          { id: "same", text: "One", direction: "incoming", atMs: 0 },
          { id: "same", text: "Two", direction: "outgoing", atMs: 10 },
        ],
      }),
    );
    const stamped = validateDemo(
      flow({
        messages: [
          { id: "a", text: "One", direction: "incoming", atMs: 30 },
          { id: "b", text: "Two", direction: "outgoing", atMs: 10 },
        ],
      }),
    );
    const fractional = validateDemo(
      flow({
        messages: [{ id: "a", text: "One", direction: "incoming", atMs: 1.5 }],
      }),
    );
    const link = validateDemo(
      flow({
        messages: [{ id: "a", text: "Look", direction: "incoming", atMs: 0, kind: "link" }],
      }),
    );
    const asset = validateDemo(
      flow({
        messages: [
          {
            id: "a",
            text: "",
            direction: "incoming",
            atMs: 0,
            kind: "image",
            images: [{ src: "../secret.png", alt: "Secret" }],
          },
        ],
      }),
    );
    const script = validateDemo(
      flow({
        messages: [
          {
            id: "a",
            text: "Look",
            direction: "incoming",
            atMs: 0,
            kind: "link",
            link: { url: "javascript:alert(1)" },
          },
        ],
      }),
    );
    const platform = validateDemo(flow({ platform: "macos", screen: "new-message" }));

    for (const result of [duplicate, stamped, fractional, link, asset, script, platform]) {
      expect(result.ok).toBe(false);
    }
    if (duplicate.ok || stamped.ok || fractional.ok || link.ok || asset.ok || script.ok || platform.ok) return;
    expect(duplicate.issues.some((entry) => entry.path === "/messages/1/id" && entry.message.startsWith("DUPLICATE_ID:"))).toBe(true);
    expect(stamped.issues.some((entry) => entry.path === "/messages/1/atMs" && entry.message.startsWith("INVALID_TIMESTAMP:"))).toBe(true);
    expect(fractional.issues.some((entry) => entry.path === "/messages/0/atMs" && entry.message.startsWith("INVALID_TIMESTAMP:"))).toBe(true);
    expect(link.issues).toContainEqual({
      path: "/messages/0/link",
      message: "MISSING_FIELD: link messages require a link payload",
    });
    expect(asset.issues.some((entry) => entry.path === "/messages/0/images/0/src" && entry.message.startsWith("INVALID_ASSET:"))).toBe(true);
    expect(script.issues.some((entry) => entry.path === "/messages/0/link/url" && entry.message.startsWith("INVALID_ASSET:"))).toBe(true);
    expect(platform.issues.some((entry) => entry.path === "/screen" && entry.message.startsWith("PLATFORM_MISMATCH:"))).toBe(true);
  });

  it("rejects forward replies, live-reply removal, incoming edits, and dangling reactions", () => {
    const forward = validateDemo(
      flow({
        messages: [
          { id: "a", text: "First", direction: "outgoing", atMs: 0, replyTo: "b" },
          { id: "b", text: "Second", direction: "incoming", atMs: 1000 },
        ],
      }),
    );
    const removed = validateDemo(
      flow({
        messages: [
          { id: "a", text: "First", direction: "outgoing", atMs: 0, removed: true },
          { id: "b", text: "Reply", direction: "incoming", atMs: 1000, replyTo: { id: "a", text: "First", direction: "outgoing" } },
        ],
      }),
    );
    const edited = validateDemo(
      flow({
        messages: [{ id: "a", text: "Nope", direction: "incoming", atMs: 0, edited: true }],
      }),
    );
    const reaction = validateDemo(
      flow({
        messages: [
          {
            id: "a",
            text: "Hi",
            direction: "outgoing",
            atMs: 0,
            reactions: [{ type: "love", messageId: "missing" }],
          },
        ],
      }),
    );
    for (const result of [forward, removed, edited, reaction]) expect(result.ok).toBe(false);
    if (forward.ok || removed.ok || edited.ok || reaction.ok) return;
    expect(forward.issues.some((entry) => entry.path === "/messages/0/replyTo" && entry.message.startsWith("INVALID_REFERENCE:"))).toBe(true);
    expect(removed.issues.some((entry) => entry.path === "/messages/0/removed" && entry.message.startsWith("INVALID_REFERENCE:"))).toBe(true);
    expect(edited.issues.some((entry) => entry.path === "/messages/0/edited" && entry.message.startsWith("INVALID_VALUE:"))).toBe(true);
    expect(reaction.issues.some((entry) => entry.path === "/messages/0/reactions" && entry.message.startsWith("INVALID_REFERENCE:"))).toBe(true);
  });

  it("fails a send that would cancel an overlapping arrival and allows a non-animated image insert", () => {
    const send = messageMotion().send.duration;
    const overlap = validateDemo(
      flow({
        messages: [
          { id: "out", text: "Sending", direction: "outgoing", atMs: 1000 },
          { id: "in", text: "Too soon", direction: "incoming", atMs: 1000 + send - 1 },
        ],
      }),
    );
    const image = validateDemo(
      flow({
        messages: [
          { id: "out", text: "Sending", direction: "outgoing", atMs: 1000 },
          {
            id: "pic",
            text: "",
            direction: "incoming",
            atMs: 1000 + 100,
            kind: "image",
            images: [{ src: "assets/pic.png", alt: "Pic", width: 40, height: 30 }],
          },
        ],
      }),
    );
    const clear = validateDemo(
      flow({
        messages: [
          { id: "out", text: "Sending", direction: "outgoing", atMs: 1000 },
          { id: "in", text: "After", direction: "incoming", atMs: 1000 + send },
        ],
      }),
    );
    expect(overlap.ok).toBe(false);
    expect(image.ok).toBe(true);
    expect(clear.ok).toBe(true);
    if (overlap.ok) return;
    expect(overlap.issues.some((entry) => entry.path === "/messages/1/atMs" && entry.message.startsWith("OVERLAPPING_ARRIVAL:"))).toBe(true);
  });

  it("rejects native send effects on non-text media", () => {
    const validated = validateDemo(
      flow({
        messages: [
          {
            id: "pic",
            text: "",
            direction: "outgoing",
            atMs: 0,
            kind: "image",
            effect: "slam",
            images: [{ src: "pic.png", alt: "Pic" }],
          },
        ],
      }),
    );
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.issues.some((entry) => entry.path === "/messages/0/effect" && entry.message.startsWith("INVALID_ANIMATION:"))).toBe(true);
    const incomingEffect = validateDemo(
      flow({
        messages: [{ id: "in", text: "Hi", direction: "incoming", atMs: 0, effect: "slam" }],
      }),
    );
    expect(incomingEffect.ok).toBe(false);
    if (incomingEffect.ok) return;
    expect(incomingEffect.issues.some((entry) => entry.path === "/messages/0/effect" && entry.message.startsWith("INVALID_ANIMATION:"))).toBe(true);
  });
});

describe("compileDemo", () => {
  it("compiles equivalent flows to the same JSON without reordering equal times", () => {
    const first = validateDemo(flow());
    const second = validateDemo({
      messages: [
        {
          status: "read",
          atMs: firstAt,
          direction: "incoming",
          text: "Are you close?",
          id: "in-1",
        },
        {
          status: "delivered",
          atMs: secondAt,
          direction: "outgoing",
          text: "See you there.",
          id: "out-1",
        },
      ],
      screen: "conversation",
      typing: false,
      draft: "On my way over.",
      nowMs,
      contact: { initials: "AM", name: "Alex Morgan" },
      theme: "light",
      platform: "ios",
      title: "Foundation text",
      id: "foundation-text",
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    const compiledA = compileDemo(first.demo);
    const compiledB = compileDemo(second.demo);
    expect(JSON.stringify(compiledA)).toBe(JSON.stringify(compiledB));
    expect(JSON.stringify(compileDemo(first.demo))).toBe(JSON.stringify(compiledA));
    expect(compiledA.platform).toBe("ios");
    expect(compiledA.durationMs).toBe(secondAt - firstAt + messageMotion().send.duration);
    expect(compiledA.events.map((event) => event.type)).toEqual(["message", "message", "draft", "typing"]);
    const messages = compiledA.events.filter((event) => event.type === "message");
    expect(messages.map((event) => (event.type === "message" ? event.atMs : -1))).toEqual([0, secondAt - firstAt]);
  });

  it("keeps equal-time messages in source order and does not invent a photo caption", () => {
    const validated = validateDemo(
      flow({
        messages: [
          { id: "m1", text: "Same", direction: "incoming", atMs: 5000 },
          {
            id: "m2",
            text: "caption stays here",
            direction: "incoming",
            atMs: 5000,
            kind: "image",
            images: [{ src: "a.png", alt: "A" }],
          },
        ],
      }),
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    const messages = compiled.events.filter((event) => event.type === "message");
    expect(messages).toHaveLength(1 + 1);
    expect(messages.map((event) => (event.type === "message" ? event.message.id : ""))).toEqual(["m1", "m2"]);
    expect(messages.every((event) => event.type === "message" && event.atMs === 0)).toBe(true);
    expect(compiled.events.filter((event) => event.type === "message")).toHaveLength(2);
    const image = messages[1];
    expect(image && image.type === "message" && image.message.text).toBe("caption stays here");
  });

  it("uses the bubble-effect token instead of stacking a send flight", () => {
    const gentle = bubbleDurations().gentle;
    const validated = validateDemo(
      flow({
        messages: [
          { id: "out", text: "Wow", direction: "outgoing", atMs: 0, effect: "gentle" },
          { id: "next", text: "Next", direction: "incoming", atMs: gentle - 1 },
        ],
      }),
    );
    expect(validated.ok).toBe(false);
    if (validated.ok) return;
    expect(validated.issues.some((entry) => entry.message.includes(`${gentle}ms`))).toBe(true);
  });

  it("copies messages so later mutation does not change the compiled demo", () => {
    const validated = validateDemo(flow());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    validated.demo.messages[0].text = "changed";
    const event = compiled.events[0];
    expect(event && event.type === "message" && event.message.text).toBe("Are you close?");
  });
});

describe("node boundary", () => {
  it("compiles without document, window, or network", () => {
    const calls: unknown[] = [];
    const previous = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      throw new Error("network");
    }) as typeof fetch;
    try {
      expect(typeof document).toBe("undefined");
      expect(typeof window).toBe("undefined");
      const validated = validateDemo(flow());
      expect(validated.ok).toBe(true);
      if (!validated.ok) return;
      const compiled = compileDemo(validated.demo);
      expect(compiled.id).toBe("foundation-text");
      expect(calls).toEqual([]);
      expect(JSON.stringify(compiled)).not.toMatch(/\/Users\//);
    } finally {
      globalThis.fetch = previous;
    }
  });

  it("does not import the pinned browser components", () => {
    const directory = path.resolve("src/compiler");
    const source = readdirSync(directory)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(path.join(directory, file), "utf8"))
      .join("\n");
    expect(source).not.toMatch(/components\/imessage/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
