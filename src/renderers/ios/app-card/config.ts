import { exactOrigin } from "@/renderers/ios/apple-pay/bridge";

/**
 * Which checkout origins the renderer may embed. This is trusted renderer configuration, never a flow
 * or query value: `VITE_PHOTON_CHECKOUT_ORIGINS` is a comma-separated list of exact origins, read when
 * the dev/preview server starts, e.g. `VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:3100`.
 * A flow's app card URL must have one of these origins; the bridge then accepts messages from that
 * origin only.
 */
export const CHECKOUT_ORIGINS_ENV = "VITE_PHOTON_CHECKOUT_ORIGINS";

export function parseCheckoutOrigins(value: string | undefined): { origins: string[]; rejected: string[] } {
  const origins: string[] = [];
  const rejected: string[] = [];
  for (const entry of (value ?? "").split(",")) {
    const origin = entry.trim();
    if (!origin) continue;
    try {
      exactOrigin(origin);
      if (!origins.includes(origin)) origins.push(origin);
    } catch {
      rejected.push(origin);
    }
  }
  return { origins, rejected };
}

let configured: readonly string[] | null = null;

export function configuredCheckoutOrigins(): readonly string[] {
  if (configured) return configured;
  const parsed = parseCheckoutOrigins(import.meta.env.VITE_PHOTON_CHECKOUT_ORIGINS as string | undefined);
  if (parsed.rejected.length > 0) console.error(`${CHECKOUT_ORIGINS_ENV}: ignoring non-origin entries ${parsed.rejected.join(", ")}`);
  configured = Object.freeze(parsed.origins);
  return configured;
}

export type CheckoutEmbed =
  | { ok: true; src: string; origin: string }
  | { ok: false; reason: "invalid-url" | "origin-not-allowed" | "parent-origin-unavailable"; origin?: string };

/**
 * The iframe URL for an app card, or why it cannot be embedded. The renderer appends
 * `presentation=visual` and `parentOrigin=<this page's exact origin>` itself; the checkout honors that
 * parent only if it is on the checkout's own allowlist.
 */
export function resolveCheckoutEmbed(url: string, allowed: readonly string[], parentOrigin: string): CheckoutEmbed {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if ((target.protocol !== "http:" && target.protocol !== "https:") || target.username || target.password) {
    return { ok: false, reason: "invalid-url" };
  }
  if (!allowed.includes(target.origin)) return { ok: false, reason: "origin-not-allowed", origin: target.origin };
  try {
    exactOrigin(parentOrigin);
  } catch {
    return { ok: false, reason: "parent-origin-unavailable", origin: target.origin };
  }
  target.searchParams.set("presentation", "visual");
  target.searchParams.set("parentOrigin", parentOrigin);
  return { ok: true, src: target.href, origin: target.origin };
}
