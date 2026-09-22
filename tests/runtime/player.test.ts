import { describe, expect, it } from "vitest";
import type { Player } from "@/contracts";
import type { LogicalClock } from "@/runtime";
import { createPlayer, frameAt, logicalState, stateAt } from "@/runtime";
import { compiledFixture } from "../contracts/compiled.fixture";
import { richDemo } from "./fixture";

class FakeClock implements LogicalClock {
  time = 0;
  requests = 0;
  pending = new Map<number, (timestamp: number) => void>();
  private nextId = 1;

  now() {
    return this.time;
  }

  requestFrame(callback: (timestamp: number) => void) {
    this.requests += 1;
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

describe("createPlayer", () => {
  it("seeks in any order to the same frame as a fresh time", () => {
    const clock = new FakeClock();
    const player = createPlayer(richDemo, { clock });
    const sequence = [5000, 0, 2400, 5000, 1000];
    const seen = sequence.map((timeMs) => {
      player.seek(timeMs);
      return player.frame();
    });
    const fresh = createPlayer(richDemo, { clock: new FakeClock() });
    fresh.seek(2400);
    expect(seen[2]).toEqual(frameAt(richDemo, 2400));
    expect(seen[2]).toEqual(fresh.frame());
    expect(logicalState(seen[4])).toEqual(stateAt(richDemo, 1000));
    expect(player.state()).toMatchObject({ timeMs: 1000, playing: false, durationMs: 5000 });
  });

  it("excludes paused time, stops at the end, and keeps a single frame driver", () => {
    const clock = new FakeClock();
    const player = createPlayer({ ...richDemo, durationMs: 1000 }, { clock });
    player.play();
    player.play();
    expect(clock.requests).toBe(1);
    expect(clock.pending.size).toBe(1);
    clock.time = 400;
    clock.fire();
    expect(player.state()).toMatchObject({ timeMs: 400, playing: true });
    clock.time = 400;
    player.pause();
    clock.time = 5000;
    player.play();
    clock.time = 5300;
    clock.fire();
    expect(player.state().timeMs).toBe(700);
    player.seek(1000);
    expect(player.state()).toMatchObject({ timeMs: 1000, playing: false });
    expect(clock.pending.size).toBe(0);
    const requests = clock.requests;
    player.play();
    expect(player.state().playing).toBe(false);
    expect(clock.requests).toBe(requests);
  });

  it("ignores a frame that arrives after pause or dispose", () => {
    const released: Array<(timestamp: number) => void> = [];
    const clock: LogicalClock & { time: number } = {
      time: 0,
      now() {
        return this.time;
      },
      requestFrame(callback) {
        released.push(callback);
        return released.length;
      },
      cancelFrame() {},
    };
    const player = createPlayer(richDemo, { clock });
    const notices: number[] = [];
    player.subscribe(() => notices.push(player.revision()));
    player.play();
    clock.time = 250;
    player.pause();
    released[0]?.(900);
    expect(player.state()).toMatchObject({ timeMs: 250, playing: false });
    player.dispose();
    const afterDispose = notices.length;
    released[0]?.(1200);
    player.seek(10);
    player.play();
    expect(notices.length).toBe(afterDispose);
    expect(player.state().timeMs).toBe(250);
  });

  it("returns a stable snapshot and a monotonic revision from seek and reset", () => {
    const player = createPlayer(richDemo, { clock: new FakeClock() });
    expect(player.revision()).toBe(0);
    expect(player.getSnapshot()).toBe(player.getSnapshot());
    const first = player.seek(2400);
    const snapshot = player.getSnapshot();
    expect(snapshot.revision).toBe(first);
    expect(player.getSnapshot()).toBe(snapshot);
    expect(player.frame()).toBe(snapshot.frame);
    const reset = player.reset();
    expect(reset).toBeGreaterThan(first);
    expect(player.getSnapshot()).not.toBe(snapshot);
    expect(player.frame()).toEqual(frameAt(richDemo, 0));
    expect(snapshot.frame.timeMs).toBe(2400);
    expect(player.state()).toMatchObject({ timeMs: 0, playing: false });
    const again = player.seek(5000);
    expect(again).toBeGreaterThan(reset);
    player.reset();
    expect(logicalState(player.frame())).toEqual(stateAt(richDemo, 0));
  });

  it("stops notifying after unsubscribe", () => {
    const player = createPlayer(richDemo, { clock: new FakeClock() });
    let calls = 0;
    const stop = player.subscribe(() => {
      calls += 1;
    });
    player.seek(10);
    stop();
    player.seek(20);
    expect(calls).toBe(1);
  });

  it("satisfies the frozen Player contract", () => {
    const player: Player = createPlayer(compiledFixture);
    player.seek(0);
    expect(player.state()).toMatchObject({ timeMs: 0, playing: false, durationMs: compiledFixture.durationMs });
    expect(player.frame().messages.map((item) => item.id)).toEqual(["in-1"]);
  });

  it("resets anchors when seeking backward during playback", () => {
    const clock = new FakeClock();
    const player = createPlayer(richDemo, { clock });
    player.play();
    clock.time = 500;
    clock.fire();
    player.seek(100);
    clock.time = 650;
    clock.fire();
    expect(player.state()).toMatchObject({ timeMs: 250, playing: true });
  });
});
