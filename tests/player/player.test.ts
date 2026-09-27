import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import catalogueJson from "@/contracts/catalogue-scenes.json";
import { catalogueSceneIds } from "@/player/catalogue";
import { compiledFixture } from "../contracts/compiled.fixture";
import { createPlayerDouble, frameAtDouble } from "../contracts/doubles";
import { createRuntimeSession } from "@/player/controller";
import { playbackControlLabel, runPlaybackControl } from "@/player/playback";
import { createPlayer, type LogicalClock } from "@/runtime";

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

describe("playback control", () => {
  it("names play, pause, resume, and replay from the logical clock", () => {
    expect(playbackControlLabel({ timeMs: 0, playing: false, durationMs: 8000 })).toBe("Play");
    expect(playbackControlLabel({ timeMs: 0, playing: true, durationMs: 8000 })).toBe("Pause");
    expect(playbackControlLabel({ timeMs: 1200, playing: false, durationMs: 8000 })).toBe("Resume");
    expect(playbackControlLabel({ timeMs: 8000, playing: false, durationMs: 8000 })).toBe("Replay");
    expect(playbackControlLabel({ timeMs: 0, playing: false, durationMs: 0 })).toBe("Play");
  });

  it("pauses, resumes from the held time, and replay restarts on one clock", async () => {
    const clock = new FakeClock();
    const player = createPlayer({ ...compiledFixture, durationMs: 1000 }, { clock });
    const session = createRuntimeSession({
      compiled: compiledFixture,
      player,
      getRenderer: () => ({ seek() {}, element: fakeElement() }),
      getFrameElement: () => fakeElement(),
    });
    expect(playbackControlLabel(session.state())).toBe("Play");
    await runPlaybackControl(session.state(), session);
    player.play();
    expect(clock.pending.size).toBe(1);
    clock.time = 400;
    clock.fire();
    expect(session.state()).toMatchObject({ timeMs: 400, playing: true });
    expect(playbackControlLabel(session.state())).toBe("Pause");
    await runPlaybackControl(session.state(), session);
    clock.time = 900;
    clock.fire();
    expect(session.state()).toMatchObject({ timeMs: 400, playing: false });
    expect(clock.pending.size).toBe(0);
    expect(playbackControlLabel(session.state())).toBe("Resume");
    await runPlaybackControl(session.state(), session);
    expect(clock.pending.size).toBe(1);
    clock.time = 1500;
    clock.fire();
    expect(session.state()).toMatchObject({ timeMs: 1000, playing: false });
    expect(clock.pending.size).toBe(0);
    clock.time = 4000;
    clock.fire();
    expect(session.state().timeMs).toBe(1000);
    expect(playbackControlLabel(session.state())).toBe("Replay");
    await runPlaybackControl(session.state(), session);
    expect(session.state()).toMatchObject({ timeMs: 0, playing: true });
    expect(session.frame().messages.map((message) => message.id)).toEqual(["in-1"]);
    expect(clock.pending.size).toBe(1);
  });
});

class FakeClock implements LogicalClock {
  time = 0;
  pending = new Map<number, (timestamp: number) => void>();
  private nextId = 1;

  now() {
    return this.time;
  }

  requestFrame(callback: (timestamp: number) => void) {
    const id = this.nextId;
    this.nextId += 1;
    this.pending.set(id, callback);
    return id;
  }

  cancelFrame(handle: number) {
    this.pending.delete(handle);
  }

  fire() {
    const queued = [...this.pending.entries()];
    this.pending.clear();
    for (const [, callback] of queued) callback(this.time);
  }
}

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

