import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { authoringDocumentSchema } from "@/cli/authoring";
import { inspectVideoAsset, preflightAssets } from "@/cli/preflight";
import { compileDemo, validateDemo } from "@/compiler";
import { frameAt } from "@/runtime";

const payload = { src: "/demo-assets/sunday/memo-dishes.mp4", poster: "/demo-assets/sunday/avatar.png", width: 1280, height: 720 };
function flow(video: unknown = payload) {
  return { id: "video-test", title: "Video", platform: "ios", theme: "light", contact: { name: "Memo" },
    nowMs: 5000, draft: "", typing: false, screen: "conversation", messages: [
      { id: "v1", kind: "video", text: "Memo doing the dishes", direction: "incoming", atMs: 1000, video },
    ] };
}

describe("local iOS video authoring", () => {
  it("preserves video through CLI schema, compiler and runtime", () => {
    const parsed = authoringDocumentSchema.parse(flow());
    const result = validateDemo(parsed);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const compiled = compileDemo(result.demo);
    expect(frameAt(compiled, 0).messages[0].video).toEqual(payload);
    expect(frameAt(compiled, 0).messages[0].video).not.toBe(result.demo.messages[0].video);
    expect(() => preflightAssets(parsed, process.cwd())).not.toThrow();
  });
  it.each([
    undefined, {}, { src: "https://example.com/movie.mp4" }, { src: "/demo-assets/../movie.mp4" },
    { src: "/demo-assets/%2e%2e/movie.mp4" }, { src: "/demo-assets/movie.mov" },
    { ...payload, poster: "https://example.com/poster.png" }, { ...payload, width: 0 },
    { ...payload, autoplay: true },
  ])("rejects invalid/unsafe video payload %j", video => {
    const input = flow(); input.messages[0].video = video;
    expect(validateDemo(input).ok).toBe(false);
  });
  it("rejects macOS and video payloads on other message kinds", () => {
    expect(validateDemo({ ...flow(), platform: "macos" }).ok).toBe(false);
    const input = flow(); input.messages[0].kind = "text";
    expect(validateDemo(input).ok).toBe(false);
  });
  it("rejects missing, fake and escaped local video files", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "video-assets-"));
    try {
      mkdirSync(path.join(root, "public/demo-assets"), { recursive: true });
      writeFileSync(path.join(root, "public/demo-assets/fake.mp4"), "not a video");
      writeFileSync(path.join(root, "outside.mp4"), Buffer.from("0000ftyp0000"));
      symlinkSync(path.join(root, "outside.mp4"), path.join(root, "public/demo-assets/escape.mp4"));
      for (const src of ["missing.mp4", "fake.mp4", "escape.mp4"]) {
        expect(() => inspectVideoAsset(`/demo-assets/${src}`, root)).toThrow();
      }
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
