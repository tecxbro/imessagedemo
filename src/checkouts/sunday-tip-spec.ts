import type { CheckoutSpecLike } from "@/renderers/ios/apple-pay/checkout";

/** Local, no-charge concept data. Amount is read by both the card and the parent sheet. */
export const sundayTipSpec = {
  metadata: { applePayLabel: "Sunday — Tip for Memo" },
  item: {
    title: "Tip for Memo",
    subtitle: "One-time tip · A job well done",
    applePayAmount: "5.00",
    applePayCurrencyCode: "USD",
    applePayCountryCode: "US",
  },
} satisfies CheckoutSpecLike & { item: { title: string; subtitle: string } };
