/**
 * Reference motion adapter for the supplied poll recording, not an Apple implementation.
 * Geometry and fill keys: measured from native 30 fps frames.
 * Indicator opacity/scale: visual starting points; composited pixels cannot uniquely identify them.
 * No clocks, timers, browser APIs, event mutation or dependency on prior playback.
 * Adapt into the repository's existing canonical runtime; do not create a second player.
 */
export type RGB = readonly [number, number, number];
export type Interpolation = "linear" | "hold";
export type PollPose = Readonly<{
  selected: boolean;
  widthProgress: number;
  rowWidth: number;
  rowHeight: number;
  radius: number;
  labelInset: number;
  indicatorCenterFromLeft: number;
  ringDiameter: number;
  ringStroke: number;
  ringOpacity: number;
  avatarDiameter: number;
  avatarOpacity: number;
  avatarScale: number;
  fill: RGB;
  label: RGB;
}>;

export const SOURCE_ONSET_MS = 47 * 1000 / 30;
export const SOURCE_DURATION_MS = 3500;
export const BASE = Object.freeze({
  left: 36, rowHeight: 109, idleWidth: 397, restWidth: 606,
  peakWidth: 624, gap: 9, labelInset: 46, indicatorEndInset: 54,
  ringDiameter: 50, ringStroke: 4.5, avatarDiameter: 54,
});

// [elapsed ms from first selected-label frame, width travel progress, R, G, B]
const MEASURED: readonly (readonly number[])[] = [
  [
    0.0,
    0.0,
    67,
    40,
    8
  ],
  [
    33.333333,
    0.019138756,
    69,
    42,
    12
  ],
  [
    66.666667,
    0.234449761,
    106,
    65,
    23
  ],
  [
    100.0,
    0.43062201,
    141,
    89,
    33
  ],
  [
    133.333333,
    0.626794258,
    174,
    115,
    42
  ],
  [
    166.666667,
    0.789473684,
    203,
    135,
    51
  ],
  [
    200.0,
    0.918660287,
    229,
    153,
    59
  ],
  [
    233.333333,
    1.004784689,
    243,
    164,
    64
  ],
  [
    266.666667,
    1.057416268,
    243,
    164,
    64
  ],
  [
    300.0,
    1.071770335,
    243,
    164,
    64
  ],
  [
    333.333333,
    1.086124402,
    243,
    164,
    64
  ],
  [
    366.666667,
    1.081339713,
    243,
    164,
    64
  ],
  [
    400.0,
    1.071770335,
    243,
    164,
    64
  ],
  [
    433.333333,
    1.052631579,
    243,
    164,
    64
  ],
  [
    466.666667,
    1.033492823,
    243,
    164,
    64
  ],
  [
    500.0,
    1.019138756,
    243,
    164,
    64
  ],
  [
    533.333333,
    1.004784689,
    243,
    164,
    64
  ],
  [
    566.666667,
    0.995215311,
    243,
    164,
    64
  ],
  [
    600.0,
    0.995215311,
    242,
    163,
    63
  ],
  [
    633.333333,
    0.990430622,
    242,
    163,
    63
  ],
  [
    666.666667,
    0.990430622,
    242,
    163,
    63
  ],
  [
    700.0,
    0.990430622,
    242,
    163,
    63
  ],
  [
    733.333333,
    0.995215311,
    242,
    163,
    63
  ],
  [
    766.666667,
    0.995215311,
    242,
    163,
    63
  ],
  [
    800.0,
    0.995215311,
    243,
    164,
    64
  ],
  [
    833.333333,
    0.995215311,
    243,
    164,
    64
  ],
  [
    866.666667,
    1.0,
    243,
    164,
    64
  ]
];
// [elapsed ms, avatar opacity, avatar scale, old ring opacity] -- APPROXIMATIONS.
const INDICATOR: readonly (readonly number[])[] = [
  [
    0,
    0,
    0.42,
    1
  ],
  [
    33.333333,
    0,
    0.42,
    1
  ],
  [
    66.666667,
    0.07,
    0.46,
    0.85
  ],
  [
    100,
    0.25,
    0.62,
    0.62
  ],
  [
    133.333333,
    0.48,
    0.76,
    0.37
  ],
  [
    166.666667,
    0.72,
    0.89,
    0.15
  ],
  [
    200,
    0.92,
    0.97,
    0.03
  ],
  [
    233.333333,
    1,
    1,
    0
  ]
];

function vectorAt(stops: readonly (readonly number[])[], ms: number, mode: Interpolation): number[] {
  if (ms <= stops[0][0]) return stops[0].slice(1);
  for (let i = 1; i < stops.length; i += 1) {
    const b = stops[i], a = stops[i - 1];
    if (ms < b[0]) {
      const p = mode === "hold" ? 0 : (ms - a[0]) / (b[0] - a[0]);
      return a.slice(1).map((v, j) => v + (b[j + 1] - v) * p);
    }
  }
  return stops[stops.length - 1].slice(1);
}

/** scale is CSS pixels per SOURCE pixel; it is a fixture calibration, not devicePixelRatio. */
export function samplePollVote(elapsedMs: number, scale = 1, mode: Interpolation = "linear"): PollPose {
  if (!Number.isFinite(elapsedMs)) throw new TypeError("elapsedMs must be finite");
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("scale must be positive and finite");
  if (mode !== "linear" && mode !== "hold") throw new TypeError("unknown interpolation mode");
  const selected = elapsedMs >= 0;
  const raw = selected ? vectorAt(MEASURED, elapsedMs, mode) : [0, 67, 40, 8];
  const indicator = selected ? vectorAt(INDICATOR, elapsedMs, mode) : [0, .42, 1];
  const widthProgress = raw[0]; // Deliberately not clamped: preserves overshoot and tiny return.
  const rowWidth = (BASE.idleWidth + (BASE.restWidth - BASE.idleWidth) * widthProgress) * scale;
  // Ignore one-code-value codec fluctuations after the visible color transition has finished.
  const fill: RGB = selected && elapsedMs >= 7 * 1000 / 30
    ? [243, 164, 64]
    : [Math.round(raw[1]), Math.round(raw[2]), Math.round(raw[3])];
  return Object.freeze<PollPose>({
    selected, widthProgress, rowWidth, rowHeight: BASE.rowHeight * scale,
    radius: BASE.rowHeight * scale / 2,
    labelInset: BASE.labelInset * scale,
    indicatorCenterFromLeft: rowWidth - BASE.indicatorEndInset * scale,
    ringDiameter: BASE.ringDiameter * scale,
    ringStroke: BASE.ringStroke * scale,
    ringOpacity: indicator[2],
    avatarDiameter: BASE.avatarDiameter * scale,
    avatarOpacity: indicator[0], avatarScale: indicator[1], fill,
    label: selected ? [255, 250, 243] : [246, 155, 52],
  });
}

/** Convenience for the recording fixture. For real authored flows use event-relative elapsedMs. */
export function sampleRecordingVote(timeMs: number, scale = 1, mode: Interpolation = "linear"): PollPose {
  if (!Number.isFinite(timeMs)) throw new TypeError("timeMs must be finite");
  return samplePollVote(timeMs - SOURCE_ONSET_MS, scale, mode);
}

// Separate transcript motion; NEVER add it to a reusable poll's intrinsic animation.
const SCROLL: readonly (readonly number[])[] = [
  [
    0,
    0
  ],
  [
    3133.3333333333335,
    0
  ],
  [
    3166.666667,
    43
  ],
  [
    3200.0,
    80
  ],
  [
    3233.333333,
    114
  ],
  [
    3266.666667,
    144
  ],
  [
    3300.0,
    173
  ],
  [
    3333.333333,
    200
  ],
  [
    3366.666667,
    224
  ],
  [
    3400.0,
    243
  ],
  [
    3433.333333,
    267
  ],
  [
    3466.666667,
    286
  ]
];
export function sampleRecordingTranscriptOffset(timeMs: number, scale = 1, mode: Interpolation = "linear"): number {
  if (!Number.isFinite(timeMs) || !Number.isFinite(scale) || scale <= 0) throw new RangeError("invalid time or scale");
  if (mode !== "linear" && mode !== "hold") throw new TypeError("unknown interpolation mode");
  return vectorAt(SCROLL, timeMs, mode)[0] * scale;
}
