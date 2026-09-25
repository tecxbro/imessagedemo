import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import {
  frameAt,
  messageMotion,
  pendingCueDurations,
  screenEffectDuration,
  screenTransitionDuration,
} from "@/runtime";
import {
  SCREEN_EFFECT_NAMES,
  activeScreenEffect,
  effectsPickerModel,
} from "@/renderers/ios/effects";
import { composerModel, navigationModel } from "@/renderers/ios/navigation";
import { deriveCues } from "@/renderers/ios/cues";
import { projectFrame } from "@/renderers/ios/project";

const nowMs = Date.parse("2026-09-21T16:41:00.000Z");

function flow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ios-effects-nav",
    title: "Effects and navigation",
    platform: "ios",
    theme: "light",
    contact: { name: "Alex Morgan", initials: "AM" },
    nowMs,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [{ id: "m1", text: "Hi", direction: "incoming", atMs: 0 }],
    ...overrides,
  };
}

function compile(overrides: Record<string, unknown> = {}) {
  const validated = validateDemo(flow(overrides));
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error(validated.issues.map((issue) => issue.message).join("; "));
  return compileDemo(validated.demo);
}

describe("screen effects", () => {
  it("seeks confetti before, midpoint, and settled", () => {
    const atMs = 1000;
    const duration = screenEffectDuration("confetti");
    const compiled = compile({
      events: [{ type: "screen-effect", atMs, effect: "confetti", messageId: "m1" }],
    });

    expect(activeScreenEffect(frameAt(compiled, atMs - 1))).toBeNull();

    const mid = activeScreenEffect(frameAt(compiled, atMs + duration / 2));
    expect(mid).toMatchObject({ effect: "confetti", progress: 0.5, messageId: "m1" });

    expect(activeScreenEffect(frameAt(compiled, atMs + duration))).toBeNull();
  });

  it("passes every screen-effect name through the cue", () => {
    expect(SCREEN_EFFECT_NAMES).toEqual([
      "echo",
      "spotlight",
      "balloons",
      "confetti",
      "love",
      "lasers",
      "fireworks",
      "celebration",
    ]);

    for (const effect of SCREEN_EFFECT_NAMES) {
      const compiled = compile({
        events: [{ type: "screen-effect", atMs: 500, effect }],
      });
      const active = activeScreenEffect(frameAt(compiled, 500 + screenEffectDuration(effect) / 2));
      expect(active?.effect).toBe(effect);
      expect(active?.progress).toBeCloseTo(0.5);
    }
  });
});

describe("effects picker", () => {
  it("opens on the Screen tab with a selected effect and enter progress", () => {
    const enter = pendingCueDurations.effectsPickerEnter;
    const compiled = compile({
      events: [
        {
          type: "overlay",
          atMs: 200,
          overlay: { kind: "effects-picker", tab: "screen", draft: "Party time", effect: "balloons" },
        },
      ],
    });

    expect(effectsPickerModel(frameAt(compiled, 100))).toMatchObject({ open: false, progress: null });

    const mid = effectsPickerModel(frameAt(compiled, 200 + enter / 2));
    expect(mid).toMatchObject({
      open: true,
      tab: "screen",
      draft: "Party time",
      effect: "balloons",
      progress: 0.5,
      selection: { screen: "balloons" },
    });

    const settled = effectsPickerModel(frameAt(compiled, 200 + enter));
    expect(settled).toMatchObject({
      open: true,
      tab: "screen",
      effect: "balloons",
      progress: null,
      selection: { screen: "balloons" },
    });
  });
});

describe("navigation", () => {
  it("seeks list → conversation push before, midpoint, and settled", () => {
    const atMs = 100;
    const push = screenTransitionDuration("push");
    const compiled = compile({
      screen: "list",
      events: [{ type: "screen", atMs, screen: "conversation" }],
    });

    expect(navigationModel(frameAt(compiled, atMs - 1))).toMatchObject({
      screen: "list",
      transition: null,
      progress: null,
    });

    const mid = navigationModel(frameAt(compiled, atMs + push / 2));
    expect(mid).toMatchObject({
      screen: "conversation",
      transition: "push",
      progress: 0.5,
      from: "list",
      to: "conversation",
    });

    expect(navigationModel(frameAt(compiled, atMs + push))).toMatchObject({
      screen: "conversation",
      transition: null,
      progress: null,
    });
  });

  it("covers the supported iOS screen transitions", () => {
    const cases: Array<{ from: "list" | "conversation" | "new-message"; to: "list" | "conversation" | "new-message"; kind: "push" | "pop" | "present" | "dismiss" }> = [
      { from: "list", to: "conversation", kind: "push" },
      { from: "conversation", to: "list", kind: "pop" },
      { from: "list", to: "new-message", kind: "present" },
      { from: "new-message", to: "list", kind: "dismiss" },
      { from: "new-message", to: "conversation", kind: "push" },
    ];

    for (const entry of cases) {
      const duration = screenTransitionDuration(entry.kind);
      const compiled = compile({
        screen: entry.from,
        events: [{ type: "screen", atMs: 0, screen: entry.to }],
      });
      const mid = navigationModel(frameAt(compiled, duration / 2));
      expect(mid).toMatchObject({
        screen: entry.to,
        transition: entry.kind,
        progress: 0.5,
        from: entry.from,
        to: entry.to,
      });
    }
  });
});

describe("composer timing", () => {
  it("tracks typing true then false without inventing a typing message", () => {
    const compiled = compile({
      messages: [{ id: "m1", text: "Hi", direction: "incoming", atMs: 0 }],
      events: [
        { type: "typing", atMs: 200, typing: true },
        { type: "draft", atMs: 300, value: "Hello" },
        { type: "draft", atMs: 400, value: "" },
        { type: "typing", atMs: 500, typing: false },
      ],
    });

    expect(composerModel(frameAt(compiled, 100))).toMatchObject({ typing: false, draft: "" });
    expect(composerModel(frameAt(compiled, 250))).toMatchObject({ typing: true, draft: "" });
    expect(composerModel(frameAt(compiled, 350))).toMatchObject({ typing: true, draft: "Hello" });
    expect(composerModel(frameAt(compiled, 450))).toMatchObject({ typing: true, draft: "" });
    expect(composerModel(frameAt(compiled, 600))).toMatchObject({ typing: false, draft: "" });

    for (const time of [100, 250, 350, 450, 600]) {
      expect(frameAt(compiled, time).messages.every((message) => message.kind !== "audio" || message.text !== "")).toBe(true);
      expect(frameAt(compiled, time).messages.some((message) => message.id === "typing")).toBe(false);
    }
  });

  it("exposes send and receive arrival cues while they are in flight", () => {
    const receiveDuration = messageMotion().receive.duration;
    const sendDuration = messageMotion().send.duration;
    const compiled = compile({
      messages: [],
      draft: "On my way",
      events: [
        { type: "message", atMs: 0, message: { id: "in-1", text: "Are you close?", direction: "incoming", atMs: 0 } },
        { type: "message", atMs: 1000, message: { id: "out-1", text: "See you there.", direction: "outgoing", atMs: 1000, status: "delivered" } },
        { type: "draft", atMs: 1000, value: "" },
      ],
    });

    expect(composerModel(frameAt(compiled, -1))).toMatchObject({ send: null, receive: null });
    expect(composerModel(frameAt(compiled, receiveDuration / 2)).receive).toMatchObject({ id: "in-1", progress: 0.5 });
    expect(composerModel(frameAt(compiled, receiveDuration)).receive).toBeNull();

    expect(composerModel(frameAt(compiled, 1000 + sendDuration / 2)).send).toMatchObject({ id: "out-1", progress: 0.5 });
    expect(composerModel(frameAt(compiled, 1000 + sendDuration)).send).toBeNull();
  });
});

describe("cues bridge", () => {
  it("surfaces screen-effect and screen-transition cues via frameAt", () => {
    const duration = screenEffectDuration("love");
    const push = screenTransitionDuration("push");
    const compiled = compile({
      screen: "list",
      events: [
        { type: "screen", atMs: 0, screen: "conversation" },
        { type: "screen-effect", atMs: 800, effect: "love" },
      ],
    });

    const midNav = deriveCues(compiled, projectFrame(compiled, push / 2));
    expect(midNav.screenTransition).toMatchObject({ kind: "push", progress: 0.5, from: "list", to: "conversation" });
    expect(midNav.screenEffect).toBeNull();

    const midEffect = deriveCues(compiled, projectFrame(compiled, 800 + duration / 2));
    expect(midEffect.screenEffect).toMatchObject({ effect: "love", progress: 0.5 });
    expect(midEffect.screenTransition).toBeNull();
  });
});
