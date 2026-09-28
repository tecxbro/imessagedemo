import "./sunday-tip.css";
import applePayMark from "@/renderers/ios/apple-pay/assets/apple-pay-lockup.png";
import { formatMoney, fromCheckoutSpec } from "@/renderers/ios/apple-pay/checkout";
import { connectVisualCheckout } from "./visual-checkout";
import { sundayTipSpec } from "./sunday-tip-spec";

// Exact local preview/test parents. Never accept a query-provided origin without this check.
const allowedParents = new Set([
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
]);
const button = document.querySelector<HTMLButtonElement>("#applepay")!;
const status = document.querySelector<HTMLElement>("#status")!;
const checkout = fromCheckoutSpec(sundayTipSpec, location.hostname);
const money = formatMoney(checkout);
document.querySelector("#title")!.textContent = sundayTipSpec.item.title;
document.querySelector("#subtitle")!.textContent = sundayTipSpec.item.subtitle;
document.querySelector("#price")!.textContent = money;
document.querySelector<HTMLImageElement>("#apple-pay-mark")!.src = applePayMark;
button.setAttribute("aria-label", "Apple Pay");

connectVisualCheckout({ button, status, checkout, allowedParents });
