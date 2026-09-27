/**
 * The checkout values the presentation shows. They arrive from the checkout mini app (built there
 * from its `CheckoutSpec` with `fromCheckoutSpec`) and are validated here again before anything is
 * drawn. A port of the recreation package's `validateRequest`/`formatMoney`/`fromCheckoutSpec`.
 *
 * The exact decimal `amount` string is authoritative. Nothing parses a display price, and totals are
 * never built with floating-point arithmetic; `Number` is used only to hand the validated string to
 * `Intl.NumberFormat`, inside a bound that keeps every allowed minor unit exact.
 */
export type CheckoutRequest = {
  merchantLabel: string;
  amount: string;
  currency: string;
  country?: string;
  domain: string;
  locale?: string;
};

export type ValidCheckoutRequest = Readonly<Required<CheckoutRequest>>;

/** The fields of the upstream Photon `CheckoutSpec` this presentation reads. */
export type CheckoutSpecLike = {
  metadata?: { applePayLabel?: unknown };
  item?: { applePayAmount?: unknown; applePayCurrencyCode?: unknown; applePayCountryCode?: unknown };
};

function text(value: unknown, name: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) {
    throw new TypeError(`${name} must be a non-empty string of at most ${max} characters.`);
  }
  return value.trim();
}

export function validateRequest(value: unknown): ValidCheckoutRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("A checkout request object is required.");
  const input = value as Record<string, unknown>;
  const merchantLabel = text(input.merchantLabel, "merchantLabel", 140);
  const currency = text(input.currency, "currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be an ISO currency code.");
  if (typeof Intl.supportedValuesOf === "function" && !Intl.supportedValuesOf("currency").includes(currency)) {
    throw new TypeError(`Unsupported currency ${currency}.`);
  }
  const digits = new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  if (typeof input.amount !== "string" || !/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/.test(input.amount)) {
    throw new TypeError("amount must be a non-negative decimal STRING, not a display price or a floating-point number.");
  }
  const [whole, fraction = ""] = input.amount.split(".");
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) throw new TypeError(`Too many decimal places for ${currency}.`);
  const amount = digits ? `${whole}.${fraction.padEnd(digits, "0").slice(0, digits)}` : whole;
  const country = input.country === undefined ? "US" : text(input.country, "country", 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new TypeError("country must contain two letters.");
  const domain = text(input.domain || "checkout.example", "domain", 160);
  if (/[^a-zA-Z0-9.:-]/.test(domain)) throw new TypeError("domain must be a hostname, not a URL or HTML.");
  const locale = input.locale === undefined || input.locale === "" ? "en-US" : text(input.locale, "locale", 35);
  // Validate the locale before any UI mutation.
  new Intl.NumberFormat(locale);
  return Object.freeze({ merchantLabel, amount, currency, country, domain, locale });
}

export function formatMoney(input: CheckoutRequest): string {
  const request = validateRequest(input);
  return new Intl.NumberFormat(request.locale, { style: "currency", currency: request.currency }).format(Number(request.amount));
}

export function fromCheckoutSpec(spec: CheckoutSpecLike, domain: string, locale = "en-US"): ValidCheckoutRequest {
  return validateRequest({
    merchantLabel: spec?.metadata?.applePayLabel,
    amount: spec?.item?.applePayAmount,
    currency: spec?.item?.applePayCurrencyCode || "USD",
    country: spec?.item?.applePayCountryCode || "US",
    domain,
    locale,
  });
}

/** The headline amount steps down for long formatted strings so it stays on one line. */
export function amountFontSize(formatted: string): number {
  return formatted.length > 15 ? 34 : formatted.length > 12 ? 40 : 48;
}
