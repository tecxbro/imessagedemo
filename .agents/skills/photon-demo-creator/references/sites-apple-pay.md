# Photon Travel Demo checkout and Sites

Read this reference only for a full new-company demo that uses the shared checkout or for an explicit checkout publish/hosted-route operation in `photon-travel-demo`. Small edits use their focused checks instead of this full ceremony.

## Shared checkout boundary

`airial-pay-site` is the persisted Sites checkout and a nested Git repository. Its `.openai/hosting.json` identifies the Sites project. Verify the nested checkout, access mode, and current hosted target; do not create a replacement Site or choose a project by title or slug.

Current source is data driven:

- `airial-pay-site/app/<route>/route.ts` exposes each route;
- `airial-pay-site/demos/*.ts` contains typed `CheckoutSpec` data;
- `airial-pay-site/lib/checkout/` owns the shared renderer and Apple Pay behavior;
- `airial-pay-site/tests/checkout-architecture.test.mjs` owns the retained-route inventory.

Derive the current routes from source and tests rather than a historical list. The Sites checkout, local Spectrum server, Photon project/number, and any legacy `pho-cx` Worker are separate scopes.

## Full new-company preflight

Research enough to propose defaults, then resolve only these material choices before implementation:

1. **Route:** replace `/pay`, or preserve it and use an exact alternate route approved by the user.
2. **Apple Pay item:** exact product or plan, display price, Apple Pay amount, and billing unit.
3. **Conversation:** exact natural first message, proof moment, media/reaction/poll gates, explicit purchase confirmation, card transition, and reset.

Do not require this preflight for a read-only discussion, a named existing-route edit, or an operations-only request. Publication, restart, cloud provisioning, and device rehearsal remain separate scope unless the user explicitly requests them.

## Preserve the checkout product

The existing checkout is a compact 300 by 240 Apple Pay surface. Preserve its shared renderer, layout, spacing, sizing, radii, typography, animation, native `ApplePaySession` path, supported button style, fallback, no-charge demo behavior, input handling, and metadata structure.

Authorized company-specific values belong in a typed checkout spec:

- company/product text and accessibility labels;
- display price and exact Apple Pay amount;
- product data and official logo;
- route-specific metadata and social image;
- first-party colors through `brand-mini-app` and its Photon Travel Demo adapter.

For a new route, add a typed spec and a thin route entrypoint using the shared renderer. Do not fork the layout, use replacement chains, create a separate Site, or silently change another route.

## Make the conversation earn the checkout

The deterministic flow must accept the product's natural input, return a scripted proof of value, resolve required choices, state the exact item and amount, and require explicit purchase confirmation before sending `appCard(publicHttpsUrl, { live: true })`. Early, duplicate, invalid, or unrelated events must not send the card; `reset` returns only that space to its initial state.

Add photos, groups, reactions, typing, polls, or video only when they are a natural input, proof, or decision gate. Do not claim static work was performed live.

## Validate and publish

Before an authorized publication:

1. run the full checkout suite and the relevant agent state/delivery checks;
2. verify exact copy, price, Apple Pay amount, palette/contrast, logo, metadata, card URL, and old-brand absence;
3. confirm the retained-route inventory and render every retained route locally;
4. deploy the exact validated Sites revision/version to the persisted project;
5. verify the hosted target route and every retained route independently.

Local render, Sites deployment, provider delivery, Apple Pay presentation, and physical-device rendering are separate evidence tiers.

## iMessage visual renderer

This is an explicit renderer-only exception; it does not change the default hosted behavior, another route, or the shared 300 by 240 layout. Native-capable hosted contexts keep the canonical `ApplePaySession` path. In the `imessagedemo` visual renderer, a flow embeds the checkout as an iOS `app-card` iframe at `<checkout origin>/<route>?presentation=visual&parentOrigin=<exact renderer origin>`:

- For newly authored visual checkout endings, keep the card as the final message and automatically open the sheet after its arrival settles during normal Play. The visible payment button contains only the Apple Pay mark and reopens after cancellation. Preserve exact supplied transcripts or explicit manual-open instructions; these local defaults do not alter hosted native payment behavior.
- A visual checkout must handle the parent's exact-origin/version-1 `photon-pay:present` cue through the shared validated visual checkout helper to support automatic presentation. Older external checkouts can retain their manual button until that capability exists. Paused views, paused seeks and capture do not auto-open; cancellation does not loop, and Replay re-arms the next arrival.
- The checkout honors `parentOrigin` only when it exactly matches its own server allowlist (`PHOTON_PAY_VISUAL_PARENT_ORIGINS`). The renderer embeds only origins in its own `VITE_PHOTON_CHECKOUT_ORIGINS`. Neither side trusts an unchecked flow or query value.
- In visual mode the existing Apple Pay controls post `{ type: "photon-pay:open", version: 1, requestId, checkout }` to the parent instead of opening a window or constructing a native session. `checkout` is `fromCheckoutSpec(spec, hostname)`: `metadata.applePayLabel`, the exact `item.applePayAmount` string (authoritative; `displayPrice` is never parsed), currency, country, and domain.
- The parent checks the exact origin and the iframe's window, validates before changing anything, answers `opened`, `busy`, `invalid`, or `cancelled`, deduplicates request IDs, and presents the recreated sheet over the whole phone. Closing answers `cancelled`, and the checkout resets its button. A missing or unreachable host is a visible checkout error, never a native fallback.
- The recreated sheet shows a pending payment and cancellation only. It is not evidence of a native Apple Pay sheet, a charge, or device behavior.

Stop rather than improvise when the full-demo route, item/amount, or purchase-confirmation gate is unresolved; the persisted Sites target cannot be verified; first-party brand evidence is unavailable; or publication requires access the user has not authorized.
