---
name: recreate-apple-pay
description: Maintain the recreated Photon Apple Pay presentation inside this iMessage renderer (the iOS app-card checkout and its full-phone sheet) using the supplied recording's measured frames and the checkout's own data. Use only for that presentation work, not ordinary demo authoring or real payment integration.
---

# Recreate the captured Apple Pay presentation

Adapted from the recreation package's own skill (`apple-pay-recreation-kit/.agents/skills/recreate-apple-pay`). Ordinary demo authoring uses [Make an iMessage demo](../make-imessage-demo/SKILL.md); this skill is for changing the presentation itself, which is implementation scope under `AGENTS.md`.

Read [the presentation notes](../../../docs/apple-pay-presentation.md) first. When the package is available, its `CURSOR_PROMPT.md`, `analysis/ANIMATION.md`, `analysis/EVIDENCE-LIMITS.md`, and `upstream/SOURCE_MAP.md` are the reference. The user's current repository and the supplied recording are authoritative.

Reuse the canonical Photon checkout mini app. Values come from its `CheckoutSpec` through `fromCheckoutSpec`, never from screenshots or example amounts. The renderer implements only the post-button presentation, above the full phone in the parent, never inside the checkout iframe. Keep the checkout's default hosted/native path and unrelated routes unchanged.

The recording has 418 frames at 30 fps; its 60 fps export holds each frame twice. Animate from `src/renderers/ios/apple-pay/motion-data.ts` by interpolation, keep that data verbatim (its SHA-256 is pinned in tests), and do not add motion because it looks nicer. Match the two observed presentations, card growth, spinner, and two cancellations. There is no observed successful payment.

The full card picker and the two hidden card faces are not in the recording. The picker stays a documented provisional extension; do not invent payment identifiers, issuers, biometrics, or completion. Keep the captured red card artwork and the observed side strips. No development disclaimers in the phone UI; record limits in the developer notes.

Use exact origin and window-source checks for iframe messages and the package's protocol unchanged. In visual mode never call ApplePaySession, open windows, collect credentials, or charge a card. A missing host is a visible integration error, not a native fallback.

Preserve dirty work. Typecheck, run the unit and e2e suites, rerun `tests/e2e/apple-pay-visual.spec.ts` with `APPLE_PAY_KIT` set, inspect the images, and report mismatches with measured deltas. A local implementation request does not authorize publication or cloud/provider changes.
