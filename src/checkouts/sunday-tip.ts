import "./sunday-tip.css";
import applePayMark from "@/renderers/ios/apple-pay/assets/apple-pay-lockup.png";
import { formatMoney, fromCheckoutSpec } from "@/renderers/ios/apple-pay/checkout";
import { sundayTipSpec } from "./sunday-tip-spec";

// Exact local preview/test parents. Never accept a query-provided origin without this check.
const allowedParents = new Set([
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
]);
const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>("#applepay")!;
const status = document.querySelector<HTMLElement>("#status")!;
const checkout = fromCheckoutSpec(sundayTipSpec, location.hostname);
const money = formatMoney(checkout);
document.querySelector("#title")!.textContent = sundayTipSpec.item.title;
document.querySelector("#subtitle")!.textContent = sundayTipSpec.item.subtitle;
document.querySelector("#price")!.textContent = money;
document.querySelector<HTMLImageElement>("#apple-pay-mark")!.src = applePayMark;
button.setAttribute("aria-label", `Tip ${money} with Apple Pay`);

const params = new URLSearchParams(location.search);
const parentOrigin = params.get("parentOrigin");
let pendingId: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

function state(value: string, message = "") {
  root.dataset.photonPayState = value;
  status.textContent = message;
  button.disabled = value === "requesting" || value === "opened" || value === "unavailable";
}

if (window.parent === window || params.get("presentation") !== "visual" || !parentOrigin || !allowedParents.has(parentOrigin)) {
  state("unavailable", "Open this tip from the Sunday conversation.");
} else {
  state("ready");
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window.parent || event.origin !== parentOrigin) return;
    const result = event.data;
    if (!result || result.type !== "photon-pay:result" || result.version !== 1 || !pendingId || result.requestId !== pendingId) return;
    if (!["opened", "cancelled", "busy", "invalid"].includes(result.state)) return;
    clearTimeout(timer);
    if (result.state === "opened") {
      state("opened");
    } else {
      pendingId = null;
      state(result.state === "cancelled" ? "cancelled" : "error", result.state === "cancelled" ? "" : "Couldn't open Apple Pay. Try again.");
    }
  });
  button.addEventListener("click", () => {
    if (button.disabled || pendingId) return;
    pendingId = crypto.randomUUID();
    state("requesting");
    window.parent.postMessage({ type: "photon-pay:open", version: 1, requestId: pendingId, checkout }, parentOrigin);
    timer = setTimeout(() => {
      pendingId = null;
      state("error", "Apple Pay isn't available. Try again.");
    }, 6000);
  });
}
