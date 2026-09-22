import { describe, expect, it } from "vitest";
import type { DemoMessage, RenderFrame } from "@/contracts";
import { renderFrameFixture } from "../../contracts/render-frame.fixture";
import catalogueScenes from "@/contracts/catalogue-scenes.json";
import { formatClockTime } from "@/components/imessage/date-separator";
import {
  macConversationId,
  mapDemoMessage,
  previewFromMessage,
  resolveMacScene,
  toSidebarConversation,
} from "@/renderers/macos/map-message";
import { rejectCatalogueScene, rejectMacFrame } from "@/renderers/macos/limits";
import { initialSwitchPhase, isSwitchAligned, nextSwitchPhase } from "@/renderers/macos/switch-phase";

const macosFrame: RenderFrame = { ...renderFrameFixture, platform: "macos" };

describe("frozen render frame", () => {
  it("maps the fixture without the compiler or runtime", () => {
    const messages = macosFrame.messages.map(mapDemoMessage);
    expect(messages.map((message) => message.text)).toEqual(["Are you close?", "See you there."]);
    expect(messages[0]?.direction).toBe("incoming");
    expect(messages[1]?.status).toBe("delivered");
    expect(messages[1]?.sentAt).toBe(macosFrame.messages[1]?.atMs);
    expect(previewFromMessage(macosFrame.messages[1] as DemoMessage)).toBe("See you there.");
    expect(macosFrame.messages[1]?.text).toBe("See you there.");
    const resolved = resolveMacScene(macosFrame, undefined, null);
    expect(resolved.selected.contact.name).toBe("Alex Morgan");
    expect(resolved.conversations[0]?.preview).toBeUndefined();
    expect(resolved.footer).toBeUndefined();
    expect(resolved.selected.messages[1]?.text).toBe("See you there.");
  });

  it("derives the sidebar preview and time from the authored message", () => {
    const resolved = resolveMacScene(macosFrame, undefined, null);
    const row = toSidebarConversation(resolved.selected, macosFrame.nowMs);
    const last = macosFrame.messages.at(-1)!;
    expect(row.preview).toBe(last.text);
    expect(row.time).toBe(formatClockTime(last.atMs));
    expect(row.unread).toBeUndefined();
  });

  it("rejects an iOS frame instead of drawing a Mac window", () => {
    expect(rejectMacFrame(renderFrameFixture)?.code).toBe("platform");
    expect(rejectMacFrame({ ...macosFrame, screen: "list" })?.code).toBe("ios-only");
    expect(rejectMacFrame({ ...macosFrame, screen: "new-message" })?.code).toBe("ios-only");
    expect(rejectMacFrame(macosFrame)).toBeNull();
  });
});

describe("message fields the shell already understands", () => {
  it("keeps replies, reactions, edits and group senders on the upstream message", () => {
    const message: DemoMessage = {
      id: "reply-1",
      text: "On my way",
      direction: "outgoing",
      atMs: 1,
      kind: "text",
      service: "sms",
      status: "sent",
    };
    const mapped = mapDemoMessage(Object.assign(message, {
      sender: "Alex Morgan",
      senderInitials: "AM",
      edited: true,
      readAtMs: 2,
      reactions: [{ type: "like", byMe: false }],
      replyTo: { id: "root", text: "Where?", direction: "incoming" as const, sender: "Jordan" },
      replyCount: 2,
    }));
    expect(mapped.text).toBe("On my way");
    expect(mapped.sender).toBe("Alex Morgan");
    expect(mapped.edited).toBe(true);
    expect(mapped.reactions).toEqual([{ type: "like", byMe: false }]);
    expect(mapped.replyTo?.id).toBe("root");
    expect(mapped.replyCount).toBe(2);
    expect(mapped.service).toBe("sms");
    expect(message.text).toBe("On my way");
  });

  it("builds link, file, image and audio previews without rewriting the transcript", () => {
    const link: DemoMessage = { id: "l", text: "see this", direction: "incoming", atMs: 1, kind: "link", link: { url: "https://example.com/a", title: "Example" } };
    const file: DemoMessage = { id: "f", text: "notes", direction: "incoming", atMs: 1, kind: "attachment", attachments: [{ name: "Notes.txt" }] };
    expect(previewFromMessage(link)).toBe("Example");
    expect(previewFromMessage(file)).toBe("Notes.txt");
    expect(link.text).toBe("see this");
    expect(file.text).toBe("notes");
  });

  it("does not invent an unread dot", () => {
    const resolved = resolveMacScene(macosFrame, {
      conversations: [{ id: "alex-morgan", contact: { name: "Alex Morgan", initials: "AM" } }],
    }, null);
    expect(resolved.conversations.every((conversation) => conversation.unread === undefined)).toBe(true);
    expect(macConversationId("Alex Morgan")).toBe("alex-morgan");
  });
});

describe("conversation switch phases", () => {
  it("prepares the previous conversation before applying the target", () => {
    const checkpoint = "alex->jordan@0.5";
    let phase = initialSwitchPhase(checkpoint, true);
    expect(phase.kind).toBe("prepared");
    expect(isSwitchAligned(phase, checkpoint, true)).toBe(false);
    phase = nextSwitchPhase(phase, checkpoint, true);
    expect(phase.kind).toBe("switching");
    expect(isSwitchAligned(phase, checkpoint, true)).toBe(true);
    expect(nextSwitchPhase(phase, checkpoint, true)).toEqual(phase);
  });

  it("reconstructs a backward or repeated seek from the departing conversation", () => {
    const first = "alex->jordan@1";
    const next = "alex->jordan@0.5";
    let phase = nextSwitchPhase(initialSwitchPhase(first, true), first, true);
    expect(phase.kind).toBe("switching");
    phase = nextSwitchPhase(phase, next, true);
    expect(phase).toEqual({ kind: "prepared", checkpoint: next });
    phase = nextSwitchPhase(phase, next, true);
    expect(phase).toEqual({ kind: "switching", checkpoint: next });
  });
});

describe("catalogue limits", () => {
  it("rejects iOS-only scenes and keeps catalogue-only ids off the transcript kinds", () => {
    expect(rejectCatalogueScene({ id: "effects-picker", platform: "ios" })?.code).toBe("ios-only");
    expect(rejectCatalogueScene({ id: "ios-text", platform: "ios" })?.code).toBe("ios-only");
    expect(rejectCatalogueScene({ id: "macos-text", platform: "macos" })).toBeNull();
    const system = catalogueScenes.scenes.find((scene) => scene.id === "system");
    expect(system?.tier).toBe("catalogue-only");
    expect(rejectCatalogueScene({ id: "not-a-scene", platform: "macos" })?.code).toBe("ios-only");
  });
});
