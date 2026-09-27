import { motionDuration, motionFps, motionFrameCount, motionFrames } from "./motion-data";

/**
 * The recorded presentation's timeline, in the recording's 512 × 1112 coordinate space.
 * A port of the recreation package's `sample`/`stateAt`: measured 30 fps geometry, linearly interpolated
 * so the sheet renders at display refresh rate. The 60 fps reference export holds each source frame
 * twice; nothing here treats those holds as extra motion.
 */
export const source = { width: 512, height: 1112 } as const;

/** Settled sheet rectangle (x, width, height) and the off-screen resting top used before and after a cycle. */
export const sheet = { x: 10, width: 492, height: 848, settledTop: 254, hiddenTop: 1114 } as const;

/** Source frames that bound the recorded phases (see the package's analysis/timeline.json). */
export const frames = {
  last: motionFrameCount - 1,
  /** system-chrome-1: first frame of the first presentation. Manual open starts here. */
  openStart: 66,
  /** card-expand-1 ends; the red card holds 248 px wide from here. */
  expanded1: 121,
  /** pending-1 last frame; a manual open holds here with the spinner running. */
  pendingHold: 181,
  /** sheet-exit-1 first frame; a manual close follows this measured exit track. */
  exitStart: 185,
  /** chrome-restore-1 ends. */
  restored1: 215,
  /** system-chrome-2 first frame of the second presentation. */
  openStart2: 299,
  /** card-expand-2 begins / ends. */
  expandStart2: 332,
  expanded2: 352,
  restoreStart2: 388,
  restored2: 405,
} as const;

/** Seconds of the two recorded states compared against keyframes (source frames 90 and 135). */
export const referenceTimes = { fan: 3, expanded: 4.5 } as const;

/** Duration of a manual close: 14 source frames of the measured exit track. */
export const closeDuration = 14 / motionFps;
/** How long the close control stays highlighted at the start of a manual close. */
export const closePressedDuration = 0.07;

export type MotionState = {
  top: number;
  dim: number;
  chromeOpacity: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  expand: number;
  visible: boolean;
  pressed: boolean;
  time: number;
  sourceFrame: number | null;
};

type Sample = Omit<MotionState, "visible" | "time" | "sourceFrame">;

const clamp = (value: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

function sample(n: number): Sample {
  const index = Math.max(0, Math.min(frames.last, n));
  const f = motionFrames[index];
  const expanded = (index >= frames.expanded1 && index < frames.openStart2) || index >= frames.expanded2;
  // Interior-fill threshold -> visible antialiased edge, ±2 px.
  const top = f[0] === null ? sheet.hiddenTop : f[0] - 2;
  const w = f[3] || (expanded ? 248 : 202);
  const h = f[4] && f[4] > 100 ? f[4] : (w * 157) / 248;
  const x = f[1] ?? (source.width - w) / 2;
  const cardY = f[2] !== null && f[0] !== null ? f[2] - top : expanded ? 208 : 223;
  const chromeOpacity =
    (index >= frames.openStart && index < 198) || (index >= frames.openStart2 && index < frames.restoreStart2)
      ? 1
      : index >= 198 && index < frames.restored1
        ? (frames.restored1 - index) / 17
        : index >= frames.restoreStart2 && index < frames.restored2
          ? (frames.restored2 - index) / 17
          : 0;
  const expand =
    index < 100
      ? 0
      : index < frames.expanded1
        ? clamp((w - 202) / 46)
        : index < frames.openStart2
          ? 1
          : index < frames.expandStart2
            ? 0
            : index < frames.expanded2
              ? clamp((w - 202) / 46)
              : 1;
  return {
    top,
    dim: f[5],
    chromeOpacity,
    cardX: x,
    cardY,
    cardW: w,
    cardH: h,
    expand,
    pressed: (index >= 182 && index <= 185) || (index >= 372 && index <= 375),
  };
}

const interpolated = ["top", "dim", "chromeOpacity", "cardX", "cardY", "cardW", "cardH", "expand"] as const;

/** The recorded state at `seconds`, interpolated between the two adjacent measured source frames. */
export function stateAt(seconds: number): MotionState {
  if (!Number.isFinite(seconds)) throw new TypeError("Time must be finite.");
  const t = clamp(seconds, 0, motionDuration);
  const f = t * motionFps;
  const n = Math.floor(f);
  const p = f - n;
  const a = sample(n);
  const b = sample(n + 1);
  const state = { ...a };
  for (const key of interpolated) state[key] = lerp(a[key], b[key], p);
  return { ...state, pressed: a.pressed, visible: state.top < source.height - 1, time: t, sourceFrame: Math.min(n, frames.last) };
}

/**
 * A manual open replays the first recorded presentation from frame 66 and holds at frame 181 (card
 * enlarged, spinner running). A selected card or reduced motion shows the settled 4.5 s pose. The
 * spinner clock keeps advancing either way.
 */
export function openStateAt(elapsed: number, options: { selected: boolean; reducedMotion: boolean }): MotionState {
  const openAt = frames.openStart / motionFps;
  const at = options.selected || options.reducedMotion ? referenceTimes.expanded : Math.min(frames.pendingHold / motionFps, openAt + elapsed);
  return { ...stateAt(at), time: openAt + elapsed };
}

/**
 * A manual close moves the current pose off-screen along the measured exit track (frames 185–198), so
 * closing during the entrance or the card growth leaves from wherever the sheet is. `done` is true once
 * the 14-frame exit has elapsed (or immediately under reduced motion).
 */
export function closingStateAt(from: MotionState, elapsed: number, reducedMotion: boolean): { state: MotionState; done: boolean } {
  const native = stateAt(frames.exitStart / motionFps + elapsed);
  const progress = reducedMotion ? 1 : clamp((native.top - sheet.settledTop) / (sheet.hiddenTop - sheet.settledTop));
  const state: MotionState = {
    ...from,
    top: lerp(from.top, sheet.hiddenTop, progress),
    dim: from.dim * (1 - progress),
    visible: progress < 1,
    pressed: elapsed < closePressedDuration,
    time: from.time + elapsed,
  };
  return { state, done: reducedMotion || elapsed >= closeDuration };
}

export { motionDuration, motionFps };
