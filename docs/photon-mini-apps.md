# Photon mini app cards

This renderer supports the card → interactive web app → close/reopen experience from `photon-hq/miniapp-demo-agent`. The reference at commit `170174c741c8087aad3c8f038aec82886d4ae54d` calls Spectrum's `customizedMiniApp` with an app URL and `layout` metadata. Its fixed native extension is named Spectrum. The reference does not contain the native extension UI, so this browser sheet and motion are a recreation, not a pixel-verified native implementation.

The demo maker hosts existing apps. It does not run the reference's messaging worker, OpenRouter/v0 builder, deploy apps, or send iMessages. No provider account, secret, SDK, or additional dependency is needed. Checkout cards retain their separate Apple Pay bridge and automatic presentation behavior.

## Author a card

```json
{
  "id": "focus-app",
  "text": "Track your focus sessions",
  "direction": "incoming",
  "atMs": 1790008742000,
  "kind": "app-card",
  "appCard": {
    "app": "miniapp",
    "live": true,
    "url": "/demo-apps/counter.html",
    "layout": {
      "caption": "Focus Sessions",
      "subcaption": "Make time for your best work",
      "summary": "Track completed sessions and your current focus."
    }
  }
}
```

`caption` and `summary` are required. `subcaption` is optional. For artwork, supply both `image` (a local raster path under `/demo-assets/`) and `imageTitle`. The caption and subcaption appear in the card; summary describes the dialog for accessibility. Text-only cards get a neutral app artwork placeholder. The card's artwork is 174 points tall; metadata determines the remaining height. `height` remains a checkout-specific presentation option in practice and does not size a mini app sheet.

Mini apps use the existing iOS app-card restrictions: no SMS, macOS, decorations on the placeholder row, or selection mode in a flow containing an app card. Author app cards in `messages`, not message events. URLs can be absolute HTTP(S) without credentials or local HTML paths under `/demo-apps/`. Local paths reject traversal and query strings.

## Interactions

- Play brings the card into the conversation. It does not automatically open a mini app or request its remote URL.
- Tap the card to open the app within the phone, under the status bar.
- The embedded page handles its own controls, forms, and game interactions.
- Close or Done returns to the thread. The iframe stays mounted, preserving its current state. Closing hides the app; it does not stop a remote app's own timers.
- Reload explicitly restarts the app. Replay/reset removes its iframe, so the next open starts fresh.
- Focus moves to Close on opening and back to the card on closing; the phone's background is inert while the sheet is open. Escape works while focus is in the host; Escape inside a cross-origin iframe is owned by that app. Close and Done remain available.

## Run the examples

Local interaction example (no network access or configuration):

```sh
npm run demo -- preview examples/miniapp-local.flow.json --json --platform ios
```

Actual Jump Jump game from the reference:

```sh
VITE_PHOTON_MINIAPP_ORIGINS=https://jump-jump-production.up.railway.app npm run demo -- preview examples/photon-miniapp.flow.json --json --platform ios
```

The Jump Jump artwork was copied verbatim from the supplied reference's `src/public/jump.jpeg` into `public/demo-assets/photon-miniapp/jump.jpeg`. Caption, subcaption, summary, and game URL follow its `src/constants.ts`. The Spectrum icon in the host is a generic decorative glyph, not supplied brand artwork.

External origins must be listed exactly in `VITE_PHOTON_MINIAPP_ORIGINS` before server startup. This is separate from `VITE_PHOTON_CHECKOUT_ORIGINS`. Unconfigured apps show an error without requesting the URL. External apps must permit iframe embedding; host CSP/X-Frame-Options restrictions are not bypassed. Apps needing camera, microphone, geolocation, native payments, top navigation, downloads, popups, or form submission are outside this host's support.

Local apps use `sandbox="allow-scripts"`. Cross-origin apps additionally retain their own origin (`allow-same-origin`) for their scripts, storage, and fetches; they remain isolated from the demo host. Neither path grants forms, popups, top navigation, or payment permissions. This host does not accept an app's postMessage events or map them into messages/payments.

The CLI captures the closed preview card offline; it does not open or verify the embedded app. Use browser interaction tests and preview screenshots for the open app.

## Code and checks

- `src/renderers/ios/mini-app/MiniAppDock.tsx`: card, dock, sheet lifecycle and focus.
- `src/renderers/ios/mini-app/mini-app.css`: card and sheet styling.
- `src/renderers/ios/mini-app/config.ts`: URL/origin resolution.
- `src/contracts/index.ts`, `src/compiler/validate.ts`, `src/compiler/compile.ts`: schema, validation, timeline preservation.
- `tests/compiler/mini-app.test.ts`: metadata preservation, invalid inputs, exact-origin rules.
- `tests/e2e/mini-app.spec.ts`: lazy loading, input, close/reopen, reload/replay and blocked origins in Chromium/WebKit. Optional live reference check uses `TEST_PHOTON_REMOTE=1` and its configured origin; external availability is not part of the deterministic suite.

No pinned upstream component was modified.
