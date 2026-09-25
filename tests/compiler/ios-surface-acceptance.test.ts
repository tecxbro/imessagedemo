import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import type { CompiledDemo, DemoFlow, DemoTheme } from "@/contracts";
import { frameAt, pendingCueDurations, screenEffectDuration, screenTransitionDuration } from "@/runtime";
import type { VisualFrame } from "@/runtime";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const light = JSON.parse(readFileSync(path.join(root, "scenarios/ios-surface-ios-light.json"), "utf8")) as DemoFlow;
const mid = (name: string) => `ios-surface-ios-light-${name}`;

function compileTheme(theme: DemoTheme): CompiledDemo {
  const validated = validateDemo({ ...light, id: `ios-surface-ios-${theme}`, theme });
  expect(validated.ok, validated.ok ? "" : validated.issues.map((issue) => `${issue.path} ${issue.message}`).join("\n")).toBe(true);
  if (!validated.ok) throw new Error("invalid surface");
  return compileDemo(validated.demo);
}

function cue(frame: VisualFrame, kind: string) {
  return frame.cues.find((entry) => entry.kind === kind) ?? null;
}

describe("iOS surface acceptance", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`projects the authored conversation in ${theme}`, () => {
      const compiled = compileTheme(theme);
      const at = (absolute: number) => frameAt(compiled, absolute - light.messages[0]!.atMs);

      const incoming = at(1790008860000);
      expect(incoming.messages.map((message) => message.id)).toEqual([mid("m1")]);
      expect(incoming.messages[0]?.direction).toBe("incoming");

      const outgoing = at(1790008862000);
      const sent = outgoing.messages.find((message) => message.id === mid("m2"));
      expect(sent?.direction).toBe("outgoing");
      expect(sent?.readAt).toBe(1790008862000);
      expect(sent?.status).toBe("read");

      const reacted = at(1790008864500);
      expect(reacted.messages.find((message) => message.id === mid("m2"))?.reactions).toEqual([
        expect.objectContaining({ type: "love", byMe: true }),
      ]);

      const replied = at(1790008867000);
      const reply = replied.messages.find((message) => message.id === mid("m3"));
      expect(reply?.replyTo?.id).toBe(mid("m2"));
      expect(replied.messages.find((message) => message.id === mid("m2"))?.replyCount).toBe(1);

      const threadOpen = 1790008869000 - light.messages[0]!.atMs;
      expect(at(threadOpen + light.messages[0]!.atMs - 1).overlay.kind).toBe("closed");
      const threadMid = at(1790008869000 + pendingCueDurations.threadEnter / 2);
      expect(threadMid.overlay).toMatchObject({ kind: "thread", rootId: mid("m2") });
      expect(cue(threadMid, "overlay-enter")?.progress).toBeCloseTo(0.5, 5);
      const threadSettled = at(1790008869000 + pendingCueDurations.threadEnter);
      expect(threadSettled.overlay).toMatchObject({ kind: "thread", rootId: mid("m2") });
      expect(cue(threadSettled, "overlay-enter")).toBeNull();

      const threadClose = 1790008870500;
      const threadExit = at(threadClose + pendingCueDurations.threadExit / 2);
      expect(cue(threadExit, "overlay-exit")?.progress).toBeCloseTo(0.5, 5);
      expect(at(threadClose + pendingCueDurations.threadExit).overlay.kind).toBe("closed");

      const link = at(1790008873000).messages.find((message) => message.id === mid("m4"));
      expect(link?.link).toMatchObject({ url: "https://example.com/notes", title: "Field notes", host: "example.com", image: "/demo-assets/park-64x48.png" });

      const file = at(1790008875000).messages.find((message) => message.id === mid("m5"));
      expect(file?.attachments?.[0]).toMatchObject({ name: "field-notes.png", href: "/demo-assets/park-64x48.png" });

      const photo = at(1790008877000).messages.find((message) => message.id === mid("m7"));
      expect(photo?.images).toHaveLength(2);

      const viewerAt = 1790008879000;
      expect(at(viewerAt - 1).overlay.kind).toBe("closed");
      const viewerMid = at(viewerAt + pendingCueDurations.imageViewer / 2);
      expect(viewerMid.overlay).toMatchObject({ kind: "image-viewer", messageId: mid("m7"), index: 0 });
      expect(cue(viewerMid, "overlay-enter")?.progress).toBeCloseTo(0.5, 5);
      expect(at(viewerAt + pendingCueDurations.imageViewer).overlay).toMatchObject({ kind: "image-viewer", messageId: mid("m7") });
      expect(at(1790008881000 + pendingCueDurations.imageViewer).overlay.kind).toBe("closed");

      const audio = at(1790008885000);
      expect(audio.messages.find((message) => message.id === mid("m8"))?.kind).toBe("audio");
      expect(audio.audio).toMatchObject({ messageId: mid("m8"), position: 2.4, playing: true });

      const pressAt = 1790008887000;
      expect(at(pressAt - 1).overlay.kind).toBe("closed");
      const pressMid = at(pressAt + pendingCueDurations.longPressEnter / 2);
      expect(pressMid.overlay).toMatchObject({ kind: "long-press", messageId: mid("m5") });
      expect(cue(pressMid, "overlay-enter")?.progress).toBeCloseTo(0.5, 5);
      expect(at(1790008889500 + pendingCueDurations.longPressExit).overlay.kind).toBe("closed");

      const pickerAt = 1790008891000;
      expect(at(pickerAt - 1).overlay.kind).toBe("closed");
      const pickerMid = at(pickerAt + pendingCueDurations.effectsPickerEnter / 2);
      expect(pickerMid.overlay).toMatchObject({ kind: "effects-picker", tab: "screen", draft: "See you there" });
      expect(cue(pickerMid, "overlay-enter")?.progress).toBeCloseTo(0.5, 5);
      expect(at(pickerAt + pendingCueDurations.effectsPickerEnter).overlay).toMatchObject({ kind: "effects-picker", tab: "screen" });

      const effectAt = 1790008894000 - light.messages[0]!.atMs;
      const effectDuration = screenEffectDuration("confetti");
      expect(frameAt(compiled, effectAt - 1).cues.some((entry) => entry.kind === "screen-effect")).toBe(false);
      expect(cue(frameAt(compiled, effectAt + effectDuration / 2), "screen-effect")).toMatchObject({ progress: 0.5 });
      expect(frameAt(compiled, effectAt + effectDuration).messages.find((message) => message.id === mid("m9"))?.text).toBe("See you there");
      expect(cue(frameAt(compiled, effectAt + effectDuration), "screen-effect")).toBeNull();

      const edited = at(1790008898500);
      expect(edited.messages.find((message) => message.id === mid("m2"))).toMatchObject({ text: "On my way over", edited: true });

      const undoAt = 1790008900500 - light.messages[0]!.atMs;
      expect(frameAt(compiled, undoAt - 1).messages.some((message) => message.id === mid("m2"))).toBe(true);
      expect(frameAt(compiled, undoAt + undoSendWindow() / 2).messages.some((message) => message.id === mid("m2"))).toBe(false);
      expect(frameAt(compiled, undoAt + undoSendWindow()).messages.some((message) => message.id === mid("m2"))).toBe(false);

      expect(at(1790008902500 + pendingCueDurations.plusMenuEnter).overlay.kind).toBe("plus-menu");
      expect(at(1790008904500 + pendingCueDurations.photoPickerEnter).overlay).toMatchObject({ kind: "photo-picker", selectedId: "bloom" });
      expect(at(1790008906500 + pendingCueDurations.selectionEnter).overlay).toMatchObject({ kind: "selection", messageIds: [mid("m1")] });

      expect(at(1790008909000 - 1).timeReveal).toBe(0);
      expect(at(1790008909000).timeReveal).toBe(0.5);
      expect(at(1790008910500).timeReveal).toBe(1);

      const listAt = 1790008912000 - light.messages[0]!.atMs;
      const pop = screenTransitionDuration("pop");
      expect(frameAt(compiled, listAt - 1).screen).toBe("conversation");
      expect(frameAt(compiled, listAt + pop / 2).screen).toBe("list");
      expect(cue(frameAt(compiled, listAt + pop / 2), "screen")?.progress).toBeCloseTo(0.5, 5);
      expect(frameAt(compiled, listAt + pop).screen).toBe("list");

      const sheetAt = 1790008914000 - light.messages[0]!.atMs;
      const present = screenTransitionDuration("present");
      expect(frameAt(compiled, sheetAt + present / 2).screen).toBe("new-message");
      expect(cue(frameAt(compiled, sheetAt + present / 2), "screen")?.progress).toBeCloseTo(0.5, 5);
      expect(frameAt(compiled, sheetAt + present).screen).toBe("new-message");

      const backAt = 1790008916000 - light.messages[0]!.atMs;
      const push = screenTransitionDuration("push");
      expect(frameAt(compiled, backAt + push / 2).screen).toBe("conversation");
      expect(cue(frameAt(compiled, backAt + push / 2), "screen")?.progress).toBeCloseTo(0.5, 5);
      expect(frameAt(compiled, backAt + push).screen).toBe("conversation");
    });
  }
});

function undoSendWindow(): number {
  return 420;
}
