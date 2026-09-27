export const playbackBarHeightPx = 44;

export type PlaybackControlLabel = "Play" | "Pause" | "Resume" | "Replay";

export type PlaybackSnapshot = {
  timeMs: number;
  playing: boolean;
  durationMs: number;
};

export type PlaybackTransport = {
  play(): Promise<void> | void;
  pause(): Promise<void> | void;
  reset(): Promise<unknown> | unknown;
};

/** Label for the single viewer control. Time zero is Play; a paused later time is Resume. */
export function playbackControlLabel(state: PlaybackSnapshot): PlaybackControlLabel {
  if (state.playing) return "Pause";
  if (state.durationMs > 0 && state.timeMs >= state.durationMs) return "Replay";
  if (state.timeMs > 0) return "Resume";
  return "Play";
}

/**
 * One click on the viewer control.
 * Replay resets to the authored opening and starts again. Playback does not loop.
 */
export async function runPlaybackControl(state: PlaybackSnapshot, transport: PlaybackTransport): Promise<void> {
  if (state.playing) {
    await transport.pause();
    return;
  }
  if (state.durationMs > 0 && state.timeMs >= state.durationMs) {
    await transport.reset();
    await transport.play();
    return;
  }
  await transport.play();
}
