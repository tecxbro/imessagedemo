import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { paymentCards } from "@/renderers/ios/apple-pay/cards";
import { formatMoney, fromCheckoutSpec, validateRequest } from "@/renderers/ios/apple-pay/checkout";
import { PresentationController, type PresentationClock, type PresentationSink } from "@/renderers/ios/apple-pay/controller";
import { motionDuration, motionFrames, motionFramesSha256 } from "@/renderers/ios/apple-pay/motion-data";
import { closingStateAt, openStateAt, stateAt, type MotionState } from "@/renderers/ios/apple-pay/motion";

const base = { merchantLabel: "Orchid — Villa Amara", amount: "2040.00", currency: "USD", country: "US", domain: "checkout.example" };

// Ported from the recreation package's implementation/tests/core.test.cjs.
describe("recreation package core tests", () => {
  it("recorded amount is dynamic, not a universal fixture", () => {
    expect(formatMoney(base)).toBe("$2,040.00");
    expect(formatMoney({ ...base, amount: "24.00" })).toBe("$24.00");
    expect(formatMoney({ ...base, amount: "79.95", currency: "EUR" })).toBe("€79.95");
  });

  it("0-, 2-, and 3-decimal currencies retain exact amount strings", () => {
    expect(validateRequest({ ...base, currency: "JPY", amount: "1200.00" }).amount).toBe("1200");
    expect(validateRequest({ ...base, currency: "KWD", amount: "12.345" }).amount).toBe("12.345");
    expect(validateRequest({ ...base, amount: "0.10" }).amount).toBe("0.10");
  });

  it("rejects invalid input before mutating the UI", () => {
    for (const amount of [24, "$24.00", "2,040.00", "-1.00", "NaN", "1e3", "01.00", "1.001", "9999999999.00"]) {
      expect(() => validateRequest({ ...base, amount }), String(amount)).toThrow();
    }
    expect(() => validateRequest({ ...base, currency: "NOPE" })).toThrow();
    expect(() => validateRequest({ ...base, domain: "https://bad.example" })).toThrow();
  });

  it("typed source adapter does not parse displayPrice", () => {
    const request = fromCheckoutSpec(
      { metadata: { applePayLabel: "New merchant" }, item: { displayPrice: "Never parse this", applePayAmount: "87.99", applePayCurrencyCode: "GBP" } as never },
      "host.example",
    );
    expect(request.amount).toBe("87.99");
    expect(request.currency).toBe("GBP");
    expect(request.merchantLabel).toBe("New merchant");
  });

  it("two openings and two dismissals map to the recording", () => {
    for (const t of [0, 2, 7, 9, 13, 13.93]) expect(stateAt(t).visible, String(t)).toBe(false);
    for (const t of [3, 4.5, 6, 10.5, 12]) expect(stateAt(t).visible, String(t)).toBe(true);
    expect(stateAt(3).top).toBe(254);
    expect(stateAt(4.5).cardW).toBe(248);
    expect(stateAt(3).cardW).toBe(202);
  });

  it("60-fps between-frame samples interpolate measured geometry", () => {
    const a = stateAt(70 / 30);
    const b = stateAt(71 / 30);
    const m = stateAt(141 / 60);
    expect(Math.abs(m.top - (a.top + b.top) / 2)).toBeLessThan(1e-6);
  });

  it("state never invents authentication or a paid result", () => {
    expect((stateAt(4.5) as MotionState & { paid?: unknown }).paid).toBeUndefined();
    expect(motionDuration).toBe(418 / 30);
  });

  it("only source-supported card identifiers are stored", () => {
    expect(paymentCards[0].lastFour).toBe("5334");
    expect(paymentCards[1].lastFour).toBe("0987");
    expect(paymentCards[2].lastFour).toBeNull();
  });
});

describe("measured motion data", () => {
  it("is the package's 418 source frames, unchanged", () => {
    expect(motionFrames).toHaveLength(418);
    expect(createHash("sha256").update(JSON.stringify(motionFrames)).digest("hex")).toBe(motionFramesSha256);
    expect(motionFramesSha256).toBe("c3414491cc3fa690a8c705961302bc98043ee0bf6c7cbf575bcb97d226677dc2");
  });

  it("hits the settled panel and both measured card rectangles", () => {
    const fan = stateAt(3);
    expect(fan).toMatchObject({ top: 254, cardX: 156, cardW: 202, cardH: 127, sourceFrame: 90 });
    expect(fan.top + fan.cardY).toBe(477);
    expect(fan.dim).toBeCloseTo(0.5, 1);
    const expanded = stateAt(4.5);
    expect(expanded).toMatchObject({ top: 254, cardX: 132, cardW: 248, expand: 1, sourceFrame: 135 });
    expect(expanded.top + expanded.cardY).toBe(462);
  });

  it("uses both recorded tracks rather than one normalized cycle", () => {
    expect(stateAt(67 / 30).top).toBe(1080);
    expect(stateAt(300 / 30).top).toBe(1054);
    expect(stateAt(198 / 30).visible).toBe(false);
    expect(stateAt(388 / 30).visible).toBe(false);
  });
});

describe("manual open and close tracks", () => {
  it("replays the first presentation from frame 66 and holds on the pending pose", () => {
    const start = openStateAt(0, { selected: false, reducedMotion: false });
    expect(start.sourceFrame).toBe(66);
    const settled = openStateAt(20, { selected: false, reducedMotion: false });
    expect(settled.sourceFrame).toBe(181);
    expect(settled.cardW).toBe(248);
    expect(settled.time).toBeCloseTo(66 / 30 + 20);
    expect(openStateAt(0, { selected: false, reducedMotion: true }).sourceFrame).toBe(135);
  });

  it("closes from wherever the sheet is along the measured exit", () => {
    const midEntrance = stateAt(69 / 30);
    const start = closingStateAt(midEntrance, 0, false);
    expect(start.state.top).toBeGreaterThanOrEqual(midEntrance.top);
    expect(start.state.pressed).toBe(true);
    const end = closingStateAt(midEntrance, 14 / 30, false);
    expect(end.done).toBe(true);
    expect(end.state.visible).toBe(false);
    expect(closingStateAt(stateAt(4.5), 0, true)).toMatchObject({ done: true, state: { visible: false, dim: 0 } });
  });
});

type Recorded = { frames: MotionState[]; views: unknown[]; closed: number; edges: string[] };

function harness(options: { reducedMotion?: boolean } = {}) {
  let now = 0;
  let next = 1;
  const queue = new Map<number, (time: number) => void>();
  const clock: PresentationClock = {
    now: () => now,
    request: (callback) => {
      const id = next++;
      queue.set(id, callback);
      return id;
    },
    cancel: (id) => queue.delete(id),
  };
  const recorded: Recorded = { frames: [], views: [], closed: 0, edges: [] };
  const sink: PresentationSink = {
    frame: (state, edges) => {
      recorded.frames.push(state);
      if (edges.becameVisible) recorded.edges.push("visible");
      if (edges.becameHidden) recorded.edges.push("hidden");
    },
    view: (view) => recorded.views.push(view),
    closed: () => {
      recorded.closed += 1;
    },
  };
  const controller = new PresentationController(sink, { reducedMotion: options.reducedMotion ?? false, enablePicker: true, clock });
  const advance = (ms: number, step = 1000 / 60) => {
    for (let t = 0; t < ms; t += step) {
      now += step;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(now);
    }
  };
  return { controller, recorded, advance, pending: () => queue.size };
}

describe("presentation state machine", () => {
  it("opens once: duplicate opens while showing do not restart the sheet", () => {
    const { controller, recorded, advance } = harness();
    expect(controller.open(base)).toBe(true);
    advance(300);
    const top = controller.lastState.top;
    expect(controller.open({ ...base, amount: "24.00" })).toBe(false);
    expect(controller.request?.amount).toBe("2040.00");
    advance(16);
    expect(controller.lastState.top).toBeLessThanOrEqual(top);
    expect(recorded.edges).toEqual(["visible"]);
  });

  it("rejects an invalid request without touching the current checkout or animation", () => {
    const { controller, advance, pending } = harness();
    controller.open(base);
    advance(200);
    controller.close();
    advance(600);
    const before = controller.request;
    expect(() => controller.open({ ...base, amount: "$24" })).toThrow();
    expect(controller.request).toBe(before);
    expect(controller.mode).toBe("idle");
    expect(pending()).toBe(0);
  });

  it("closes during the entrance and during card growth, then reopens with new values", () => {
    const { controller, recorded, advance } = harness();
    controller.open(base);
    advance(120);
    expect(controller.visible).toBe(true);
    controller.close();
    advance(600);
    expect(controller.visible).toBe(false);
    expect(recorded.closed).toBe(1);

    controller.open({ ...base, amount: "79.95", currency: "EUR" });
    advance(1400);
    expect(controller.lastState.expand).toBeGreaterThan(0);
    expect(controller.lastState.expand).toBeLessThan(1);
    controller.close();
    advance(600);
    expect(recorded.closed).toBe(2);
    expect(controller.request?.currency).toBe("EUR");
  });

  it("cancels before the first frame without drawing", () => {
    const { controller, recorded } = harness();
    controller.open(base);
    controller.close();
    expect(recorded.closed).toBe(1);
    expect(controller.mode).toBe("idle");
  });

  it("backs out of the picker with Escape before closing, and a fixture card holds the enlarged pose", () => {
    const { controller, advance } = harness();
    controller.open(base);
    advance(400);
    expect(controller.openPicker()).toBe(true);
    controller.escape();
    expect(controller.pickerOpen).toBe(false);
    expect(controller.visible).toBe(true);
    controller.openPicker();
    controller.selectCard("rho");
    advance(32);
    expect(controller.mode).toBe("selected");
    expect(controller.selectedCardId).toBe("rho");
    expect(controller.lastState.sourceFrame).toBe(135);
    controller.escape();
    advance(600);
    expect(controller.visible).toBe(false);
    expect(() => controller.selectCard("unknown")).toThrow();
  });

  it("seeks and plays the recorded sequence for captures", () => {
    const { controller, recorded, advance } = harness();
    controller.setTime(3);
    expect(controller.lastState.sourceFrame).toBe(90);
    controller.play();
    advance(14_100, 1000 / 30);
    expect(controller.mode).toBe("idle");
    expect(recorded.edges.filter((edge) => edge === "visible")).toHaveLength(3);
  });

  it("reduced motion opens straight to the settled pose and closes in one step", () => {
    const { controller, advance } = harness({ reducedMotion: true });
    controller.open(base);
    advance(16);
    expect(controller.lastState.sourceFrame).toBe(135);
    controller.close();
    advance(16);
    expect(controller.visible).toBe(false);
  });

  it("dismisses at once when the owning checkout leaves, then opens normally again", () => {
    const { controller, recorded, advance, pending } = harness();
    controller.open(base);
    advance(600);
    controller.openPicker();
    controller.dismiss();
    expect(controller.visible).toBe(false);
    expect(controller.mode).toBe("idle");
    expect(controller.request).toBeNull();
    expect(controller.pickerOpen).toBe(false);
    expect(recorded.edges.at(-1)).toBe("hidden");
    expect(recorded.closed).toBe(1);
    expect(pending()).toBe(0);
    controller.dismiss();
    expect(recorded.closed).toBe(1);
    expect(controller.open({ ...base, amount: "24.00" })).toBe(true);
    advance(300);
    expect(controller.visible).toBe(true);
    expect(controller.request?.amount).toBe("24.00");
  });

  it("reports an open sheet as cancelled when destroyed", () => {
    const { controller, recorded, advance, pending } = harness();
    controller.open(base);
    advance(300);
    controller.destroy();
    expect(recorded.closed).toBe(1);
    expect(pending()).toBe(0);
  });
});
