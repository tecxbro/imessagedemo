import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authoringDocumentSchema, toDemoFlow } from "@/cli/authoring";
import { compileDemo, validateDemo } from "@/compiler";
import { frameAt } from "@/runtime";

const flow = {
  id: "composer", title: "Composer", platform: "ios", theme: "light",
  contact: { name: "Sunday" }, nowMs: 10000, startAtMs: 1000,
  draft: "", typing: false, screen: "conversation",
  messages: [{ id: "sent", direction: "outgoing", text: "Hi 👋🏽", atMs: 4000 }],
  events: [
    { type: "draft", atMs: 2000, value: "Hi" },
    { type: "draft", atMs: 3500, value: "Hi 👋🏽" },
    { type: "draft", atMs: 4000, value: "" },
  ],
};

describe("outgoing composer timeline", () => {
  it("preserves an explicit opening through CLI conversion and clears the draft at the send", () => {
    const parsed = toDemoFlow(authoringDocumentSchema.parse(flow), "ios");
    const result = validateDemo(parsed);
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    const compiled = compileDemo(result.demo);
    expect(frameAt(compiled, 0).messages).toHaveLength(0);
    expect(frameAt(compiled, 1000).draft).toBe("Hi");
    expect(frameAt(compiled, 2999).draft).toBe("Hi 👋🏽");
    expect(frameAt(compiled, 3000).draft).toBe("");
    expect(frameAt(compiled, 3000).messages.map(m => m.id)).toContain("sent");
    // Seeking backward reconstructs the draft without retaining a later sent message.
    expect(frameAt(compiled, 1000).messages).toHaveLength(0);
    expect(frameAt(compiled, 1000).draft).toBe("Hi");
  });

  it.each([-1, 1.5, "1000", 4001])("rejects an invalid opening %s", startAtMs => {
    expect(validateDemo({ ...flow, startAtMs }).ok).toBe(false);
  });

  it("rejects events before the declared opening and retains the default first-message clock", () => {
    expect(validateDemo({ ...flow, events: [{ type: "draft", atMs: 999, value: "H" }] }).ok).toBe(false);
    const { startAtMs, ...withoutOpening } = flow;
    expect(validateDemo(withoutOpening).ok).toBe(false);
    const result = validateDemo({ ...withoutOpening, events: [] });
    if (!result.ok) throw new Error(JSON.stringify(result.issues));
    expect(compileDemo(result.demo).events.find(e => e.type === "message")?.atMs).toBe(0);
  });

  for (const name of ["coffee-poll", "dinner-poll", "laundry-poll", "dinner-cleanup", "morning-espresso", "sock-pile"]) {
    it(`keeps every ${name} blue text message synchronized with its draft`, () => {
      const document = authoringDocumentSchema.parse(JSON.parse(readFileSync(`scenarios/sunday-${name}.json`, "utf8")));
      const result = validateDemo(toDemoFlow(document, "ios"));
      if (!result.ok) throw new Error(JSON.stringify(result.issues));
      const compiled = compileDemo(result.demo);
      expect(frameAt(compiled, 0).messages).toHaveLength(0);
      for (const message of result.demo.messages) {
        const atMs = message.atMs - result.demo.startAtMs!;
        if (message.direction === "outgoing" && (!message.kind || message.kind === "text")) {
          expect(frameAt(compiled, atMs - 1).draft).toBe(message.text);
          expect(frameAt(compiled, atMs).draft).toBe("");
          expect(frameAt(compiled, atMs).messages.map(m => m.id)).toContain(message.id);
        } else if (message.direction === "incoming") {
          expect(frameAt(compiled, atMs).draft).toBe("");
        }
      }
    });
  }
});
