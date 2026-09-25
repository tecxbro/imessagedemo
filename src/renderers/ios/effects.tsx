import type { ScreenEffectName } from "@/contracts";
import type { EffectsPickerSelection } from "@/components/imessage/ios-effects-picker";
import { screenEffects, type BubbleEffectKind, type ScreenEffectKind } from "@/components/imessage/message-effects";
import type { OverlayState, VisualFrame } from "@/runtime";

/** Canonical screen-effect names from the contract / pin catalogue. */
export const SCREEN_EFFECT_NAMES: readonly ScreenEffectName[] = screenEffects.map((entry) => entry.kind);

export type ActiveScreenEffect = {
  effect: ScreenEffectName;
  progress: number;
  messageId?: string;
};

/**
 * Active full-screen effect from the runtime frame, or null when settled.
 * Runtime emits a `screen-effect` cue while `0 <= progress < 1` and drops it at the duration endpoint.
 */
export function activeScreenEffect(frame: VisualFrame): ActiveScreenEffect | null {
  const cue = [...frame.cues].reverse().find((entry) => entry.kind === "screen-effect");
  if (!cue) return null;
  const effect = cue.detail?.effect;
  if (!effect || !isScreenEffectName(effect)) return null;
  const active: ActiveScreenEffect = { effect, progress: cue.progress };
  if (cue.subjectId !== undefined) active.messageId = cue.subjectId;
  return active;
}

export type EffectsPickerModel = {
  open: boolean;
  tab: "bubble" | "screen";
  draft: string;
  effect?: string;
  selection: EffectsPickerSelection;
  /** Overlay-enter (or exit) cue progress while the transition is in flight; null when settled. */
  progress: number | null;
};

const closedPicker: EffectsPickerModel = {
  open: false,
  tab: "bubble",
  draft: "",
  selection: null,
  progress: null,
};

/**
 * Effects-picker overlay model. Bubble vs Screen tab, draft, selected effect, and enter progress
 * come from the runtime overlay plus `overlay-enter` / `overlay-exit` cues.
 */
export function effectsPickerModel(frame: VisualFrame): EffectsPickerModel {
  if (frame.overlay.kind === "effects-picker") {
    const enter = frame.cues.find((cue) => cue.kind === "overlay-enter" && cue.detail?.overlay?.kind === "effects-picker");
    return modelFromOverlay(frame.overlay, true, enter?.progress ?? null);
  }

  const exit = frame.cues.find((cue) => cue.kind === "overlay-exit" && cue.detail?.overlay?.kind === "effects-picker");
  const closing = exit?.detail?.overlay;
  if (closing && closing.kind === "effects-picker") {
    return modelFromOverlay(closing, false, exit?.progress ?? null);
  }

  return closedPicker;
}

/** Props for `IosMessagesApp` `effectsPicker` from a visual frame; null when closed and settled. */
export function effectsPickerShellProps(frame: VisualFrame): {
  tab: "bubble" | "screen";
  selection: EffectsPickerSelection;
  draft: string;
  progress?: number;
} | null {
  const model = effectsPickerModel(frame);
  if (!model.open && model.progress === null) return null;
  const props: {
    tab: "bubble" | "screen";
    selection: EffectsPickerSelection;
    draft: string;
    progress?: number;
  } = {
    tab: model.tab,
    selection: model.selection,
    draft: model.draft,
  };
  if (model.progress !== null) props.progress = model.progress;
  return props;
}

/** Props for pinned `ScreenEffect`, or null when settled. */
export function screenEffectOverlayProps(frame: VisualFrame): { kind: ScreenEffectKind; progress: number } | null {
  const active = activeScreenEffect(frame);
  if (!active) return null;
  return { kind: active.effect, progress: active.progress };
}

function modelFromOverlay(
  overlay: Extract<OverlayState, { kind: "effects-picker" }>,
  open: boolean,
  progress: number | null,
): EffectsPickerModel {
  const model: EffectsPickerModel = {
    open,
    tab: overlay.tab,
    draft: overlay.draft,
    selection: selectionFromOverlay(overlay),
    progress,
  };
  if (overlay.effect !== undefined) model.effect = overlay.effect;
  return model;
}

function selectionFromOverlay(overlay: Extract<OverlayState, { kind: "effects-picker" }>): EffectsPickerSelection {
  if (!overlay.effect) return null;
  if (overlay.tab === "bubble") return { bubble: overlay.effect as BubbleEffectKind };
  return { screen: overlay.effect as ScreenEffectKind };
}

function isScreenEffectName(value: string): value is ScreenEffectName {
  return (SCREEN_EFFECT_NAMES as readonly string[]).includes(value);
}
