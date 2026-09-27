/**
 * Fitted iOS tapback motion shared by the compiler, runtime, and renderer.
 * Times are reconstruction budgets from the 30 fps reference, not Apple's springs.
 * The long idle gap while a picker stays open is authored dwell between events.
 */

export const tapbackMotion = {
  /** Fitted: open through late glyph settle (about 0.933 s → 2.000 s). */
  entranceMs: 1067,
  /** Fitted: close through overlay gone (about 3.400 s → 3.733 s). */
  exitMs: 333,
  /** Internal selection-feedback window. The highlight then stays on the overlay field. */
  selectionFeedbackMs: 200,
  /**
   * Fitted landing tail from the reaction event through the reference endpoint.
   * The badge itself reaches its resting scale by `reactionSettleMs`; the rest is hold
   * so a last-event flow is not cut off before that endpoint.
   */
  reactionLandingMs: 1466,
  reactionSettleMs: 1000,
} as const;

export type TapbackPhase = "enter" | "open" | "select" | "exit";

export type GlyphPartPose = {
  opacity: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
};

export type TapbackTracks = {
  backdrop: number;
  lift: number;
  menuOpacity: number;
  menuScale: number;
  /** 0 = picker-sized circle, 1 = full pill. Fitted. */
  pillExpand: number;
  /** 1 = the expanded surface, 0 = the dismissal remnant. Fitted. */
  pillRemain: number;
  pillOpacity: number;
  glyphRowOpacity: number;
  bubbleOpacity: number;
  bubbleScale: number;
  options: GlyphPartPose[];
  glyphs: {
    love: GlyphPartPose;
    like: GlyphPartPose;
    dislike: GlyphPartPose;
    laughTop: GlyphPartPose;
    laughBottom: GlyphPartPose;
    emphasizeFirst: GlyphPartPose;
    emphasizeSecond: GlyphPartPose;
    question: GlyphPartPose;
  };
};

export type PillBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  radius: number;
  opacity: number;
};

const OPTION_COUNT = 12;
const REST: GlyphPartPose = { opacity: 1, scaleX: 1, scaleY: 1, x: 0, y: 0 };

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function ramp(elapsed: number, start: number, end: number): number {
  if (!(end > start)) return elapsed >= end ? 1 : 0;
  return smoothstep((elapsed - start) / (end - start));
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * clamp01(amount);
}

function sample(elapsed: number, keys: ReadonlyArray<{ t: number; v: number }>): number {
  const first = keys[0];
  if (!first) return 0;
  if (elapsed <= first.t) return first.v;
  for (let index = 1; index < keys.length; index += 1) {
    const next = keys[index];
    const prev = keys[index - 1];
    if (!next || !prev) break;
    if (elapsed <= next.t) {
      const span = next.t - prev.t;
      const amount = span > 0 ? smoothstep((elapsed - prev.t) / span) : 1;
      return lerp(prev.v, next.v, amount);
    }
  }
  return keys[keys.length - 1]?.v ?? 0;
}

function part(opacity: number, scaleX: number, scaleY = scaleX, x = 0, y = 0): GlyphPartPose {
  return { opacity, scaleX, scaleY, x, y };
}

function loveAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 90, v: 0 }, { t: 180, v: 1 }]),
    sample(elapsed, [{ t: 90, v: 0.4 }, { t: 220, v: 0.9 }, { t: 340, v: 1.04 }, { t: 480, v: 1 }]),
  );
}

function thumbAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 80, v: 0 }, { t: 170, v: 1 }]),
    sample(elapsed, [{ t: 80, v: 0.45 }, { t: 200, v: 0.92 }, { t: 320, v: 1 }]),
  );
}

function laughTopAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 120, v: 0 }, { t: 210, v: 1 }]),
    sample(elapsed, [{ t: 140, v: 0.5 }, { t: 260, v: 1 }]),
    sample(elapsed, [{ t: 140, v: 0.35 }, { t: 267, v: 0.92 }, { t: 400, v: 1 }]),
    0,
    sample(elapsed, [{ t: 140, v: -2 }, { t: 400, v: 0 }]),
  );
}

function laughBottomAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 170, v: 0 }, { t: 300, v: 0.8 }, { t: 420, v: 1 }]),
    sample(elapsed, [{ t: 180, v: 0.3 }, { t: 267, v: 0.55 }, { t: 420, v: 0.84 }, { t: 600, v: 1 }]),
    sample(elapsed, [{ t: 180, v: 0.22 }, { t: 267, v: 0.48 }, { t: 334, v: 0.7 }, { t: 467, v: 0.9 }, { t: 640, v: 1 }]),
    0,
    sample(elapsed, [{ t: 180, v: 5 }, { t: 267, v: 3 }, { t: 520, v: 0 }]),
  );
}

function emphasizeFirstAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 150, v: 0 }, { t: 240, v: 1 }]),
    1,
    sample(elapsed, [{ t: 160, v: 0.35 }, { t: 267, v: 0.96 }, { t: 400, v: 1 }]),
  );
}

function emphasizeSecondAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 230, v: 0 }, { t: 360, v: 0.7 }, { t: 500, v: 1 }]),
    1,
    sample(elapsed, [
      { t: 220, v: 0.05 },
      { t: 267, v: 0.22 },
      { t: 334, v: 0.35 },
      { t: 400, v: 0.48 },
      { t: 467, v: 0.62 },
      { t: 534, v: 0.78 },
      { t: 600, v: 0.9 },
      { t: 700, v: 0.97 },
      { t: 900, v: 1 },
    ]),
  );
}

function questionAt(elapsed: number): GlyphPartPose {
  return part(
    sample(elapsed, [{ t: 300, v: 0 }, { t: 400, v: 0.45 }, { t: 500, v: 0.9 }, { t: 620, v: 1 }]),
    sample(elapsed, [
      { t: 300, v: 0.12 },
      { t: 400, v: 0.28 },
      { t: 467, v: 0.38 },
      { t: 534, v: 0.55 },
      { t: 600, v: 0.75 },
      { t: 700, v: 0.9 },
      { t: 900, v: 1 },
    ]),
    sample(elapsed, [{ t: 300, v: 0.2 }, { t: 420, v: 0.5 }, { t: 560, v: 0.88 }, { t: 760, v: 1 }]),
  );
}

function optionAt(index: number, elapsed: number): GlyphPartPose {
  const start = 70 + index * 22;
  const amount = ramp(elapsed, start, start + 150);
  return part(amount, lerp(0.82, 1, amount), lerp(0.82, 1, amount), lerp(8, 0, amount), 0);
}

function glyphsAt(elapsed: number): TapbackTracks["glyphs"] {
  return {
    love: loveAt(elapsed),
    like: thumbAt(elapsed),
    dislike: thumbAt(elapsed + 20),
    laughTop: laughTopAt(elapsed),
    laughBottom: laughBottomAt(elapsed),
    emphasizeFirst: emphasizeFirstAt(elapsed),
    emphasizeSecond: emphasizeSecondAt(elapsed),
    question: questionAt(elapsed),
  };
}

function settledGlyphs(): TapbackTracks["glyphs"] {
  return {
    love: REST,
    like: REST,
    dislike: REST,
    laughTop: REST,
    laughBottom: REST,
    emphasizeFirst: REST,
    emphasizeSecond: REST,
    question: REST,
  };
}

function entranceTracks(elapsed: number): TapbackTracks {
  const backdrop = ramp(elapsed, 0, 150);
  const lift = ramp(elapsed, 0, 130);
  const menu = ramp(elapsed, 20, 170);
  const pillExpand = ramp(elapsed, 50, 280);
  return {
    backdrop,
    lift,
    menuOpacity: menu,
    menuScale: lerp(0.55, 1, menu),
    pillExpand,
    pillRemain: 1,
    pillOpacity: lerp(0.55, 1, ramp(elapsed, 40, 180)),
    glyphRowOpacity: ramp(elapsed, 80, 220),
    bubbleOpacity: ramp(elapsed, 60, 220),
    bubbleScale: lerp(0.35, 1, ramp(elapsed, 60, 220)),
    options: Array.from({ length: OPTION_COUNT }, (_, index) => optionAt(index, elapsed)),
    glyphs: glyphsAt(elapsed),
  };
}

function settledTracks(): TapbackTracks {
  return {
    backdrop: 1,
    lift: 1,
    menuOpacity: 1,
    menuScale: 1,
    pillExpand: 1,
    pillRemain: 1,
    pillOpacity: 1,
    glyphRowOpacity: 1,
    bubbleOpacity: 1,
    bubbleScale: 1,
    options: Array.from({ length: OPTION_COUNT }, () => REST),
    glyphs: settledGlyphs(),
  };
}

function hiddenTracks(): TapbackTracks {
  const hidden = part(0, 0.2, 0.2);
  return {
    backdrop: 0,
    lift: 0,
    menuOpacity: 0,
    menuScale: 0.9,
    pillExpand: 1,
    pillRemain: 0,
    pillOpacity: 0,
    glyphRowOpacity: 0,
    bubbleOpacity: 0,
    bubbleScale: 0.2,
    options: Array.from({ length: OPTION_COUNT }, () => hidden),
    glyphs: {
      love: hidden,
      like: hidden,
      dislike: hidden,
      laughTop: hidden,
      laughBottom: hidden,
      emphasizeFirst: hidden,
      emphasizeSecond: hidden,
      question: hidden,
    },
  };
}

function exitTracks(exitElapsed: number, entranceElapsed: number): TapbackTracks {
  const from = entranceTracks(entranceElapsed);
  const glyphGone = ramp(exitElapsed, 30, 100);
  const menuGone = ramp(exitElapsed, 0, 70);
  const liftBack = ramp(exitElapsed, 0, 80);
  const surface = ramp(exitElapsed, 110, 320);
  return {
    ...from,
    backdrop: from.backdrop * (1 - ramp(exitElapsed, 0, 200)),
    lift: from.lift * (1 - liftBack),
    menuOpacity: from.menuOpacity * (1 - menuGone),
    menuScale: lerp(from.menuScale, 0.92, menuGone),
    pillExpand: from.pillExpand,
    pillRemain: 1 - surface,
    pillOpacity: from.pillOpacity,
    glyphRowOpacity: from.glyphRowOpacity * (1 - glyphGone),
    bubbleOpacity: from.bubbleOpacity * (1 - glyphGone),
    bubbleScale: lerp(from.bubbleScale, 0.45, glyphGone),
  };
}

export type TapbackVisualInput = {
  phase: TapbackPhase;
  /** Phase-relative canonical milliseconds. */
  elapsedMs: number;
  /** Time since the gesture opened. During exit this is frozen at the close. */
  entranceElapsedMs: number;
  reduced?: boolean;
};

/** One deterministic pose. Reduced motion skips elastic glyph formation and keeps selection meaning to the caller. */
export function tapbackVisualAt(input: TapbackVisualInput): TapbackTracks {
  if (input.reduced) {
    return input.phase === "exit" ? hiddenTracks() : settledTracks();
  }
  if (input.phase === "exit") return exitTracks(input.elapsedMs, input.entranceElapsedMs);
  const base = entranceTracks(input.entranceElapsedMs);
  if (input.phase !== "select") return base;
  const soften = 0.42 + 0.28 * ramp(input.elapsedMs, 0, 80);
  return {
    ...base,
    menuOpacity: base.menuOpacity * (1 - soften),
    menuScale: base.menuScale * (1 - 0.03 * ramp(input.elapsedMs, 0, 80)),
  };
}

/**
 * Fitted pill geometry. A uniform scale cannot turn the wide pill into a circle and then a dot.
 * `remain` 1 keeps the entrance shape; lower values run wide pill → short pill → circle → dot.
 */
export function fittedPillBox(expand: number, remain: number, fullWidth: number, fullHeight: number): PillBox {
  const grownW = lerp(44, fullWidth, expand);
  const grownH = lerp(44, fullHeight, expand);
  const shortW = Math.max(grownH * 2.1, grownH);
  const diameter = Math.min(grownH, 36);
  const amount = clamp01(remain);
  let width = grownW;
  let height = grownH;
  let opacity = 1;
  if (amount >= 0.7) {
    width = lerp(grownW, shortW, (1 - amount) / 0.3);
  } else if (amount >= 0.4) {
    const t = (0.7 - amount) / 0.3;
    width = lerp(shortW, diameter, t);
    height = lerp(grownH, diameter, t);
  } else {
    const t = (0.4 - amount) / 0.4;
    width = lerp(diameter, 4, t);
    height = lerp(diameter, 4, t);
    opacity = 1 - t;
  }
  return {
    left: (fullWidth - width) / 2,
    top: (fullHeight - height) / 2,
    width: Math.max(0, width),
    height: Math.max(0, height),
    radius: Math.max(0, Math.min(width, height) / 2),
    opacity,
  };
}

/** Fitted attached-reaction scale. There is no flight from the picker to the badge. */
export function tapbackLandingAt(elapsedMs: number): { opacity: number; scale: number } {
  return {
    opacity: sample(elapsedMs, [{ t: 0, v: 0.65 }, { t: 40, v: 1 }]),
    scale: sample(elapsedMs, [
      { t: 0, v: 0.22 },
      { t: 70, v: 0.42 },
      { t: 150, v: 0.82 },
      { t: 240, v: 1.08 },
      { t: 380, v: 0.96 },
      { t: tapbackMotion.reactionSettleMs, v: 1 },
    ]),
  };
}
