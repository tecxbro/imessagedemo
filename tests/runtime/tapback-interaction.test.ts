import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { tapbackMotion } from "@/contracts/tapback-motion";
import { frameAt } from "@/runtime";
import { controlledLongPressPose } from "@/renderers/ios/interaction-state";
import type { DemoFlow } from "@/contracts";

function compiledFrom(raw: DemoFlow) {
  const validated = validateDemo(raw);
  if (!validated.ok) throw new Error(validated.issues.map((issue) => issue.message).join("\n"));
  return compileDemo(validated.demo);
}

const example = compiledFrom(JSON.parse(readFileSync(new URL("../../examples/ios-tapback-interaction.flow.json", import.meta.url), "utf8")) as DemoFlow);

describe("tapback runtime projection", () => {
  it("opens the overlay without adding a reaction, then selects without a new enter or badge", () => {
    const opened = frameAt(example, 933);
    expect(opened.overlay).toEqual({ kind: "long-press", messageId: "target" });
    expect(opened.messages[0]?.reactions ?? []).toEqual([]);
    expect(opened.cues.some((cue) => cue.kind === "overlay-enter")).toBe(true);
    expect(opened.cues.some((cue) => cue.kind === "overlay-exit")).toBe(false);

    const selected = frameAt(example, 3367);
    expect(selected.overlay).toEqual({ kind: "long-press", messageId: "target", selected: { type: "love" } });
    expect(selected.messages[0]?.reactions ?? []).toEqual([]);
    expect(selected.cues.some((cue) => cue.kind === "overlay-enter")).toBe(false);
    expect(selected.cues.some((cue) => cue.kind === "overlay-exit")).toBe(false);
    expect(selected.cues.some((cue) => cue.kind === "overlay-select")).toBe(true);
    const pose = controlledLongPressPose(example, selected);
    expect(pose?.phase).toBe("select");
    expect(pose?.entranceElapsedMs).toBe(3367 - 933);
    expect(pose?.elapsedMs).toBe(0);
  });

  it("keeps the exit pose and selection after the logical overlay has closed", () => {
    const closing = frameAt(example, 3567);
    expect(closing.overlay).toEqual({ kind: "closed" });
    expect(closing.messages[0]?.reactions ?? []).toEqual([]);
    const exit = closing.cues.find((cue) => cue.kind === "overlay-exit");
    expect(exit?.detail?.overlay).toEqual({ kind: "long-press", messageId: "target", selected: { type: "love" } });
    expect(exit?.detail?.longPressEntranceStartedAtMs).toBe(933);
    const pose = controlledLongPressPose(example, closing);
    expect(pose).toMatchObject({ id: "target", phase: "exit", selected: { type: "love" } });
    expect(pose?.elapsedMs).toBe(3567 - 3400);

    const gone = frameAt(example, 3400 + tapbackMotion.exitMs);
    expect(gone.cues.some((cue) => cue.kind === "overlay-exit")).toBe(false);
    expect(controlledLongPressPose(example, gone)).toBeNull();
  });

  it("applies the reaction once, after the overlay, and keeps its id", () => {
    const before = frameAt(example, 3866);
    expect(before.messages[0]?.reactions ?? []).toEqual([]);
    const landed = frameAt(example, 3867);
    expect(landed.messages[0]?.reactions).toEqual([{ id: "customer-target", type: "love", byMe: true }]);
    expect(landed.cues.find((cue) => cue.kind === "reaction")?.detail?.reactionId).toBe("customer-target");
    expect(controlledLongPressPose(example, landed)).toBeNull();
  });

  it("does not open a local picker for a remote reaction or replay an initial one", () => {
    const remote = compiledFrom({
      id: "remote-reaction",
      title: "Remote",
      platform: "ios",
      theme: "light",
      contact: { name: "Contact" },
      nowMs: 0,
      draft: "",
      typing: false,
      screen: "conversation",
      messages: [{
        id: "target",
        text: "Already loved",
        direction: "outgoing",
        atMs: 0,
        reactions: [{ id: "existing", type: "like", byMe: false }],
      }],
      events: [
        { type: "reaction", atMs: 500, messageId: "target", reactionId: "remote", reaction: { type: "emphasize", byMe: false } },
      ],
    });
    const frame = frameAt(remote, 500);
    expect(frame.overlay).toEqual({ kind: "closed" });
    expect(controlledLongPressPose(remote, frame)).toBeNull();
    expect(frame.messages[0]?.reactions).toEqual([
      { id: "existing", type: "like", byMe: false },
      { id: "remote", type: "emphasize", byMe: false },
    ]);
  });

  it("does not share selection objects across frames", () => {
    const first = frameAt(example, 3367);
    const second = frameAt(example, 3367);
    if (first.overlay.kind === "long-press" && first.overlay.selected && "type" in first.overlay.selected) {
      first.overlay.selected.type = "like";
    }
    expect(second.overlay).toEqual({ kind: "long-press", messageId: "target", selected: { type: "love" } });
  });

  it("seeks backwards and replays from the events alone", () => {
    expect(controlledLongPressPose(example, frameAt(example, 5333))?.phase).toBeUndefined();
    const early = controlledLongPressPose(example, frameAt(example, 1200));
    expect(early).toMatchObject({ phase: "enter", elapsedMs: 1200 - 933 });
    const again = controlledLongPressPose(example, frameAt(example, 0));
    expect(again).toBeNull();
    expect(frameAt(example, 0).messages[0]?.reactions ?? []).toEqual([]);
  });
});
