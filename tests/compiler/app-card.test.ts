import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { authoringDocumentSchema } from "@/cli/authoring";
import { findUnsupported } from "@/cli/unsupported";
import capabilities from "@/contracts/capabilities.json";
import { frameAt } from "@/runtime";
import { toUpstreamMessage } from "@/renderers/ios/adapt";
import { supportsArrival } from "@/renderers/ios/cues";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const firstAt = 1790008740000;

const card = { url: "http://127.0.0.1:3100/hotel", live: true, app: "checkout" };

function flow(cardMessage: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  return {
    id: "checkout-flow",
    title: "Checkout",
    platform: "ios",
    theme: "light",
    contact: { name: "Airial Travel" },
    nowMs: 1790008860000,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [
      { id: "in-1", text: "Here is the villa.", direction: "incoming", atMs: firstAt },
      { id: "checkout", text: "Villa checkout", direction: "incoming", atMs: firstAt + 2000, kind: "app-card", appCard: card, ...cardMessage },
    ],
    ...overrides,
  };
}

function without(key: "appCard" | "kind") {
  const document = flow();
  delete (document.messages[1] as Record<string, unknown>)[key];
  return document;
}

function issuesOf(input: unknown): string[] {
  const result = validateDemo(input);
  return result.ok ? [] : result.issues.map((item) => `${item.path} ${item.message}`);
}

describe("app-card flows", () => {
  it("accepts one live checkout card on iOS and carries it through compile and projection", () => {
    const result = validateDemo(flow({ appCard: { ...card, height: 288 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.demo.messages[1]).toMatchObject({ kind: "app-card", appCard: { url: card.url, live: true, app: "checkout", height: 288 } });
    const compiled = compileDemo(result.demo);
    const frame = frameAt(compiled, compiled.durationMs);
    expect(frame.messages.find((message) => message.id === "checkout")?.appCard).toEqual({ ...card, height: 288 });
    expect(supportsArrival(frame.messages[1])).toBe(false);
  });

  it("lays the card out as a plain upstream row for the list to cluster", () => {
    expect(toUpstreamMessage({ id: "checkout", text: "Villa checkout", direction: "incoming", atMs: 5, kind: "app-card", appCard: card as never })).toEqual({
      id: "checkout",
      text: "Villa checkout",
      direction: "incoming",
      sentAt: 5,
    });
  });

  it("keeps macOS, other mini apps, and non-live cards out", () => {
    expect(issuesOf(flow({}, { platform: "macos" }))).toContain(
      "/messages/1/kind PLATFORM_MISMATCH: app-card is an iOS surface; the macOS renderer does not host live checkout cards",
    );
    expect(issuesOf(flow({ appCard: { ...card, app: "poll" } })).join("\n")).toMatch(/\/messages\/1\/appCard\/app UNSUPPORTED_COMPONENT: only the Photon checkout app card/);
    expect(issuesOf(flow({ appCard: { ...card, live: false } }))).toContain(
      "/messages/1/appCard/live INVALID_VALUE: only live app cards are supported: set appCard.live to true",
    );
    expect(issuesOf(flow({ kind: "mini-app" })).join("\n")).toMatch(/UNSUPPORTED_COMPONENT/);
  });

  it("requires an embeddable URL and leaves the presentation parameters to the renderer", () => {
    expect(issuesOf(without("appCard"))).toContain("/messages/1/appCard MISSING_FIELD: app-card messages require an appCard payload");
    for (const url of ["ftp://127.0.0.1/hotel", "/hotel", "javascript:alert(1)", "http://user:pw@127.0.0.1:3100/hotel"]) {
      expect(issuesOf(flow({ appCard: { ...card, url } })), url).toContain(
        "/messages/1/appCard/url INVALID_VALUE: appCard.url must be an absolute http or https URL without credentials",
      );
    }
    for (const url of ["http://127.0.0.1:3100/hotel?presentation=visual", "http://127.0.0.1:3100/hotel?parentOrigin=http%3A%2F%2Fevil.example"]) {
      expect(issuesOf(flow({ appCard: { ...card, url } })), url).toContain(
        "/messages/1/appCard/url INVALID_VALUE: the renderer appends presentation and parentOrigin itself; remove them from appCard.url",
      );
    }
    expect(issuesOf(flow({ appCard: { ...card, height: 40 } }))).toContain(
      "/messages/1/appCard/height INVALID_VALUE: appCard.height must be an integer from 120 to 480 points",
    );
    expect(issuesOf(flow({ appCard: { ...card, origin: "http://127.0.0.1:3100" } }))).toContain('/messages/1/appCard/origin UNKNOWN_FIELD: unknown field "origin"');
    expect(issuesOf(without("kind"))).toContain('/messages/1/appCard INVALID_VALUE: appCard is not a payload of kind "text"');
  });

  it("rejects decorations and timeline targets that would land on the hidden placeholder row", () => {
    expect(issuesOf(flow({ status: "read" }))).toContain("/messages/1/status INVALID_VALUE: status is not supported on a live app card");
    expect(issuesOf(flow({ reactions: [{ type: "love" }] }))).toContain("/messages/1/reactions INVALID_VALUE: reactions is not supported on a live app card");
    expect(issuesOf(flow({ service: "sms" }))).toContain("/messages/1/service INVALID_VALUE: a live app card is an iMessage surface, not SMS");
    const at = firstAt + 3000;
    expect(issuesOf(flow({}, { events: [{ type: "reaction", atMs: at, messageId: "checkout", reactionId: "r1", reaction: { type: "love" } }] }))).toContain(
      "/events/0/messageId INVALID_VALUE: reactions are not supported on a live app card",
    );
    expect(issuesOf(flow({}, { events: [{ type: "overlay", atMs: at, overlay: { kind: "long-press", messageId: "checkout" } }] }))).toContain(
      "/events/0/overlay/messageId INVALID_VALUE: long-press cannot target a live app card",
    );
    expect(issuesOf(flow({}, { events: [{ type: "overlay", atMs: at, overlay: { kind: "selection", messageIds: ["in-1"] } }] }))).toContain(
      "/events/0/overlay/kind INVALID_VALUE: select mode re-creates every thread row and would reload a live app card",
    );
    expect(issuesOf(flow({}, { events: [{ type: "message", atMs: at, message: { id: "later", text: "x", direction: "incoming", kind: "app-card" } }] }))).toContain(
      "/events/0/message/kind INVALID_VALUE: author app cards in messages, where their appCard payload is validated",
    );
  });

  it("passes the CLI schema and unsupported-feature gate, which still stops generic mini apps", () => {
    const document = flow();
    expect(findUnsupported(document)).toEqual([]);
    const parsed = authoringDocumentSchema.safeParse(document);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.messages[1].appCard).toEqual(card);
    expect(findUnsupported({ messages: [{ kind: "mini-app" }], miniApp: {} }).map((item) => item.path)).toEqual(["messages[0].kind", "miniApp"]);
  });

  it("declares the narrow capability and keeps polls and mini apps unsupported", () => {
    expect(capabilities.supported.map((entry) => entry.id)).toContain("app-card");
    expect(capabilities.unsupported.map((entry) => entry.id)).toContain("mini-apps");
    expect(capabilities.supported.map((entry) => entry.id)).toContain("poll");
  });

  it("validates the checked-in example flow", () => {
    const example = JSON.parse(readFileSync(path.join(root, "examples/photon-checkout-apple-pay.flow.json"), "utf8")) as Record<string, unknown>;
    const { targets: _targets, checkpoints: _checkpoints, ...demo } = example;
    expect(validateDemo(demo)).toMatchObject({ ok: true });
  });
});
