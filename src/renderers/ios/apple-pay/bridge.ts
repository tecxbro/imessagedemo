import { validateRequest, type ValidCheckoutRequest } from "./checkout";

/**
 * Parent side of the recreation package's versioned iframe bridge (`implementation/bridge/bridge.js`).
 *
 *   child  → parent  { type: "photon-pay:open",   version: 1, requestId, checkout }
 *   parent → child   { type: "photon-pay:result", version: 1, requestId, state }
 *
 * A message counts only when `event.source` is a registered checkout iframe's `contentWindow` and
 * `event.origin` is exactly that iframe's expected origin. The payload is validated before any state
 * changes. A request ID answers once: repeats get the recorded state back and never reopen the sheet.
 * While a sheet is showing, other requests get `busy`. Closing the sheet answers `cancelled`, which
 * is how the checkout knows to reset its button.
 */
export const PHOTON_PAY_PROTOCOL = 1;
export const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{8,100}$/;

export type BridgeResultState = "opened" | "busy" | "invalid" | "cancelled";

export type BridgeResultMessage = {
  type: "photon-pay:result";
  version: typeof PHOTON_PAY_PROTOCOL;
  requestId: string;
  state: BridgeResultState;
};

export type BridgeFrame = {
  id: string;
  /** Exact origin the iframe was embedded from. */
  origin: string;
  window(): Window | null;
};

export type BridgeMessageEvent = Pick<MessageEvent, "origin" | "source" | "data">;

export type BridgeDecision =
  | { kind: "ignored"; reason: "unknown-source" | "wrong-origin" | "malformed" }
  | { kind: BridgeResultState | "duplicate" | "withdrawn"; frameId: string; requestId: string };

export type CheckoutBridgeOptions = {
  /** Open the presentation. Return false if it could not open (another sheet is showing). */
  present(request: ValidCheckoutRequest, frame: BridgeFrame): boolean;
  /** Whether any presentation currently owns the phone. */
  isBusy(): boolean;
  onDecision?(decision: BridgeDecision): void;
  /** The iframe that owns the open presentation left the thread. Its window is gone, so nothing is posted. */
  onActiveFrameRemoved?(frame: BridgeFrame): void;
};

export type CheckoutBridge = {
  register(frame: BridgeFrame): () => void;
  handleMessage(event: BridgeMessageEvent): BridgeDecision;
  /** The presentation closed; answer the request that opened it. */
  closed(): void;
  active(): { frameId: string; requestId: string } | null;
  dispose(): void;
};

const SEEN_LIMIT = 100;

/** An exact, non-opaque http(s) origin with no path or trailing slash. */
export function exactOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`Not an origin: ${value}`);
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== value || value === "null") {
    throw new TypeError("Use an exact non-opaque http(s) origin, with no trailing slash.");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createCheckoutBridge(options: CheckoutBridgeOptions): CheckoutBridge {
  const frames = new Map<string, BridgeFrame>();
  const seen = new Map<string, BridgeResultState>();
  let active: { frame: BridgeFrame; requestId: string } | null = null;

  const reply = (frame: BridgeFrame, requestId: string, state: BridgeResultState) => {
    const message: BridgeResultMessage = { type: "photon-pay:result", version: PHOTON_PAY_PROTOCOL, requestId, state };
    frame.window()?.postMessage(message, frame.origin);
  };

  const decide = (decision: BridgeDecision): BridgeDecision => {
    options.onDecision?.(decision);
    return decision;
  };

  const remember = (key: string, state: BridgeResultState) => {
    seen.delete(key);
    seen.set(key, state);
    if (seen.size > SEEN_LIMIT) seen.delete(seen.keys().next().value as string);
  };

  return {
    register(frame) {
      exactOrigin(frame.origin);
      frames.set(frame.id, frame);
      return () => {
        if (frames.get(frame.id) === frame) frames.delete(frame.id);
        if (active?.frame !== frame) return;
        const { requestId } = active;
        active = null;
        remember(`${frame.id}\n${requestId}`, "cancelled");
        options.onDecision?.({ kind: "withdrawn", frameId: frame.id, requestId });
        options.onActiveFrameRemoved?.(frame);
      };
    },
    handleMessage(event) {
      const source = event.source;
      let frame: BridgeFrame | undefined;
      if (source) {
        for (const candidate of frames.values()) {
          if (candidate.window() === source) {
            frame = candidate;
            break;
          }
        }
      }
      if (!frame) return decide({ kind: "ignored", reason: "unknown-source" });
      if (event.origin !== frame.origin) return decide({ kind: "ignored", reason: "wrong-origin" });
      const data = event.data;
      if (
        !isRecord(data) ||
        data.type !== "photon-pay:open" ||
        data.version !== PHOTON_PAY_PROTOCOL ||
        typeof data.requestId !== "string" ||
        !REQUEST_ID_PATTERN.test(data.requestId)
      ) {
        return decide({ kind: "ignored", reason: "malformed" });
      }
      const requestId = data.requestId;
      const key = `${frame.id}\n${requestId}`;
      const previous = seen.get(key);
      if (previous) {
        reply(frame, requestId, previous);
        return decide({ kind: "duplicate", frameId: frame.id, requestId });
      }
      if (active || options.isBusy()) {
        reply(frame, requestId, "busy");
        return decide({ kind: "busy", frameId: frame.id, requestId });
      }
      let request: ValidCheckoutRequest;
      try {
        request = validateRequest(data.checkout);
      } catch {
        reply(frame, requestId, "invalid");
        return decide({ kind: "invalid", frameId: frame.id, requestId });
      }
      if (!options.present(request, frame)) {
        reply(frame, requestId, "busy");
        return decide({ kind: "busy", frameId: frame.id, requestId });
      }
      active = { frame, requestId };
      remember(key, "opened");
      reply(frame, requestId, "opened");
      return decide({ kind: "opened", frameId: frame.id, requestId });
    },
    closed() {
      if (!active) return;
      const { frame, requestId } = active;
      active = null;
      remember(`${frame.id}\n${requestId}`, "cancelled");
      reply(frame, requestId, "cancelled");
      options.onDecision?.({ kind: "cancelled", frameId: frame.id, requestId });
    },
    active() {
      return active ? { frameId: active.frame.id, requestId: active.requestId } : null;
    },
    dispose() {
      frames.clear();
      seen.clear();
      active = null;
    },
  };
}
