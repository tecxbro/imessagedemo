import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { tapbackMotion } from "@/contracts/tapback-motion";
import type { DemoFlow } from "@/contracts";

function flow(events: DemoFlow["events"], extra: Partial<DemoFlow> = {}): DemoFlow {
  return {
    id: "tapback-compiler",
    title: "Tapback compiler",
    platform: "ios",
    theme: "dark",
    contact: { name: "Contact", initials: "C" },
    nowMs: 0,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [{ id: "target", text: "Where’d u go?", direction: "incoming", atMs: 0 }],
    events,
    ...extra,
  };
}

describe("tapback compilation", () => {
  it("keeps a deep copy of the pending selection and extends the last reaction tail", () => {
    const raw = JSON.parse(readFileSync(new URL("../../examples/ios-tapback-interaction.flow.json", import.meta.url), "utf8")) as DemoFlow;
    const validated = validateDemo(raw);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemo(validated.demo);
    const selected = compiled.events.find((event) => event.type === "overlay" && event.atMs === 3367);
    expect(selected && selected.type === "overlay" ? selected.overlay : null).toEqual({
      kind: "long-press",
      messageId: "target",
      selected: { type: "love" },
    });
    if (selected && selected.type === "overlay" && selected.overlay.kind === "long-press" && selected.overlay.selected && "type" in selected.overlay.selected) {
      selected.overlay.selected.type = "like";
    }
    const fresh = compileDemo(validated.demo);
    const again = fresh.events.find((event) => event.type === "overlay" && event.atMs === 3367);
    expect(again && again.type === "overlay" ? again.overlay : null).toEqual({
      kind: "long-press",
      messageId: "target",
      selected: { type: "love" },
    });
    expect(compiled.durationMs).toBe(3867 + tapbackMotion.reactionLandingMs);
    expect(compiled.durationMs).toBeGreaterThan(3867);
  });

  it("does not treat a remote reaction as a long-press tail by itself beyond the landing", () => {
    const validated = validateDemo(flow([
      { type: "reaction", atMs: 800, messageId: "target", reactionId: "remote", reaction: { type: "like", byMe: false } },
    ]));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(compileDemo(validated.demo).durationMs).toBe(800 + tapbackMotion.reactionLandingMs);
  });

  it("rejects an invalid pending choice and still accepts a legacy long-press", () => {
    const legacy = validateDemo(flow([{ type: "overlay", atMs: 400, overlay: { kind: "long-press", messageId: "target" } }]));
    expect(legacy.ok).toBe(true);
    const empty = validateDemo(flow([{
      type: "overlay",
      atMs: 400,
      overlay: { kind: "long-press", messageId: "target", selected: { emoji: "" } },
    }]));
    expect(empty.ok).toBe(false);
    const bad = validateDemo(flow([{
      type: "overlay",
      atMs: 400,
      overlay: { kind: "long-press", messageId: "target", selected: { type: "nope" } } as never,
    }]));
    expect(bad.ok).toBe(false);
  });
});
