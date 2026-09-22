import type { CompiledDemo, DemoMessage, RenderFrame } from "@/contracts";
import { isEmojiOnly } from "@/components/imessage/message-bubble";
import { bubbleEffectDuration, type BubbleEffectKind } from "@/components/imessage/message-effects";
import { messageMotion } from "@/components/imessage/message-motion";
import { typingLoopMs, typingStaggerMs } from "@/components/imessage/typing-indicator";

export type ArrivalPose = { id: string; progress: number };

export type BubblePose = {
  id: string;
  kind: Exclude<BubbleEffectKind, "invisible-ink">;
  progress: number;
};

export type CueState = {
  send?: ArrivalPose;
  receive?: ArrivalPose;
  bubbleEffect: BubblePose | null;
  typingElapsed: number | null;
  inkElapsed: Array<{ id: string; elapsed: number }>;
};

function messageEvents(compiled: CompiledDemo, timeMs: number) {
  return compiled.events
    .map((event, index) => ({ event, index }))
    .filter((entry) => entry.event.type === "message" && entry.event.atMs <= timeMs)
    .sort((a, b) => a.event.atMs - b.event.atMs || a.index - b.index)
    .map((entry) => entry.event)
    .filter((event): event is Extract<CompiledDemo["events"][number], { type: "message" }> => event.type === "message");
}

/** Text and emoji arrivals are the motions `useArrivalAnimation` can seek. Other kinds have no bubble flight. */
export function supportsArrival(message: DemoMessage): boolean {
  if (message.kind === "link" || message.kind === "image" || message.kind === "audio" || message.kind === "attachment") return false;
  return message.kind === undefined || message.kind === "text" || isEmojiOnly(message.text);
}

/**
 * Explicit arrival and effect progress from playback time.
 * At the duration endpoint the cue is omitted so the source handle is canceled and its ghost, clone, and lift are removed.
 */
export function deriveCues(compiled: CompiledDemo, frame: RenderFrame): CueState {
  const visible = new Set(frame.messages.map((message) => message.id));
  const events = messageEvents(compiled, frame.timeMs).filter((event) => visible.has(event.message.id));
  let send: ArrivalPose | undefined;
  let receive: ArrivalPose | undefined;
  const latest = events[events.length - 1];
  if (latest && supportsArrival(latest.message) && !latest.message.effect) {
    const duration = latest.message.direction === "outgoing" ? messageMotion.send.duration : messageMotion.receive.duration;
    const elapsed = frame.timeMs - latest.atMs;
    if (elapsed > 0 && elapsed < duration) {
      const pose = { id: latest.message.id, progress: elapsed / duration };
      if (latest.message.direction === "outgoing") send = pose;
      else receive = pose;
    }
  }

  let bubbleEffect: BubblePose | null = null;
  const inkElapsed: Array<{ id: string; elapsed: number }> = [];
  for (const event of events) {
    const effect = event.message.effect;
    if (!effect) continue;
    const elapsed = frame.timeMs - event.atMs;
    if (elapsed < 0) continue;
    if (effect === "invisible-ink") {
      inkElapsed.push({ id: event.message.id, elapsed });
      continue;
    }
    const duration = bubbleEffectDuration[effect];
    if (duration > 0 && elapsed < duration) {
      bubbleEffect = { id: event.message.id, kind: effect, progress: elapsed / duration };
    }
  }

  let typingElapsed: number | null = null;
  if (frame.typing) {
    let startedAt: number | null = null;
    for (const event of compiled.events) {
      if (event.type !== "typing" || event.atMs > frame.timeMs) continue;
      startedAt = event.typing ? (startedAt ?? event.atMs) : null;
    }
    typingElapsed = frame.timeMs - (startedAt ?? 0);
  }

  return { send, receive, bubbleEffect, typingElapsed, inkElapsed };
}

export function cueToken(cues: CueState): string {
  return JSON.stringify(cues);
}

/** Freeze the source typing loop at a cue-relative offset. The delay constants are the pin's own. */
export function typingFreezeDelay(index: number, elapsed: number): string {
  return `${index * typingStaggerMs - typingLoopMs - elapsed}ms`;
}
