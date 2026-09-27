# Sunday / Memo: local $5 tip checkout

Each Sunday conversation now ends with the customer choosing a $5 USD one-time tip, an incoming checkout card, and a final thank-you. The card appears at 40.5 seconds; playback settles at 45.69 seconds. Tap **Tip with Apple Pay** to open the existing full-phone payment recreation. Closing is cancellation. There is no charge, authorization, success state, native ApplePaySession, popup, or provider connection.

The user requested building the missing checkout after the canonical external checkout could not be found. This local Sunday-specific entrypoint is not a copy of the checkout test fixture and is not the unavailable `airial-pay-site` application. It reuses the repository's actual `fromCheckoutSpec`, money validation, protocol, app-card host, Apple Pay sheet, captured card assets, and pinned motion data. The overlay and its motion are unchanged.

## Source

- `checkouts/sunday-tip.html`: compact card entrypoint served by the existing Vite preview.
- `src/checkouts/sunday-tip-spec.ts`: single source for merchant, item, exact decimal amount, currency and country.
- `src/checkouts/sunday-tip.ts`: renders the spec and handles the visual-only child bridge.
- `src/checkouts/sunday-tip.css`: 240-point card, Sunday official mark, warm grey and yellow from the official site.
- `scenarios/sunday-*.json`: the three stories with their final tip cards.
- `tests/e2e/sunday-tip.spec.ts`: real checkout integration, amount propagation, cancellation, reopen, blocked hosts and no native payment.

Both card and sheet derive `$5.00` from `applePayAmount: "5.00"`. The displayed domain comes from the checkout hostname. The child accepts replies only from `window.parent`, the exact allowed parent origin, protocol version 1, and its active request ID. Requests use unique IDs, disable repeated button taps, and report a missing host after six seconds. Cancellation clears the active ID and re-enables the button. A top-level page or unlisted parent keeps payment disabled.

## Preview

Run each command in its own terminal. Ports are deliberate because each flow has an absolute app-card URL and the child has an exact parent allowlist.

```sh
VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:5174 npm run demo -- preview scenarios/sunday-dinner-cleanup.json --json --platform ios --port 5174
VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:5175 npm run demo -- preview scenarios/sunday-morning-espresso.json --json --platform ios --port 5175
VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:5176 npm run demo -- preview scenarios/sunday-sock-pile.json --json --platform ios --port 5176
```

No separate checkout server is needed. Each preview serves its own card at `/checkouts/sunday-tip.html`. The renderer appends the visual mode and exact parent origin; those are not authored into the flow URL. Test origin `http://127.0.0.1:4173` is also allowed. No public origin is allowed.

The normal offline `demo capture` path cannot capture a live checkout card. Review the live preview or the integration test screenshots. Existing pre-tip PNGs remain evidence of the earlier conversation only. This checkout is intended for the local Vite preview; static packaging and publication are not part of this change.

The original recreation kit and reference video are not present locally. No fresh comparison against the measured reference frames can be claimed; the overlay source and pinned motion are unchanged.
