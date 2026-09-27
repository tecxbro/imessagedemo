import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { authoringDocumentSchema, toDemoFlow } from "@/cli/authoring";
import { compileDemo, validateDemo } from "@/compiler";
import { pickerSelectionSchema } from "@/contracts";
import { tapbackMotion, tapbackVisualAt, fittedPillBox } from "@/contracts/tapback-motion";

const example = JSON.parse(readFileSync(new URL("../../examples/ios-tapback-interaction.flow.json", import.meta.url), "utf8"));

describe("tapback selection schema", () => {
  it("accepts a classic choice, a custom emoji, null, and omission", () => {
    expect(pickerSelectionSchema.parse({ type: "love" })).toEqual({ type: "love" });
    expect(pickerSelectionSchema.parse({ emoji: "🎉" })).toEqual({ emoji: "🎉" });
    expect(pickerSelectionSchema.nullable().optional().parse(null)).toBeNull();
    expect(pickerSelectionSchema.nullable().optional().parse(undefined)).toBeUndefined();
  });

  it("rejects an empty emoji and an unknown classic type", () => {
    expect(pickerSelectionSchema.safeParse({ emoji: "" }).success).toBe(false);
    expect(pickerSelectionSchema.safeParse({ type: "heart" }).success).toBe(false);
  });

  it("round-trips the canonical example through authoring and validation", () => {
    const parsed = authoringDocumentSchema.safeParse(example);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const validated = validateDemo(toDemoFlow(parsed.data, "ios"));
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const selected = validated.demo.events?.find((event) => event.type === "overlay" && event.atMs === 3367);
    expect(selected?.type === "overlay" ? selected.overlay : null).toEqual({
      kind: "long-press",
      messageId: "target",
      selected: { type: "love" },
    });
    const compiled = compileDemo(validated.demo);
    const again = compileDemo(validated.demo);
    const compiledSelected = compiled.events.find((event) => event.type === "overlay" && event.atMs === 3367);
    if (!compiledSelected || compiledSelected.type !== "overlay") throw new Error("missing selection event");
    expect(compiledSelected.overlay).toEqual({
      kind: "long-press",
      messageId: "target",
      selected: { type: "love" },
    });
    expect(compiled.durationMs).toBe(3867 + tapbackMotion.reactionLandingMs);
    expect(JSON.stringify(again)).toBe(JSON.stringify(compiled));
  });
});

describe("fitted tapback tracks", () => {
  it("keeps late glyphs unfinished while the heart is already formed", () => {
    const early = tapbackVisualAt({ phase: "enter", elapsedMs: 267, entranceElapsedMs: 267 });
    expect(early.glyphs.emphasizeFirst.scaleY).toBeGreaterThan(0.85);
    expect(early.glyphs.emphasizeSecond.scaleY).toBeLessThan(0.4);
    expect(early.glyphs.laughTop.scaleY).toBeGreaterThan(early.glyphs.laughBottom.scaleY);
    expect(early.glyphs.question.scaleX).toBeLessThan(0.25);
    expect(early.glyphs.question.opacity).toBeLessThan(0.2);
    const heartSettled = tapbackVisualAt({ phase: "enter", elapsedMs: 400, entranceElapsedMs: 400 });
    expect(heartSettled.glyphs.love.scaleX).toBeGreaterThan(0.95);
    expect(heartSettled.glyphs.question.scaleX).toBeLessThan(0.4);
    const late = tapbackVisualAt({ phase: "enter", elapsedMs: 900, entranceElapsedMs: 900 });
    expect(late.glyphs.question.scaleX).toBeGreaterThan(0.95);
    expect(late.glyphs.emphasizeSecond.scaleY).toBe(1);
  });

  it("removes glyphs before the pill finishes contracting", () => {
    const glyphsGone = tapbackVisualAt({ phase: "exit", elapsedMs: 100, entranceElapsedMs: tapbackMotion.entranceMs });
    expect(glyphsGone.glyphRowOpacity).toBe(0);
    expect(glyphsGone.pillRemain).toBe(1);
    expect(glyphsGone.lift).toBe(0);
    const wide = fittedPillBox(1, 1, 280, 64);
    const short = fittedPillBox(1, 0.85, 280, 64);
    const circle = fittedPillBox(1, 0.4, 280, 64);
    const dot = fittedPillBox(1, 0.05, 280, 64);
    expect(short.width).toBeLessThan(wide.width);
    expect(short.height).toBeCloseTo(wide.height, 0);
    expect(Math.abs(circle.width - circle.height)).toBeLessThan(1);
    expect(dot.width).toBeLessThan(12);
    expect(dot.opacity).toBeLessThan(0.2);
  });

  it("softens the menu at the start of selection without resetting glyph progress", () => {
    const open = tapbackVisualAt({ phase: "open", elapsedMs: 2400, entranceElapsedMs: 2400 });
    const selected = tapbackVisualAt({ phase: "select", elapsedMs: 0, entranceElapsedMs: 2400 });
    expect(selected.menuOpacity).toBeLessThan(open.menuOpacity);
    expect(selected.glyphs.question).toEqual(open.glyphs.question);
    expect(selected.glyphs.emphasizeSecond.scaleY).toBe(1);
  });

  it("snaps reduced motion to a settled or hidden pose", () => {
    const reduced = tapbackVisualAt({ phase: "enter", elapsedMs: 40, entranceElapsedMs: 40, reduced: true });
    expect(reduced.glyphs.question.scaleX).toBe(1);
    expect(reduced.glyphs.emphasizeSecond.scaleY).toBe(1);
    const gone = tapbackVisualAt({ phase: "exit", elapsedMs: 10, entranceElapsedMs: 40, reduced: true });
    expect(gone.glyphRowOpacity).toBe(0);
    expect(gone.lift).toBe(0);
  });
});
