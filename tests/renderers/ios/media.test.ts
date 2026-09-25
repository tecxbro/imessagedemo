import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { frameAt, pendingCueDurations, stateAt } from "@/runtime";
import {
  controlledAudioFromFrame,
  describePhotoMessage,
  imageViewerCueDurationMs,
  imageViewerFromFrame,
  imageViewerMedia,
  photosFromMessage,
} from "@/renderers/ios/media";

const nowMs = Date.parse("2026-09-21T16:41:00.000Z");

function mediaFlow() {
  return {
    id: "ios-media",
    title: "iOS media",
    platform: "ios",
    theme: "light",
    contact: { name: "Alex Morgan", initials: "AM" },
    nowMs,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [
      {
        id: "m9",
        text: "",
        direction: "incoming",
        atMs: 0,
        kind: "audio",
        audio: { duration: 12, peaks: [0.2, 0.8, 0.4, 0.9, 0.3] },
      },
      {
        id: "m7",
        text: "",
        direction: "incoming",
        atMs: 1000,
        kind: "image",
        images: [
          { src: "park-64x48.png", alt: "Park", width: 64, height: 48 },
          { src: "trail-64x48.png", alt: "Trail", width: 64, height: 48 },
        ],
      },
    ],
    events: [
      { type: "audio-control", atMs: 8200, messageId: "m9", position: 2.4, playing: true },
      { type: "overlay", atMs: 9000, overlay: { kind: "image-viewer", messageId: "m7", index: 1 } },
      { type: "overlay", atMs: 9400, overlay: { kind: "closed" } },
    ],
  };
}

function compiledMedia() {
  const validated = validateDemo(mediaFlow());
  expect(validated.ok).toBe(true);
  if (!validated.ok) throw new Error("validateDemo failed");
  return compileDemo(validated.demo);
}

describe("iOS media helpers", () => {
  it("describes single photos and multi-photo grids from canonical messages", () => {
    const single = {
      id: "one",
      kind: "image" as const,
      images: [{ src: "a.png", alt: "A", width: 4, height: 4 }],
    };
    const grid = {
      id: "m7",
      kind: "image" as const,
      images: [
        { src: "park-64x48.png", alt: "Park" },
        { src: "trail-64x48.png", alt: "Trail" },
      ],
    };
    expect(photosFromMessage(single)).toEqual([{ src: "a.png", alt: "A", width: 4, height: 4 }]);
    expect(describePhotoMessage(single)).toEqual({ kind: "photo", messageId: "one", images: photosFromMessage(single) });
    expect(describePhotoMessage(grid)).toEqual({
      kind: "photo-grid",
      messageId: "m7",
      images: photosFromMessage(grid),
      count: 2,
    });
    expect(photosFromMessage({ id: "text" })).toBeNull();
  });

  it("keeps the image-viewer cue duration aligned with pendingCueDurations.imageViewer", () => {
    expect(imageViewerCueDurationMs).toBe(300);
    expect(imageViewerCueDurationMs).toBe(pendingCueDurations.imageViewer);
  });
});

describe("image viewer projection", () => {
  it("is closed before the overlay event", () => {
    const compiled = compiledMedia();
    const state = stateAt(compiled, 8999);
    expect(state.overlay).toEqual({ kind: "closed" });
    expect(imageViewerMedia(state)).toMatchObject({
      open: false,
      messageId: null,
      index: 0,
      progress: 0,
      photos: [],
    });
  });

  it("opens at the authored index and settles progress when the enter cue is absent", () => {
    const compiled = compiledMedia();
    const mid = frameAt(compiled, 9000 + pendingCueDurations.imageViewer / 2);
    expect(mid.overlay).toEqual({ kind: "image-viewer", messageId: "m7", index: 1 });
    const midViewer = imageViewerFromFrame(mid);
    expect(midViewer.open).toBe(true);
    expect(midViewer.messageId).toBe("m7");
    expect(midViewer.index).toBe(1);
    expect(midViewer.progress).toBeCloseTo(0.5);
    expect(midViewer.photos).toHaveLength(2);

    const settled = frameAt(compiled, 9000 + pendingCueDurations.imageViewer);
    expect(settled.overlay).toEqual({ kind: "image-viewer", messageId: "m7", index: 1 });
    expect(imageViewerFromFrame(settled)).toMatchObject({
      open: true,
      messageId: "m7",
      index: 1,
      progress: 1,
    });
    expect(settled.cues.some((cue) => cue.kind === "overlay-enter")).toBe(false);
  });

  it("is closed after a close event", () => {
    const compiled = compiledMedia();
    const afterExit = stateAt(compiled, 9400 + pendingCueDurations.imageViewer);
    expect(afterExit.overlay).toEqual({ kind: "closed" });
    expect(imageViewerMedia(afterExit)).toMatchObject({
      open: false,
      messageId: null,
      progress: 0,
    });
  });
});

describe("controlled audio projection", () => {
  it("is null before the audio-control event", () => {
    const compiled = compiledMedia();
    const before = stateAt(compiled, 8199);
    expect(before.audio).toBeNull();
    expect(controlledAudioFromFrame(before)).toBeNull();
  });

  it("projects playing position at the control timestamp", () => {
    const compiled = compiledMedia();
    const atControl = stateAt(compiled, 8200);
    expect(atControl.audio).toEqual({ messageId: "m9", position: 2.4, playing: true });
    expect(controlledAudioFromFrame(atControl)).toEqual({
      messageId: "m9",
      position: 2.4,
      playing: true,
    });
  });

  it("yields the same audio visual state via stateAt direct seek", () => {
    const compiled = compiledMedia();
    const walked = stateAt(compiled, 8200);
    const sought = stateAt(compiled, 8200);
    expect(controlledAudioFromFrame(walked)).toEqual(controlledAudioFromFrame(sought));
    expect(controlledAudioFromFrame(sought)).toEqual({
      messageId: "m9",
      position: 2.4,
      playing: true,
    });
    // Later seek still holds the authored control — no wall-clock playback.
    expect(controlledAudioFromFrame(stateAt(compiled, 9000))).toEqual({
      messageId: "m9",
      position: 2.4,
      playing: true,
    });
  });
});
