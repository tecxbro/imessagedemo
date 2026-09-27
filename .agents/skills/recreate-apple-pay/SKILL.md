---
name: recreate-apple-pay
description: Add visual Apple Pay checkout or tipping to local iMessage demos, or maintain the recreated full-phone Apple Pay sheet. Reuse the existing presentation and checkout data adapter; no real payment integration.
---

# Add or maintain visual Apple Pay

Adapted from the recreation package's own skill (`apple-pay-recreation-kit/.agents/skills/recreate-apple-pay`). Ordinary conversation authoring uses [Make an iMessage demo](../make-imessage-demo/SKILL.md). An explicit request to add an Apple Pay checkout or tip authorizes the scoped local checkout implementation needed below; a company-only demo request does not.

Read [the presentation notes](../../../docs/apple-pay-presentation.md) first. Distinguish the checkout card from the full-phone sheet: the card supplies the item and amount; the shared visual flow automatically presents the sheet when the final checkout card arrives, and its button reopens the sheet after cancellation.

## Add a checkout or tip

Prefer an existing compatible checkout. Check the current repository and known project locations once. The external `airial-pay-site` checkout is a reuse preference, not a mandatory dependency for a local visual demo. Do not repeatedly ask the user to locate it or stop solely because it is absent.

If no suitable checkout exists, build the smallest local visual checkout that satisfies the request. Reuse the implemented [local checkout pattern](../../../docs/sunday-tip-demo.md), its `CheckoutSpec` adapter, and the existing app-card host and sheet. Adapt company-specific data and exact local origins; do not carry Sunday's amount, brand, or ports into another demo by default. Keep test fixtures in tests and avoid adding a provider, publishing a Site, or rebuilding the payment presentation.

Resolve the item or tip amount, currency, and requested placement from the conversation. Ask only for a material missing value, not permission to build the already-requested local card. For a newly authored ending, put tipping after the completed task and make the checkout card the final message. Place any acknowledgement before the card; do not append a thank-you or payment-success message. Automatically open the visual sheet when the card arrives. Preserve a supplied exact transcript or explicit manual-open requirement rather than silently rewriting it. A user-requested fictional tip does not require a verified retail checkout; identify it as demo behavior in the handoff, not as a shipped company feature.

Show only the Apple Pay mark in the payment button, without “Tip with”, “Pay with”, or another visible prefix; retain an accessible Apple Pay label. Use the shared conversation presentation: one company/contact header name, natural text-bubble widths, and progressive header blur (clear below, strongest toward the top edge). Do not add company-specific conversation CSS. Video, when present, follows the executor's muted inline timeline playback, without a separate “Play video” footer, elapsed-time label, scrubber, mute button, or other browser media controls.

Keep merchant and exact decimal amount in the checkout's `CheckoutSpec` data consumed by `fromCheckoutSpec`. Derive the displayed amount through the existing formatter and domain from the checkout hostname; never parse a display price or hardcode these values into the sheet. Preserve the existing sheet, recorded motion, and card artwork when only adding a checkout.

Reuse [the shared visual checkout helper](../../../src/checkouts/visual-checkout.ts) for the exact-origin/version-1 `photon-pay:present` cue: it validates the configured parent and uses the existing `photon-pay:open` bridge. Automatic presentation occurs once after the final card settles during normal Play; paused views, paused seeks and capture do not open it. A seek while playing retains playback and can present; pause before inspection seeks. The compiler adds a five-second hold after a final app-card, so no trailing message is needed. Cancellation does not loop; Replay re-arms a fresh arrival. An external checkout without this cue handler remains manual-only until adapted; do not claim automatic support from the open/result bridge alone.

Connect the card using the executor's supported iOS `app-card` fields. Configure exact renderer and checkout origin allowlists and preserve the existing open/result bridge envelopes with origin, window-source, and active request-ID checks. For a local visual-only checkout, keep top-level or unconfigured payment controls disabled. Use the existing local preview server when suitable. Preserve unrelated checkouts and any hosted/native payment paths.

## Change the payment presentation

Only change the sheet or animation when requested. When the recreation package is available, its `CURSOR_PROMPT.md`, `analysis/ANIMATION.md`, `analysis/EVIDENCE-LIMITS.md`, and `upstream/SOURCE_MAP.md` are the reference. The user's current repository and supplied recording are authoritative. The sheet belongs above the full phone in the parent, never inside the checkout iframe.

The recording has 418 frames at 30 fps; its 60 fps export holds each frame twice. Animate from `src/renderers/ios/apple-pay/motion-data.ts` by interpolation, keep that data verbatim (its SHA-256 is pinned in tests), and do not add motion because it looks nicer. Match the two observed presentations, card growth, spinner, and two cancellations. There is no observed successful payment.

The full card picker and the two hidden card faces are not in the recording. The picker stays a documented provisional extension; do not invent payment identifiers, issuers, biometrics, or completion. Keep the captured red card artwork and the observed side strips. No development disclaimers in the phone UI; record limits in the developer notes.

Use exact origin and window-source checks for iframe messages and the package's protocol unchanged. In visual mode never call ApplePaySession, open windows, collect credentials, or charge a card. A missing host is a visible integration error, not a native fallback.

## Verify and hand off

Preserve dirty work and check the changed surface:

- Checkout or flow changes: typecheck changed code, validate/compile the flow, and run focused checkout integration tests. Watch playback through the final card and automatic sheet opening, inspect the merchant and amount in every sheet location, cancel, and reopen using the Apple Pay button. Check that Replay resets the sheet and the next pass presents once again. Verify that the sheet covers the phone, the iframe stays mounted, and no native payment or popup occurs.
- Presentation changes: additionally run the unit and e2e suites and `tests/e2e/apple-pay-visual.spec.ts` with `APPLE_PAY_KIT` set. Inspect images and report measured mismatches. If the reference package is unavailable, report that comparison as unverified; do not invent deltas. Its absence does not block wiring a checkout to the unchanged existing sheet.

The offline CLI capture does not verify a live app-card. Use inspected preview or integration-test screenshots for that ending. Return the working preview and state that it is a local visual payment with pending/cancel behavior, not a charge or successful payment. A local implementation request does not authorize publication or cloud/provider changes.
