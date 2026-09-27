import { describe, expect, it } from "vitest";
import { createCheckoutBridge, exactOrigin, type BridgeFrame, type BridgeResultMessage } from "@/renderers/ios/apple-pay/bridge";
import type { ValidCheckoutRequest } from "@/renderers/ios/apple-pay/checkout";
import { parseCheckoutOrigins, resolveCheckoutEmbed } from "@/renderers/ios/app-card/config";

const ORIGIN = "http://127.0.0.1:4174";
const checkout = { merchantLabel: "Orchid — Villa Amara", amount: "2040.00", currency: "USD", country: "US", domain: "127.0.0.1" };

function fakeWindow() {
  const posted: Array<{ message: BridgeResultMessage; target: string }> = [];
  const win = { postMessage: (message: BridgeResultMessage, target: string) => posted.push({ message, target }) } as unknown as Window;
  return { win, posted };
}

function setup() {
  const child = fakeWindow();
  const stranger = fakeWindow();
  const presented: ValidCheckoutRequest[] = [];
  let showing = false;
  const bridge = createCheckoutBridge({
    present: (request) => {
      if (showing) return false;
      presented.push(request);
      showing = true;
      return true;
    },
    isBusy: () => showing,
  });
  const frame: BridgeFrame = { id: "checkout", origin: ORIGIN, window: () => child.win };
  bridge.register(frame);
  const open = (requestId: string, overrides: Record<string, unknown> = {}) => ({
    origin: ORIGIN,
    source: child.win,
    data: { type: "photon-pay:open", version: 1, requestId, checkout, ...overrides },
  });
  const close = () => {
    showing = false;
    bridge.closed();
  };
  return { bridge, child, stranger, presented, open, close };
}

describe("parent checkout bridge", () => {
  it("opens once for a valid request from the registered iframe and answers opened", () => {
    const { bridge, child, presented, open } = setup();
    expect(bridge.handleMessage(open("request-0001")).kind).toBe("opened");
    expect(presented).toHaveLength(1);
    expect(presented[0].amount).toBe("2040.00");
    expect(child.posted).toEqual([{ message: { type: "photon-pay:result", version: 1, requestId: "request-0001", state: "opened" }, target: ORIGIN }]);
  });

  it("ignores the wrong origin, the wrong source window, and malformed envelopes", () => {
    const { bridge, child, stranger, presented, open } = setup();
    expect(bridge.handleMessage({ ...open("request-0001"), origin: "http://127.0.0.1:4175" })).toEqual({ kind: "ignored", reason: "wrong-origin" });
    expect(bridge.handleMessage({ ...open("request-0001"), origin: "null" })).toEqual({ kind: "ignored", reason: "wrong-origin" });
    expect(bridge.handleMessage({ ...open("request-0001"), source: stranger.win })).toEqual({ kind: "ignored", reason: "unknown-source" });
    expect(bridge.handleMessage({ ...open("request-0001"), source: null })).toEqual({ kind: "ignored", reason: "unknown-source" });
    for (const data of [
      null,
      "photon-pay:open",
      [],
      { type: "photon-pay:open", version: 2, requestId: "request-0001", checkout },
      { type: "photon-pay:open", version: "1", requestId: "request-0001", checkout },
      { type: "photon-pay:close", version: 1, requestId: "request-0001", checkout },
      { type: "photon-pay:open", version: 1, requestId: "short", checkout },
      { type: "photon-pay:open", version: 1, requestId: "has space in it", checkout },
      { type: "photon-pay:open", version: 1, requestId: 12345678, checkout },
    ]) {
      expect(bridge.handleMessage({ origin: ORIGIN, source: child.win, data })).toEqual({ kind: "ignored", reason: "malformed" });
    }
    expect(presented).toHaveLength(0);
    expect(child.posted).toHaveLength(0);
    expect(stranger.posted).toHaveLength(0);
  });

  it("answers invalid for a bad checkout before changing anything", () => {
    const { bridge, child, presented, open } = setup();
    for (const [id, bad] of [
      ["invalid-0001", { checkout: { ...checkout, amount: "$2,040" } }],
      ["invalid-0002", { checkout: { ...checkout, amount: 2040 } }],
      ["invalid-0003", { checkout: { ...checkout, currency: "XXX1" } }],
      ["invalid-0004", { checkout: { ...checkout, domain: "<img src=x>" } }],
      ["invalid-0005", { checkout: null }],
    ] as const) {
      expect(bridge.handleMessage(open(id, bad)).kind).toBe("invalid");
    }
    expect(presented).toHaveLength(0);
    expect(bridge.active()).toBeNull();
    expect(child.posted.map((entry) => entry.message.state)).toEqual(["invalid", "invalid", "invalid", "invalid", "invalid"]);
    expect(bridge.handleMessage(open("valid-00001")).kind).toBe("opened");
  });

  it("deduplicates repeats, answers busy for a second request, and never reopens a stale ID", () => {
    const { bridge, child, presented, open, close } = setup();
    bridge.handleMessage(open("request-0001"));
    expect(bridge.handleMessage(open("request-0001")).kind).toBe("duplicate");
    expect(bridge.handleMessage(open("request-0002")).kind).toBe("busy");
    expect(presented).toHaveLength(1);
    close();
    expect(child.posted.at(-1)?.message).toMatchObject({ requestId: "request-0001", state: "cancelled" });
    expect(bridge.handleMessage(open("request-0001")).kind).toBe("duplicate");
    expect(child.posted.at(-1)?.message.state).toBe("cancelled");
    expect(presented).toHaveLength(1);
    expect(bridge.handleMessage(open("request-0003", { checkout: { ...checkout, amount: "24.00" } })).kind).toBe("opened");
    expect(presented.map((request) => request.amount)).toEqual(["2040.00", "24.00"]);
  });

  it("withdraws the open request when its iframe leaves, without posting to the gone window", () => {
    const child = fakeWindow();
    const removed: string[] = [];
    let showing = false;
    const bridge = createCheckoutBridge({
      present: () => (showing = true),
      isBusy: () => showing,
      onActiveFrameRemoved: (frame) => {
        removed.push(frame.id);
        showing = false;
        bridge.closed();
      },
    });
    const unregister = bridge.register({ id: "checkout", origin: ORIGIN, window: () => child.win });
    const message = (requestId: string, source: Window) => ({ origin: ORIGIN, source, data: { type: "photon-pay:open", version: 1, requestId, checkout } });
    expect(bridge.handleMessage(message("request-0001", child.win)).kind).toBe("opened");
    unregister();
    expect(removed).toEqual(["checkout"]);
    expect(bridge.active()).toBeNull();
    expect(child.posted.map((entry) => entry.message.state)).toEqual(["opened"]);

    // The card comes back after a replay: a new iframe, a fresh tap, a normal open.
    const again = fakeWindow();
    bridge.register({ id: "checkout", origin: ORIGIN, window: () => again.win });
    expect(bridge.handleMessage(message("request-0002", again.win)).kind).toBe("opened");
    expect(again.posted.map((entry) => entry.message.state)).toEqual(["opened"]);
    expect(child.posted).toHaveLength(1);
  });

  it("unregistering an iframe that is not presenting leaves the open sheet alone", () => {
    const { bridge, open } = setup();
    const other = fakeWindow();
    const unregister = bridge.register({ id: "second", origin: ORIGIN, window: () => other.win });
    bridge.handleMessage(open("request-0001"));
    unregister();
    expect(bridge.active()).toMatchObject({ frameId: "checkout" });
  });

  it("forgets an unregistered iframe", () => {
    const { bridge, child, presented } = setup();
    const other = fakeWindow();
    const unregister = bridge.register({ id: "second", origin: ORIGIN, window: () => other.win });
    unregister();
    expect(bridge.handleMessage({ origin: ORIGIN, source: other.win, data: { type: "photon-pay:open", version: 1, requestId: "request-0001", checkout } }).kind).toBe("ignored");
    expect(presented).toHaveLength(0);
    expect(child.posted).toHaveLength(0);
  });

  it("accepts only exact http(s) origins", () => {
    expect(exactOrigin("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100");
    for (const bad of ["http://127.0.0.1:3100/", "http://127.0.0.1:3100/hotel", "null", "*", "file:///tmp", "javascript:alert(1)", "127.0.0.1:3100"]) {
      expect(() => exactOrigin(bad), bad).toThrow();
    }
  });
});

describe("checkout embed configuration", () => {
  it("parses exact origins and drops everything else", () => {
    expect(parseCheckoutOrigins(" http://127.0.0.1:3100, https://pay.example ,http://127.0.0.1:3100/hotel,*,")).toEqual({
      origins: ["http://127.0.0.1:3100", "https://pay.example"],
      rejected: ["http://127.0.0.1:3100/hotel", "*"],
    });
    expect(parseCheckoutOrigins(undefined)).toEqual({ origins: [], rejected: [] });
  });

  it("embeds only allowlisted origins and appends the visual presentation parameters itself", () => {
    const allowed = ["http://127.0.0.1:3100"];
    const embed = resolveCheckoutEmbed("http://127.0.0.1:3100/hotel?ref=chat", allowed, "http://127.0.0.1:5173");
    expect(embed).toEqual({
      ok: true,
      origin: "http://127.0.0.1:3100",
      src: "http://127.0.0.1:3100/hotel?ref=chat&presentation=visual&parentOrigin=http%3A%2F%2F127.0.0.1%3A5173",
    });
    expect(resolveCheckoutEmbed("http://127.0.0.1:3101/hotel", allowed, "http://127.0.0.1:5173")).toMatchObject({ ok: false, reason: "origin-not-allowed" });
    expect(resolveCheckoutEmbed("http://localhost:3100/hotel", allowed, "http://127.0.0.1:5173")).toMatchObject({ ok: false, reason: "origin-not-allowed" });
    expect(resolveCheckoutEmbed("javascript:alert(1)", allowed, "http://127.0.0.1:5173")).toMatchObject({ ok: false, reason: "invalid-url" });
    expect(resolveCheckoutEmbed("http://user:pw@127.0.0.1:3100/hotel", allowed, "http://127.0.0.1:5173")).toMatchObject({ ok: false, reason: "invalid-url" });
    expect(resolveCheckoutEmbed("http://127.0.0.1:3100/hotel", allowed, "null")).toMatchObject({ ok: false, reason: "parent-origin-unavailable" });
    expect(resolveCheckoutEmbed("http://127.0.0.1:3100/hotel", [], "http://127.0.0.1:5173")).toMatchObject({ ok: false, reason: "origin-not-allowed" });
  });
});
