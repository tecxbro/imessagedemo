import { frameAt } from "@/runtime/project";
import type { CreatePlayerOptions, DemoSource, LogicalClock, PlayerSnapshot, VisualFrame } from "@/runtime/types";
import type { PlaybackState } from "@/contracts";

export type PlayerController = {
  play(): void;
  pause(): void;
  seek(timeMs: number): number;
  reset(): number;
  state(): PlaybackState;
  frame(): VisualFrame;
  revision(): number;
  getSnapshot(): PlayerSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
};

export function animationClock(): LogicalClock {
  return {
    now() {
      return globalThis.performance?.now?.() ?? 0;
    },
    requestFrame(callback) {
      if (typeof globalThis.requestAnimationFrame !== "function") {
        throw new Error("requestAnimationFrame is unavailable; pass a LogicalClock to createPlayer");
      }
      return globalThis.requestAnimationFrame(callback);
    },
    cancelFrame(handle) {
      globalThis.cancelAnimationFrame?.(handle);
    },
  };
}

function clamp(timeMs: number, durationMs: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  if (timeMs >= durationMs) return durationMs;
  return timeMs;
}

function freezeSnapshot(snapshot: PlayerSnapshot): PlayerSnapshot {
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
    Object.freeze(value);
    for (const nested of Object.values(value)) visit(nested);
  };
  visit(snapshot);
  return snapshot;
}

export function createPlayer(compiled: DemoSource, options: CreatePlayerOptions = {}): PlayerController {
  const clock = options.clock ?? animationClock();
  const durationMs = Math.max(0, compiled.durationMs);
  let logicalTime = 0;
  let playing = false;
  let revision = 0;
  let disposed = false;
  let anchorClock = 0;
  let anchorLogical = 0;
  let handle: number | null = null;
  let generation = 0;
  let snapshot: PlayerSnapshot | null = null;
  const listeners = new Set<() => void>();

  function cancelPending() {
    generation += 1;
    if (handle === null) return;
    clock.cancelFrame(handle);
    handle = null;
  }

  function notify() {
    snapshot = null;
    for (const listener of [...listeners]) listener();
  }

  function bump(): number {
    revision += 1;
    notify();
    return revision;
  }

  function readSnapshot(): PlayerSnapshot {
    if (snapshot && snapshot.revision === revision) return snapshot;
    snapshot = freezeSnapshot({
      revision,
      playback: { timeMs: logicalTime, playing, durationMs },
      frame: frameAt(compiled, logicalTime),
    });
    return snapshot;
  }

  function schedule() {
    if (disposed || !playing || handle !== null) return;
    const scheduled = generation;
    handle = clock.requestFrame((timestamp) => {
      handle = null;
      if (disposed || !playing || scheduled !== generation) return;
      const next = clamp(anchorLogical + (timestamp - anchorClock), durationMs);
      logicalTime = next;
      if (next >= durationMs) {
        playing = false;
        bump();
        return;
      }
      bump();
      schedule();
    });
  }

  return {
    play() {
      if (disposed || playing || logicalTime >= durationMs) return;
      playing = true;
      anchorClock = clock.now();
      anchorLogical = logicalTime;
      bump();
      schedule();
    },
    pause() {
      if (disposed || !playing) return;
      logicalTime = clamp(anchorLogical + (clock.now() - anchorClock), durationMs);
      playing = false;
      cancelPending();
      bump();
    },
    seek(timeMs) {
      if (disposed) return revision;
      logicalTime = clamp(timeMs, durationMs);
      if (playing) {
        if (logicalTime >= durationMs) {
          playing = false;
          cancelPending();
        } else {
          anchorClock = clock.now();
          anchorLogical = logicalTime;
        }
      }
      return bump();
    },
    reset() {
      if (disposed) return revision;
      playing = false;
      logicalTime = 0;
      cancelPending();
      return bump();
    },
    state() {
      return readSnapshot().playback;
    },
    frame() {
      return readSnapshot().frame;
    },
    revision() {
      return revision;
    },
    getSnapshot() {
      return readSnapshot();
    },
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      playing = false;
      cancelPending();
      listeners.clear();
      snapshot = null;
    },
  };
}
