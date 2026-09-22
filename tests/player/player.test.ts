import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalogueJson from "@/contracts/catalogue-scenes.json";
import { catalogueSceneIds } from "@/player/catalogue";
import { compiledFixture } from "../contracts/compiled.fixture";
import { createPlayerDouble, frameAtDouble } from "../contracts/doubles";
import { createRuntimeSession } from "@/player/controller";

function fakeElement(width = 402, height = 874): HTMLElement {
  return {
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, bottom: height, right: width, x: 0, y: 0, toJSON() {} }),
    querySelectorAll: () => [],
    ownerDocument: { fonts: undefined },
  } as unknown as HTMLElement;
}

describe("player catalogue", () => {
  it("covers every frozen catalogue scene with static JSX", () => {
    const source = readFileSync(new URL("../../src/player/catalogue.tsx", import.meta.url), "utf8");
    expect(source).not.toMatch(/catalogueJson\.scenes\.map/);
    expect(source).not.toMatch(/scenes\.map\(/);
    for (const scene of catalogueJson.scenes) {
      expect(catalogueSceneIds).toContain(scene.id);
      expect(source).toContain(`case "${scene.id}":`);
    }
  });
});

describe("runtime session", () => {
  it("delegates play/pause/seek to the runtime player and discards inspect on reset", async () => {
    const compiled = compiledFixture;
    const inner = createPlayerDouble(compiled);
    const calls = { play: 0, pause: 0, seek: [] as number[] };
    const player = {
      play() {
        calls.play += 1;
        inner.play();
      },
      pause() {
        calls.pause += 1;
        inner.pause();
      },
      seek(timeMs: number) {
        calls.seek.push(timeMs);
        inner.seek(timeMs);
      },
      state: inner.state,
      frame: inner.frame,
    };
    const session = createRuntimeSession({
      compiled,
      player,
      getRenderer: () => ({ seek() {}, element: fakeElement() }),
      getFrameElement: () => fakeElement(),
    });
    session.selectMessage("out-1");
    expect(session.inspect().messageId).toBe("out-1");
    await session.play();
    await session.pause();
    const seeked = await session.seek(1000);
    const ready = await session.ready(seeked.revision);
    expect(ready.revision).toBe(seeked.revision);
    expect(ready.timeMs).toBe(1000);
    expect(ready.digest).toMatch(/^[a-f0-9]{64}$/);
    const reset = await session.reset();
    expect(session.inspect().messageId).toBeNull();
    expect(reset.timeMs).toBe(0);
    expect(calls.play).toBe(1);
    expect(calls.pause).toBe(2);
    expect(calls.seek).toEqual([1000, 0]);
  });

  it("rejects a renderer warm-up that mutates authored logical state", async () => {
    const compiled = compiledFixture;
    let frozen = true;
    const inner = createPlayerDouble(compiled);
    const player = {
      ...inner,
      frame() {
        const frame = frameAtDouble(compiled, 0);
        return frozen ? frame : { ...frame, draft: "mutated-by-warmup" };
      },
    };
    const session = createRuntimeSession({
      compiled,
      player,
      getRenderer: () => ({ seek() {}, element: fakeElement() }),
      getFrameElement: () => fakeElement(),
    });
    const seeked = await session.seek(0);
    frozen = false;
    await expect(session.ready(seeked.revision)).rejects.toThrow(/authored logical state/);
  });
});

