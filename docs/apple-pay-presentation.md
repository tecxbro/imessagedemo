# Live checkout card and the recreated Apple Pay presentation

Developer notes for the iOS `app-card` flow item and the Apple Pay sheet it opens. The phone UI carries no disclaimers; the limits below belong here and in handoffs.

## What it does

A flow message with `kind: "app-card"` embeds an existing Photon checkout mini app (the 300 × 240 `renderCheckout(spec)` page from `airial-pay-site`) as an iframe in the Messages thread. When the checkout's Apple Pay button is tapped, the checkout asks the renderer to present, and the renderer shows a recreation of the recorded Apple Pay sheet over the entire phone surface. The checkout stays mounted under a ~50% black dim. Closing (the × control or Escape) tells the checkout to reset, and the thread is exactly as it was. The iframe does not reload.

The visual source is the supplied recording and its analysis package (`apple-pay-recreation-kit`, not in this repository): 512 × 1112, 30 fps, 418 frames, 13.933 s, two presentations and two cancellations.

## Flow item

```json
{
  "id": "checkout",
  "text": "Villa Amara checkout",
  "direction": "incoming",
  "atMs": 1790008745200,
  "kind": "app-card",
  "appCard": { "url": "http://127.0.0.1:3100/hotel", "live": true, "app": "checkout", "height": 240 }
}
```

- `url`: absolute http(s) URL of the checkout route, without credentials or the `presentation`/`parentOrigin` parameters.
- `live` must be `true` and `app` must be `"checkout"`; other Photon mini apps and polls stay unsupported (`src/contracts/capabilities.json`).
- `height`: 120–480 points, default 240. The width is the thread's maximum bubble width (280.5 points), which matches the card in the recording.
- iOS only. Validation rejects the item on macOS, with SMS service, with `status`/`reactions`/`replyTo`/`edited`/`effect`, when a reaction/status/long-press/context-menu/thread event targets it, and in a flow that enters select mode (select mode re-creates every row, which would reload the card).
- `demo capture` stays offline: with the checkout origin configured it fails (exit 3, "External network request during capture") on the card's request; without it, the capture shows the configuration error card. Inspect app-card flows in the preview, or capture the conversation before the card arrives.

Example: [examples/photon-checkout-apple-pay.flow.json](../examples/photon-checkout-apple-pay.flow.json). Follow-up messages after the card scroll it up, so at the end of playback (checkpoint `ready-to-pay`) the card sits at about y 61–301 in the 402 × 874 phone and its top ~140 points stay visible above the open sheet. This is the recording's composition: in the recording that row is a villa photo, and the mini app itself is behind the panel. A card that is the newest message sits entirely behind the sheet.

## Configuration

The renderer embeds a checkout only when its origin is listed in `VITE_PHOTON_CHECKOUT_ORIGINS`, a comma-separated list of exact origins read when the Vite dev/preview server starts. The bridge then accepts messages only from that origin and that iframe. An unlisted origin renders a configuration error in the card and no request is made.

```sh
# Real checkout on 127.0.0.1:3100 (its PHOTON_PAY_VISUAL_PARENT_ORIGINS must include the renderer origin)
VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:3100 npm run demo -- preview examples/photon-checkout-apple-pay.flow.json --json --platform ios --port 5173
# or the plain dev server on a port the checkout allows, e.g. 5173
VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:3100 npm run dev -- --host 127.0.0.1 --port 5173
```

The renderer appends `presentation=visual&parentOrigin=<window.location.origin>` to the card URL. The checkout honors that parent only if it is on the checkout's own allowlist, so pin a preview port that allowlist includes (`--port 5173` for the local checkout, which allows `http://127.0.0.1:5173`, `http://localhost:5173`, and `http://127.0.0.1:4173`).

Verified against the real `airial-pay-site` checkout running at `http://127.0.0.1:3100/hotel` (renderer on `http://127.0.0.1:5173`): the card loaded once, its visible Apple Pay control opened the sheet with "Pay Orchid — Villa Amara", $2,040.00 in all three places and domain `127.0.0.1`, closing reset the checkout to `ready`, reopening worked, and no native payment or popup call was made.

The iframe is `sandbox="allow-scripts allow-same-origin"` (no popups, top navigation, or forms), `referrerpolicy="no-referrer"`, and has no `allow` attribute, so a cross-origin checkout gets no `payment` permission.

## Architecture

All code is repository-owned; the pinned UI in `src/components/imessage` and `vendor/upstream` is unchanged.

| Part | Path | Role |
| --- | --- | --- |
| Visual component | `src/renderers/ios/apple-pay/ApplePayOverlay.tsx`, `apple-pay.css` | The sheet's DOM and styles, ported from the package. One instance per phone, absolutely positioned over the whole phone root, scaling the 512 × 1112 plane into it (bottom-aligned). Per-frame geometry is written to refs; text, selected card, and picker are React state. |
| Animation / state machine | `src/renderers/ios/apple-pay/motion-data.ts`, `motion.ts`, `controller.ts` | The 418 measured frames (verbatim, SHA-256 pinned in tests), interpolated at display refresh rate. Modes: `idle`, `interactive` (manual open), `selected`, `closing`, and `seek`/`play` for captures. |
| Checkout data / validation | `src/renderers/ios/apple-pay/checkout.ts`, `cards.ts` | `validateRequest`, `formatMoney`, `fromCheckoutSpec` from the package; wallet fixture cards. |
| Bridge | `src/renderers/ios/apple-pay/bridge.ts` | Parent half of the package's `bridge.js` protocol. |
| Mini-app host | `src/renderers/ios/app-card/AppCardLayer.tsx`, `config.ts` | Docks each card's iframe into its thread row, owns the one overlay and the one `message` listener, and reads the origin allowlist. Mounted by `src/renderers/ios/scene.tsx` only when the compiled flow contains an app card. |

The pinned message list has no slot for foreign content. An app card is therefore handed to it as an ordinary row (`src/renderers/ios/adapt.ts`), so it takes the list's own clustering and gaps. The layer hides that row's contents with a scoped style rule and appends a renderer-owned container to the row. The iframe is portaled into that container, which is never re-parented while the row exists, so the sheet opening and closing cannot reload it. The conversation scrolls, clips under the navigation bar and composer, and transitions exactly as the list does.

If the card that opened the sheet leaves the thread while the sheet is up (Replay, a reset, or a seek before the card's arrival), the sheet is removed at once, without the exit track. The bridge forgets that iframe and its request without posting to the discarded window, the stored request is cleared, and `inert` is restored. When playback brings the card back, it is a fresh iframe and a new tap opens the sheet normally.

While the sheet is visible, every sibling of the overlay inside the phone root is `inert` (the conversation, the checkout iframe, the status bar). The dialog takes focus when it becomes visible. Tab cycles inside the sheet, Escape backs out of the picker and then closes the sheet, and focus returns to the checkout iframe afterwards. Under `prefers-reduced-motion` the sheet opens directly in its settled pose and closes in one step. Unmounting cancels the animation clock, removes listeners, restores `inert`, and reports an open sheet as cancelled.

## Bridge protocol

Unchanged from the package (`implementation/bridge/bridge.js`), protocol version 1:

- checkout → renderer: `{ type: "photon-pay:open", version: 1, requestId, checkout }`, with `requestId` matching `^[a-zA-Z0-9_-]{8,100}$` and `checkout = fromCheckoutSpec(spec, location.hostname)`.
- renderer → checkout: `{ type: "photon-pay:result", version: 1, requestId, state }`, posted to the checkout's exact origin, with `state` one of `opened`, `busy`, `invalid`, or `cancelled`.

The renderer ignores a message unless `event.source` is a registered checkout iframe's `contentWindow` and `event.origin` is exactly that iframe's origin. It ignores malformed envelopes (wrong type or version, bad request ID) and validates `checkout` before touching any state, answering `invalid` if it fails. An iframe that leaves the thread while presenting is withdrawn silently (decision `withdrawn`). A request ID is answered once: a repeat gets the recorded state again (`opened` while open, `cancelled` afterwards) and never reopens the sheet. Any other request while a sheet is showing gets `busy`. Closing the sheet answers `cancelled`. The checkout's own guard deduplicates pointerup/touchend/click from one tap.

## Dynamic values

The checkout sends the merchant label (`metadata.applePayLabel`, shown as "Pay …"), the exact `applePayAmount` string, currency, country, and domain. The renderer formats the amount with `Intl.NumberFormat` from the validated string (0-, 2-, and 3-decimal currencies; `displayPrice` is never parsed) and uses one request for the headline amount, the "Pay …" line, and the total. Nothing in the overlay hardcodes an amount, currency, merchant, or hostname. The wallet fixture (the red Bank of America card ending 5334 and the two partial side strips) is the same for every checkout.

## Assets

Shipped, from the package's `implementation/assets/` and verified as the only images the runtime references: `bofa-5334.png`, `rho-left-visible.png`, `other-right-visible.png`, `apple-pay-lockup.png`, `payment-icon.png` (in `src/renderers/ios/apple-pay/assets/`). Not shipped: the original video, the frame export, keyframes, contact sheets, `recorded-background.png`, `open-system-chrome.png`, and `miniapp-cover.png`. The test double reuses the package's `bridge.js`, `apple-pay.js`, and `motion-data.js` under `tests/e2e/fixtures/photon-checkout/vendor/` only.

## Evidence limits

Reproduced from measured data: the first-presentation entrance (manual open replays frames 66–181 and holds on the pending pose), the ~50% black dim with no added blur, the settled sheet at x 10, y 254, 492 × 848, the three-card fan, the red card growing from 202 × 127 to 248 × 157 around a fixed centre, the side strips going behind it, the options pill, summary row, total/domain, blue spinner, close highlight, and the downward exit along the measured frames 185–198. `setTime`/`play` replay both recorded cycles, including their different onset and settling samples.

Approximations carried over from the package, not recovered native behavior: the side strips' retreat and opacity during growth, the spinner phase (one turn per second), and the close control's pressed material. Measured misses in this renderer are in [the comparison below](#visual-comparison).

Not in the recording and not implemented as fact: the full card picker, card switching, the hidden faces of the two partial cards, Face ID, the side button, authorization, success, and decline. "Other Cards & Pay Later Options" opens a **provisional** three-row picker kept for interaction testing. It is not a measured native layout; selecting a partial card shows only its captured strip on a neutral surface. Closing is always a cancellation; nothing marks an order paid.

Browser output is not a physical-device or native Apple Pay verification. Fonts are the platform system font; macOS Chromium (San Francisco) is closer to the recording than Linux fallbacks, but glyph metrics still differ from iOS.

## Visual comparison

`tests/e2e/apple-pay-visual.spec.ts` captures the overlay alone at 512 × 1112 over the recording's idle frame (read from the package at test time) for all 69 supplied keyframes, and the real renderer at the 402 × 874 phone viewport at 3.000 s and 4.500 s. It measures both images with the same pixel detectors and writes side-by-side images, `report.json`, and `report.md` to `artifacts/apple-pay-visual/`:

```sh
APPLE_PAY_KIT=/path/to/apple-pay-recreation-kit npx playwright test tests/e2e/apple-pay-visual.spec.ts --project=chromium-ios-light-e2e
```

Last recorded result (macOS, Chromium, Playwright 1.63):

- Within ±3 source px: the sheet top on all 69 keyframes (max 3 px, frame 308); sheet left/right edges at every settled frame; the red card rectangle on every frame where it is visible (≤1 px); lockup, close control, options pill, and summary row at 3.000 s and 4.500 s. Phase boundaries (first visible frame 67/300, card growth 101–121/332–352, exit 185–198/375–388) land on the same source frame.
- Misses: during the first frames of each entrance (68–69, 301) the recorded sheet is 5–7 px wider on each side, tapering to about 3 px at frame 70; from frame 75 until frame 84 (and 308–314) the recorded spinner sits 32–41 px higher, then matches within 1.5 px; the side strips stay more visible than recorded during growth (101–114); the recorded background dims slightly more (luminance ratio 0.479 against 0.493 once the card has grown, and against about 0.50 from frame 75 to 100, including 3.000 s). The package's measured data does not describe these, so they are reported rather than invented.
- Font metrics: the merchant line renders 5 px lower and 14 px narrower, the amount 4 px lower and 6 px wider, and the summary text 11 px narrower than the recording. Positions are the package's CSS values.
- Not drawn by the overlay: the recording's status bar and Dynamic Island changes (OS chrome; the renderer keeps its own status bar under the dim).

## Tests

- `tests/renderers/ios/apple-pay.test.ts`: the package's core tests, the motion-data pin, open/close tracks, and the state machine with a fake clock.
- `tests/renderers/ios/checkout-bridge.test.ts`: origin/source/envelope/validation/deduplication rules and the origin allowlist.
- `tests/compiler/app-card.test.ts`: the flow contract, compile/projection, CLI schema, and capability manifest.
- `tests/e2e/apple-pay.spec.ts`: the real cross-origin path against the test double served on `127.0.0.1:4174` (`tests/e2e/fixtures/photon-checkout/`), which Playwright starts next to the dev server with `VITE_PHOTON_CHECKOUT_ORIGINS=http://127.0.0.1:4174`.
