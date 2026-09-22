import type { DemoMessage } from "@/contracts";
import motionTokens from "@/contracts/motion-tokens.json";

type Token = { symbol: string; value: unknown };

function tokenValue(symbol: string): Record<string, unknown> {
  const found = (motionTokens.tokens as Token[]).find((entry) => entry.symbol === symbol);
  if (!found || typeof found.value !== "object" || found.value === null) {
    throw new Error(`missing motion token ${symbol}`);
  }
  return found.value as Record<string, unknown>;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`motion token ${label} is not a finite number`);
  }
  return value;
}

const messageMotion = tokenValue("messageMotion");
const send = messageMotion.send;
const receive = messageMotion.receive;
if (typeof send !== "object" || send === null || typeof receive !== "object" || receive === null) {
  throw new Error("motion token messageMotion is missing send or receive");
}

export const sendDurationMs = readNumber((send as { duration?: unknown }).duration, "messageMotion.send.duration");
export const receiveDurationMs = readNumber(
  (receive as { duration?: unknown }).duration,
  "messageMotion.receive.duration",
);

const bubble = tokenValue("bubbleEffectDuration");

export const bubbleEffectDurationMs = {
  slam: readNumber(bubble.slam, "bubbleEffectDuration.slam"),
  loud: readNumber(bubble.loud, "bubbleEffectDuration.loud"),
  gentle: readNumber(bubble.gentle, "bubbleEffectDuration.gentle"),
  "invisible-ink": readNumber(bubble["invisible-ink"], "bubbleEffectDuration.invisible-ink"),
} as const;

export type BubbleEffect = keyof typeof bubbleEffectDurationMs;

export type ArrivalWindow = {
  start: number;
  end: number;
  label: string;
  durationMs: number;
};

/**
 * Shell arrival occupancy for one authored message.
 * Text uses the send or receive flight. A bubble effect replaces that flight
 * so the two transforms are not stacked. Images and other media do not take
 * the arrival channel. Invisible ink has no motion of its own.
 */
export function arrivalWindow(message: Pick<DemoMessage, "atMs" | "direction" | "effect" | "kind">): ArrivalWindow | null {
  const kind = message.kind ?? "text";
  if (kind !== "text") return null;
  if (message.effect === "invisible-ink") return null;
  if (message.effect === "slam" || message.effect === "loud" || message.effect === "gentle") {
    if (message.direction !== "outgoing") return null;
    const durationMs = bubbleEffectDurationMs[message.effect];
    return {
      start: message.atMs,
      end: message.atMs + durationMs,
      durationMs,
      label: `${message.effect} effect`,
    };
  }
  const durationMs = message.direction === "outgoing" ? sendDurationMs : receiveDurationMs;
  return {
    start: message.atMs,
    end: message.atMs + durationMs,
    durationMs,
    label: message.direction === "outgoing" ? "send flight" : "receive flight",
  };
}
