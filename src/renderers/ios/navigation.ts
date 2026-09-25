import type { IosScreenName } from "@/contracts";
import type { ScreenTransitionKind, VisualFrame } from "@/runtime";

export type NavigationModel = {
  screen: IosScreenName;
  /** Active push/pop/present/dismiss while the transition cue is in flight; null when settled. */
  transition: ScreenTransitionKind | null;
  progress: number | null;
  from?: IosScreenName;
  to?: IosScreenName;
};

/**
 * Timeline-driven iOS shell navigation. Uses the runtime `screen` cue and
 * `screenTransitionKind` mapping already applied in `frameAt`.
 */
export function navigationModel(frame: VisualFrame): NavigationModel {
  const cue = [...frame.cues].reverse().find((entry) => entry.kind === "screen");
  const model: NavigationModel = {
    screen: frame.screen,
    transition: cue?.transition ?? null,
    progress: cue?.progress ?? null,
  };
  if (cue?.detail?.fromScreen !== undefined) model.from = cue.detail.fromScreen;
  if (cue?.detail?.toScreen !== undefined) model.to = cue.detail.toScreen;
  return model;
}

/** Props for `IosMessagesApp` `screenTransition`; null when settled on `screen`. */
export function screenTransitionShellProps(frame: VisualFrame): { from: IosScreenName; progress: number } | null {
  const model = navigationModel(frame);
  if (model.transition === null || model.progress === null || model.from === undefined) return null;
  return { from: model.from, progress: model.progress };
}

export type ComposerModel = {
  typing: boolean;
  draft: string;
  /** Outgoing arrival cue while in flight; null when settled or absent. */
  send: { id: string; progress: number } | null;
  /** Incoming arrival cue while in flight; null when settled or absent. */
  receive: { id: string; progress: number } | null;
};

/**
 * Composer + arrival timing from the runtime frame.
 * Typing and draft are logical state; send/receive come from active cues — never a fake typing message.
 */
export function composerModel(frame: VisualFrame): ComposerModel {
  const sendCue = [...frame.cues].reverse().find((cue) => cue.kind === "send");
  const receiveCue = [...frame.cues].reverse().find((cue) => cue.kind === "receive");
  return {
    typing: frame.typing,
    draft: frame.draft,
    send: sendCue?.subjectId !== undefined ? { id: sendCue.subjectId, progress: sendCue.progress } : null,
    receive: receiveCue?.subjectId !== undefined ? { id: receiveCue.subjectId, progress: receiveCue.progress } : null,
  };
}
