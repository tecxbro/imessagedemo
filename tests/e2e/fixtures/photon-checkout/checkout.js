// Test-double checkout: renders a fixture CheckoutSpec and, in visual presentation, hands the Apple Pay
// tap to the parent renderer through the recreation package's unmodified child bridge.
(function () {
  "use strict";
  const ALLOWED_PARENTS = ["http://127.0.0.1:4173", "http://127.0.0.1:5173", "http://localhost:5173"];
  const specs = {
    "/hotel": { brand: "ORCHID", item: { title: "Private retreat", subtitle: "Entire villa · Private pool", displayPrice: "$2,040", applePayAmount: "2040.00" }, metadata: { applePayLabel: "Orchid — Villa Amara" } },
    "/pass": { brand: "LARK", item: { title: "Day pass", subtitle: "Cowork · Coffee included", displayPrice: "$24", applePayAmount: "24.00" }, metadata: { applePayLabel: "Lark — Day pass" } },
    "/flight": { brand: "ORCHID AIR", item: { title: "DPS → SIN", subtitle: "Economy · 1 bag", displayPrice: "$280", applePayAmount: "280.00" }, metadata: { applePayLabel: "Orchid — DPS to SIN" } },
    "/eur": { brand: "MAISON VERTE", item: { title: "Tasting menu", subtitle: "Two guests · 8:00 PM", displayPrice: "€79.95", applePayAmount: "79.95", applePayCurrencyCode: "EUR", applePayCountryCode: "FR" }, metadata: { applePayLabel: "Maison Verte — Tasting menu" } },
    "/jpy": { brand: "KISSA HOSHI", item: { title: "Omakase", subtitle: "Counter seat", displayPrice: "¥1,200", applePayAmount: "1200", applePayCurrencyCode: "JPY", applePayCountryCode: "JP" }, metadata: { applePayLabel: "Kissa Hoshi — Omakase" } },
    "/kwd": { brand: "SOUQ LANE", item: { title: "Oud sampler", subtitle: "Three vials", displayPrice: "KWD 12.345", applePayAmount: "12.345", applePayCurrencyCode: "KWD", applePayCountryCode: "KW" }, metadata: { applePayLabel: "Souq Lane — Oud sampler" } },
  };
  const spec = specs[location.pathname];
  const root = document.documentElement;
  const status = document.getElementById("status");
  const token = crypto.randomUUID();
  root.dataset.loadToken = token;
  window.__checkout = { token, results: [], spec };

  document.getElementById("brand").textContent = spec.brand;
  document.getElementById("title").textContent = spec.item.title;
  document.getElementById("subtitle").textContent = spec.item.subtitle;
  document.getElementById("price").textContent = spec.item.displayPrice;

  const params = new URLSearchParams(location.search);
  if (params.get("presentation") !== "visual") {
    root.dataset.photonPayState = "native-default";
    return;
  }
  const parentOrigin = params.get("parentOrigin");
  if (!parentOrigin || !ALLOWED_PARENTS.includes(parentOrigin)) {
    root.dataset.photonPayState = "parent-origin-not-allowed";
    status.textContent = "Apple Pay host is not configured";
    return;
  }
  const checkout = PhotonPay.fromCheckoutSpec(spec, location.hostname);
  window.__checkout.checkout = checkout;
  root.dataset.photonPayState = "ready";
  PhotonPayBridge.mountCheckoutButtons({
    parentOrigin,
    checkout,
    onState(state) {
      window.__checkout.results.push(state);
      root.dataset.photonPayState = state;
      status.textContent = state === "opened" ? "" : state;
    },
  });
})();
