import bofaCard from "./assets/bofa-5334.png";
import rhoStrip from "./assets/rho-left-visible.png";
import otherStrip from "./assets/other-right-visible.png";
import applePayLockup from "./assets/apple-pay-lockup.png";
import paymentIcon from "./assets/payment-icon.png";

/**
 * Wallet fixture shown by the presentation. Card artwork and last-four digits are the same for every
 * checkout; only the checkout values change. Only the red card is fully visible in the recording. The
 * other two are the partial strips visible behind it; their hidden faces are not recovered or invented.
 */
export type PaymentCard = {
  id: "bofa" | "rho" | "other";
  label: string;
  lastFour: string | null;
  asset: string;
  partial: boolean;
};

export const paymentCards: readonly PaymentCard[] = Object.freeze([
  Object.freeze({ id: "bofa", label: "Bank of America Visa Debit Card", lastFour: "5334", asset: bofaCard, partial: false }),
  Object.freeze({ id: "rho", label: "Rho", lastFour: "0987", asset: rhoStrip, partial: true }),
  Object.freeze({ id: "other", label: "Other card", lastFour: null, asset: otherStrip, partial: true }),
] as const);

export type PaymentCardId = PaymentCard["id"];

export const defaultCardId: PaymentCardId = "bofa";

export function cardById(id: string): PaymentCard | undefined {
  return paymentCards.find((card) => card.id === id);
}

export const presentationAssets = {
  lockup: applePayLockup,
  paymentIcon,
  leftStrip: rhoStrip,
  rightStrip: otherStrip,
} as const;
