import type { ReadyReceipt } from "@/player/types";

export function isAllowedCaptureUrl(url: string, origin: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("about:")) return true;
  let parsed: URL;
  let allowed: URL;
  try {
    parsed = new URL(url);
    allowed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol === "ws:" || parsed.protocol === "wss:") {
    return parsed.hostname === allowed.hostname && parsed.port === allowed.port;
  }
  return parsed.origin === allowed.origin;
}

export function assertReceipt(receipt: ReadyReceipt, expected: { revision: number; timeMs?: number; theme?: string; platform?: string }): void {
  if (receipt.revision !== expected.revision) {
    throw new Error(`Ready receipt revision ${receipt.revision} != ${expected.revision}`);
  }
  if (expected.timeMs !== undefined && receipt.timeMs !== expected.timeMs) {
    throw new Error(`Ready receipt timeMs ${receipt.timeMs} != ${expected.timeMs}`);
  }
  if (expected.theme && receipt.theme !== expected.theme) {
    throw new Error(`Ready receipt theme ${receipt.theme} != ${expected.theme}`);
  }
  if (expected.platform && receipt.platform !== expected.platform) {
    throw new Error(`Ready receipt platform ${receipt.platform} != ${expected.platform}`);
  }
  if (!receipt.digest) throw new Error("Ready receipt is missing a digest");
  if (!receipt.renderer) throw new Error("Ready receipt is missing the renderer receipt");
}
