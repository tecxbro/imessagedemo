import motionTokens from "@/contracts/motion-tokens.json";
import { tapbackMotion } from "@/contracts/tapback-motion";
import type { BubbleEffectName, IosScreenName, ScreenEffectName } from "@/contracts";
import type { ScreenTransitionKind } from "@/runtime/types";

type MessageMotionValue = {
  reaction: number;
  send: { duration: number };
  receive: { duration: number };
  reduced: { duration: number };
};

type IosScreenTransitionValue = Record<ScreenTransitionKind, number>;

type MacTransitionValue = {
  conversation: { duration: number };
  selection: { duration: number; text: number };
  menu: { open: number };
};

function tokenValue(symbol: string): unknown {
  const found = motionTokens.tokens.find((item) => item.symbol === symbol);
  if (!found) throw new Error(`Missing motion token ${symbol}`);
  return found.value;
}

export function messageMotion(): MessageMotionValue {
  return tokenValue("messageMotion") as MessageMotionValue;
}

export function iosScreenTransition(): IosScreenTransitionValue {
  return tokenValue("iosScreenTransition") as IosScreenTransitionValue;
}

export function macTransitions(): MacTransitionValue {
  return tokenValue("macTransitions") as MacTransitionValue;
}

export function bubbleEffectDuration(effect: BubbleEffectName): number {
  return (tokenValue("bubbleEffectDuration") as Record<BubbleEffectName, number>)[effect];
}

export function screenEffectDuration(effect: ScreenEffectName): number {
  return (tokenValue("screenEffectDuration") as Record<ScreenEffectName, number>)[effect];
}

/**
 * Exit and overlay timings present as literals in the pin but absent from motion-tokens.json.
 * context-menu.tsx dismissal is 120. macos-plus-menu.tsx motion is enter 160 / exit 120.
 * message-reply.tsx replyThreadMotion is enter 260 / exit 200.
 * Long-press enter/exit come from tapback-motion.ts (fitted entrance and dismissal).
 * ios-effects-picker.tsx timing is enter 260 / exit 200.
 * image-viewer.tsx timing.zoom is 300.
 */
export const pendingCueDurations = {
  contextMenuExit: 120,
  plusMenuEnter: 160,
  plusMenuExit: 120,
  threadEnter: 260,
  threadExit: 200,
  longPressEnter: tapbackMotion.entranceMs,
  longPressExit: tapbackMotion.exitMs,
  effectsPickerEnter: 260,
  effectsPickerExit: 200,
  imageViewer: 300,
  detailsEnter: 260,
  detailsExit: 200,
  photoPickerEnter: 260,
  photoPickerExit: 200,
  selectionEnter: 220,
  selectionExit: 180,
} as const;

/** Active cue progress. Duration 0 never divides and never stays active. */
export function cueProgress(elapsedMs: number, durationMs: number): number | null {
  if (!(durationMs > 0) || !Number.isFinite(durationMs) || !Number.isFinite(elapsedMs)) return null;
  if (elapsedMs < 0 || elapsedMs >= durationMs) return null;
  return elapsedMs / durationMs;
}

export function screenTransitionKind(from: IosScreenName, to: IosScreenName): ScreenTransitionKind | null {
  if (from === to) return null;
  if (to === "new-message") return "present";
  if (from === "new-message" && to === "list") return "dismiss";
  return to === "conversation" ? "push" : "pop";
}

export function screenTransitionDuration(kind: ScreenTransitionKind): number {
  return iosScreenTransition()[kind];
}
