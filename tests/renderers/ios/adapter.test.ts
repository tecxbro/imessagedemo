import { describe, expect, it } from "vitest";
import { messageMotion } from "@/components/imessage/message-motion";
import { bubbleEffectDuration } from "@/components/imessage/message-effects";
import { toUpstreamMessage } from "@/renderers/ios/adapt";
import { statusClock } from "@/renderers/ios/clock";
import { deriveCues, supportsArrival, typingFreezeDelay } from "@/renderers/ios/cues";
import { arrivalFixture, attachmentFixture, nowMs, slamFixture, typingFixture } from "@/renderers/ios/fixtures";
import { viewportRectToFrame } from "@/renderers/ios/geometry";
import { projectFrame } from "@/renderers/ios/project";
import { digestText } from "@/renderers/ios/readiness";
import { confidenceText } from "@/renderers/ios/catalogue";
import type { CatalogueSceneDefinition } from "@/contracts";

describe("iOS message adaptation", () => {
  it("keeps numeric sentAt and drops fields the pin does not render from the demo schema", () => {
    const message = arrivalFixture(5000).frame.messages[1];
    expect(message).toBeDefined();
    const upstream = toUpstreamMessage(message!);
    expect(upstream.sentAt).toBe(message!.atMs);
    expect(typeof upstream.sentAt).toBe("number");
    expect(upstream).not.toHaveProperty("reactions");
    expect(upstream).not.toHaveProperty("atMs");
    expect(upstream.kind).toBeUndefined();
  });

  it("copies link, file, image, and audio payloads without adding download hrefs", () => {
    const file = attachmentFixture().frame.messages[0];
    expect(file).toBeDefined();
    const upstream = toUpstreamMessage(file!);
    expect(upstream.attachments?.[0]).toEqual({ name: "Notes.txt", size: "4 KB" });
    expect(upstream.attachments?.[0]).not.toHaveProperty("href");
  });

  it("does not treat typing as a message kind", () => {
    const frame = typingFixture(360).frame;
    expect(frame.typing).toBe(true);
    expect(frame.messages.every((message) => message.kind !== "audio" && supportsArrival(message))).toBe(true);
    expect(frame.messages.map((message) => toUpstreamMessage(message).kind)).not.toContain("typing");
  });
});

describe("iOS cues", () => {
  it("seeks text arrivals and omits the cue at the duration endpoint", () => {
    const mid = arrivalFixture(1000 + messageMotion.send.duration / 2);
    const send = deriveCues(mid.compiled, mid.frame).send;
    expect(send?.id).toBe("out-1");
    expect(send?.progress).toBeCloseTo(0.5);
    const done = arrivalFixture(1000 + messageMotion.send.duration);
    expect(deriveCues(done.compiled, done.frame).send).toBeUndefined();
    const receive = arrivalFixture(messageMotion.receive.duration / 2);
    expect(deriveCues(receive.compiled, receive.frame).receive?.progress).toBeCloseTo(0.5);
    expect(deriveCues(arrivalFixture(messageMotion.receive.duration).compiled, arrivalFixture(messageMotion.receive.duration).frame).receive).toBeUndefined();
  });

  it("drives slam through the bubble effect and not the send flight", () => {
    const mid = slamFixture(bubbleEffectDuration.slam / 2);
    const cues = deriveCues(mid.compiled, mid.frame);
    expect(cues.send).toBeUndefined();
    expect(cues.bubbleEffect?.progress).toBeCloseTo(0.5);
    expect(deriveCues(slamFixture(bubbleEffectDuration.slam).compiled, slamFixture(bubbleEffectDuration.slam).frame).bubbleEffect).toBeNull();
  });

  it("freezes typing from the pin's stagger", () => {
    expect(typingFreezeDelay(1, 360)).toBe("-1360ms");
  });

  it("projects a reverse seek from compiled events", () => {
    const compiled = arrivalFixture(5000).compiled;
    expect(projectFrame(compiled, 500).messages.map((message) => message.id)).toEqual(["in-1"]);
    expect(projectFrame(compiled, 5000).draft).toBe("On my way over.");
  });
});

describe("frame geometry", () => {
  it("converts a scaled viewport box back to 402×874 coordinates", () => {
    expect(viewportRectToFrame(
      { left: 10, top: 20, width: 804, height: 1748 },
      { left: 90, top: 180, width: 200, height: 120 },
      { width: 402, height: 874 },
    )).toEqual({ x: 40, y: 80, width: 100, height: 60 });
  });

  it("formats the status clock in UTC", () => {
    expect(statusClock(nowMs)).toBe("4:41");
  });

  it("changes the digest when the frame contents change", () => {
    expect(digestText("light")).not.toBe(digestText("dark"));
  });
});

describe("catalogue labels", () => {
  it("keeps standalone scenes off the inline message kinds", () => {
    const system: CatalogueSceneDefinition = {
      id: "system",
      title: "System line",
      platform: "both",
      tier: "catalogue-only",
      sourceAnchors: ["SystemMessage"],
      summary: "Standalone SystemMessage. Not a pinned MessageKind.",
    };
    const facetime: CatalogueSceneDefinition = {
      id: "facetime",
      title: "FaceTime card",
      platform: "both",
      tier: "catalogue-only",
      sourceAnchors: ["FaceTimeCard"],
      summary: "Standalone FaceTimeCard.",
    };
    expect(confidenceText(system)).toContain("not a MessageKind");
    expect(confidenceText(facetime)).toContain("unverified");
    expect(confidenceText({
      id: "screen-effect",
      title: "Screen effect",
      platform: "both",
      tier: "catalogue-only",
      sourceAnchors: ["ScreenEffect"],
      summary: "ScreenEffect is pinned and not compiled by the foundation.",
    })).toContain("unverified");
  });
});
