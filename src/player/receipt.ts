import type { RenderFrame } from "@/contracts";
import type { ReadyReceipt, RendererReceipt } from "@/player/types";

export function canonicalFrame(frame: RenderFrame): string {
  return JSON.stringify(sortValue(frame));
}

export async function frameDigest(frame: RenderFrame): Promise<string> {
  return sha256Hex(canonicalFrame(frame));
}

export async function sha256Hex(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildReadyReceipt(args: {
  revision: number;
  frame: RenderFrame;
  renderer: RendererReceipt;
}): Promise<ReadyReceipt> {
  return {
    revision: args.revision,
    timeMs: args.frame.timeMs,
    platform: args.frame.platform,
    theme: args.frame.theme,
    digest: await frameDigest(args.frame),
    renderer: args.renderer,
  };
}

export function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}
