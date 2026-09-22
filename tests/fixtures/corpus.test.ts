import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isEmojiOnly } from "@/components/imessage/message-bubble";
import { buildRows, statusLabel } from "@/components/imessage/message-list";
import type { Message } from "@/components/imessage/message-list";
import { validateDemoDouble, compileDemoDouble } from "../contracts/doubles";
import { diagnoseDemo, frozenSchemaKeysMatch } from "./diagnose-demo";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const scenarioDir = path.join(root, "scenarios");
const clock = "2026-09-21T16:41:00.000Z";

type Scenario = {
  id: string;
  title: string;
  platform: "ios" | "macos";
  theme: "light" | "dark";
  nowMs: number;
  draft: string;
  typing: boolean;
  screen: "list" | "conversation" | "new-message";
  messages: Array<{ id: string; text: string; direction: "incoming" | "outgoing"; atMs: number; kind?: string; effect?: string; service?: string; status?: string }>;
};

type CheckpointFile = {
  scenarioId: string;
  checkpoints: Array<{ id: string; atMs: number; label: string; messageIds: string[] }>;
};

function readScenario(file: string): Scenario {
  return JSON.parse(readFileSync(path.join(scenarioDir, file), "utf8")) as Scenario;
}

const files = readdirSync(scenarioDir).filter((file) => file.endsWith(".json")).sort();
const scenarios = files.map(readScenario);
const checkpoints = JSON.parse(readFileSync(path.join(root, "tests/fixtures/checkpoints.json"), "utf8")) as CheckpointFile[];

function asMessages(scenario: Scenario): Message[] {
  return scenario.messages.map((message) => ({
    id: message.id,
    text: message.text,
    direction: message.direction,
    sentAt: message.atMs,
    status: message.status as Message["status"],
    service: message.service as Message["service"],
    kind: message.kind as Message["kind"],
    effect: message.effect as Message["effect"],
  }));
}

describe("scenario corpus", () => {
  it("matches the frozen schema keys and validates every authored flow", () => {
    expect(frozenSchemaKeysMatch()).toBe(true);
    expect(scenarios.length).toBe(34);
    for (const scenario of scenarios) {
      expect(diagnoseDemo(scenario)).toEqual([]);
      const validated = validateDemoDouble(scenario);
      expect(validated.ok, scenario.id).toBe(true);
    }
  });

  it("uses one clock, unique ids, and both platforms and themes", () => {
    const ids = new Set<string>();
    const messageIds = new Set<string>();
    const checkpointIds = new Set<string>();
    expect(new Date(scenarios[0].nowMs).toISOString()).toBe(clock);
    for (const scenario of scenarios) {
      expect(scenario.nowMs).toBe(scenarios[0].nowMs);
      expect(ids.has(scenario.id)).toBe(false);
      ids.add(scenario.id);
      expect(scenario.id).toBe(files.find((file) => file.startsWith(scenario.id))?.replace(/\.json$/, ""));
      let previous = -1;
      for (const message of scenario.messages) {
        expect(messageIds.has(message.id)).toBe(false);
        messageIds.add(message.id);
        expect(message.atMs).toBeGreaterThan(previous);
        previous = message.atMs;
        expect(new Date(message.atMs).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    }
    expect(scenarios.some((scenario) => scenario.platform === "ios" && scenario.theme === "light")).toBe(true);
    expect(scenarios.some((scenario) => scenario.platform === "ios" && scenario.theme === "dark")).toBe(true);
    expect(scenarios.some((scenario) => scenario.platform === "macos" && scenario.theme === "light")).toBe(true);
    expect(scenarios.some((scenario) => scenario.platform === "macos" && scenario.theme === "dark")).toBe(true);
    for (const group of checkpoints) {
      for (const checkpoint of group.checkpoints) {
        expect(checkpointIds.has(checkpoint.id)).toBe(false);
        checkpointIds.add(checkpoint.id);
      }
    }
  });

  it("keeps iOS screens off macOS flows", () => {
    for (const scenario of scenarios) {
      if (scenario.screen === "list" || scenario.screen === "new-message") expect(scenario.platform).toBe("ios");
      if (scenario.platform === "macos") expect(scenario.screen).toBe("conversation");
    }
    expect(scenarios.filter((scenario) => scenario.screen === "list").map((scenario) => scenario.id).sort()).toEqual(["ios-list-ios-dark", "ios-list-ios-light"]);
    expect(scenarios.filter((scenario) => scenario.screen === "new-message").map((scenario) => scenario.id).sort()).toEqual(["ios-new-message-ios-dark", "ios-new-message-ios-light"]);
  });

  it("names a checkpoint for every revealed prefix", () => {
    expect(checkpoints.map((group) => group.scenarioId).sort()).toEqual(scenarios.map((scenario) => scenario.id).sort());
    for (const scenario of scenarios) {
      const group = checkpoints.find((item) => item.scenarioId === scenario.id);
      expect(group).toBeDefined();
      if (!group) return;
      if (scenario.messages.length === 0) {
        expect(group.checkpoints).toEqual([{ id: `${scenario.id}__draft`, atMs: scenario.nowMs, label: scenario.draft, messageIds: [] }]);
        continue;
      }
      expect(group.checkpoints).toHaveLength(scenario.messages.length);
      for (const checkpoint of group.checkpoints) {
        const visible = scenario.messages.filter((message) => message.atMs <= checkpoint.atMs).map((message) => message.id);
        expect(checkpoint.messageIds).toEqual(visible);
        expect(checkpoint.messageIds.at(-1)).toBe(checkpoint.id.slice(scenario.id.length + 2));
      }
    }
  });

  it("fixes basic text, direction, and the local photo hashes", () => {
    const basic = scenarios.find((scenario) => scenario.id === "basic-ios-light");
    expect(basic?.messages.map((message) => [message.direction, message.text])).toEqual([
      ["incoming", "Are you close?"],
      ["outgoing", "See you there."],
    ]);
    const manifest = JSON.parse(readFileSync(path.join(root, "public/demo-assets/manifest.json"), "utf8")) as {
      assets: Array<{ src: string; width: number; height: number; sha256: string }>;
    };
    for (const asset of manifest.assets) {
      const bytes = readFileSync(path.join(root, "public", asset.src.slice(1)));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
    }
    const media = scenarios.find((scenario) => scenario.id === "media-ios-light");
    const images = media?.messages.find((message) => message.kind === "image");
    expect(images).toBeDefined();
  });

  it("shows the frozen double scheduling messages by index instead of atMs", () => {
    const basic = scenarios.find((scenario) => scenario.id === "basic-ios-light");
    expect(basic).toBeDefined();
    if (!basic) return;
    const validated = validateDemoDouble(basic);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemoDouble(validated.demo);
    const messageEvents = compiled.events.filter((event) => event.type === "message");
    expect(messageEvents.map((event) => event.atMs)).toEqual([0, 1000]);
    expect(basic.messages[0].atMs).toBeGreaterThan(1_000_000_000_000);
  });
});

describe("pinned list behaviour of the authored flows", () => {
  it("splits the long thread into date headers and one three-message cluster", () => {
    const scenario = scenarios.find((item) => item.id === "long-thread-ios-light");
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const rows = buildRows(asMessages(scenario), {
      platform: "ios",
      now: scenario.nowMs,
      group: false,
      serviceLabel: "iMessage",
      firstDateHeader: true,
      typing: null,
    });
    expect(rows.filter((row) => row.kind === "date")).toHaveLength(3);
    const clustered = rows.filter((row) => row.kind === "message" && ["Here.", "By the doors.", "The blue ones."].includes(row.message.text));
    expect(clustered.map((row) => (row.kind === "message" ? row.tail : null))).toEqual([false, false, true]);
    expect(scenario.messages[0].text.length).toBeGreaterThan(120);
  });

  it("labels SMS, failure, and the delivery prefix at each status checkpoint", () => {
    const sms = scenarios.find((item) => item.id === "sms-macos-dark");
    expect(sms?.messages.every((message) => message.service === "sms")).toBe(true);
    const listSource = readFileSync(path.join(root, "src/components/imessage/message-list.tsx"), "utf8");
    expect(listSource).toContain('messages.every(message => message.service === "sms") ? "Text Message" : "iMessage"');
    expect(statusLabel({ id: "s", text: "I will text when I land.", direction: "outgoing", sentAt: 1, service: "sms", status: "sent" }, 2)).toBe("Sent as Text Message");

    const typing = scenarios.find((item) => item.id === "typing-status-ios-light");
    expect(typing?.typing).toBe(true);
    expect(typing).toBeDefined();
    if (!typing) return;
    const messages = asMessages(typing);
    const labels = ["", "", "Sent", "Delivered", "Read", "Read"];
    for (let count = 1; count <= messages.length; count++) {
      const slice = messages.slice(0, count);
      const rows = buildRows(slice, { platform: "ios", now: typing.nowMs, group: false, serviceLabel: null, firstDateHeader: false, typing: count === messages.length ? {} : null });
      const labeled = rows.find((row) => row.kind === "message" && row.showStatus);
      const expected = labels[count - 1];
      if (!expected) expect(labeled).toBeUndefined();
      else expect(labeled && labeled.kind === "message" ? statusLabel(labeled.message, typing.nowMs) : "").toBe(expected);
      if (count === messages.length) expect(rows.some((row) => row.kind === "typing")).toBe(true);
    }
    expect(statusLabel(messages[5], typing.nowMs)).toBeUndefined();
  });

  it("treats the emoji scenario as emoji-only and leaves the long sentence as text", () => {
    const emoji = scenarios.find((item) => item.id === "emoji-ios-dark");
    expect(emoji?.messages.every((message) => isEmojiOnly(message.text))).toBe(true);
    const long = scenarios.find((item) => item.id === "long-thread-macos-light");
    expect(isEmojiOnly(long?.messages[0].text ?? "")).toBe(false);
  });
});
