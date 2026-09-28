import type { ValidCheckoutRequest } from "@/renderers/ios/apple-pay/checkout";

/** Shared visual-only checkout client. The host may request one automatic presentation. */
export function connectVisualCheckout({ button, status, checkout, allowedParents }: {
  button: HTMLButtonElement;
  status: HTMLElement;
  checkout: ValidCheckoutRequest;
  allowedParents: ReadonlySet<string>;
}) {
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const parentOrigin = params.get("parentOrigin");
  let pendingId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let automaticRequested = false;
  function state(value: string, message = "") {
    root.dataset.photonPayState = value;
    status.textContent = message;
    button.disabled = ["requesting", "opened", "unavailable"].includes(value);
  }
  function open() {
    if (button.disabled || pendingId || !parentOrigin) return;
    pendingId = crypto.randomUUID();
    state("requesting");
    window.parent.postMessage({ type: "photon-pay:open", version: 1, requestId: pendingId, checkout }, parentOrigin);
    timer = setTimeout(() => {
      pendingId = null;
      state("error", "Apple Pay isn't available. Try again.");
    }, 6000);
  }
  if (window.parent === window || params.get("presentation") !== "visual" || !parentOrigin || !allowedParents.has(parentOrigin)) {
    state("unavailable", "Open this checkout from the conversation.");
    return;
  }
  state("ready");
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const result = event.data;
    if (!result || result.version !== 1) return;
    if (result.type === "photon-pay:present") {
      if (!automaticRequested) { automaticRequested = true; open(); }
      return;
    }
    if (result.type !== "photon-pay:result" || !pendingId || result.requestId !== pendingId) return;
    if (!["opened", "cancelled", "busy", "invalid"].includes(result.state)) return;
    clearTimeout(timer);
    if (result.state === "opened") state("opened");
    else {
      pendingId = null;
      state(result.state === "cancelled" ? "cancelled" : "error", result.state === "cancelled" ? "" : "Couldn't open Apple Pay. Try again.");
    }
  });
  button.addEventListener("click", open);
}
