# iMessage demo maker

Local studio for authoring a Messages conversation as JSON and previewing or capturing it with the pinned iMessage UI. It does not send iMessage, SMS, or RCS, and it does not need a provider account.

Repository: this worktree is `codex/wt-00-integration`. The app entry is `src/main.tsx` → `src/App.tsx`. Flows live in `scenarios/`. The agent skill is `.agents/skills/make-imessage-demo/SKILL.md`.

## 1. Write and validate a flow

Create a JSON file matching `DemoFlow` in `src/contracts/index.ts`. `platform` is `ios` or `macos`. `theme` is `light` or `dark`. Each message needs `direction` `incoming` or `outgoing` and a `kind` of `text`, `link`, `attachment`, `image`, or `audio`. Typing is the flow field `typing`, not a message kind. Local images are files in `public/demo-assets/` referenced as `/demo-assets/<file>.png`.

```sh
npm run demo -- validate ./your-flow.json --json
```

Exit `0` means the flow is valid. Exit `2` means the JSON is invalid or asks for something this pin cannot show, including polls and mini apps. Exit `3` means a local asset is missing, escapes `public/demo-assets`, or points at an external file.

`screen` is `conversation` by default. On iOS it may also be `list` or `new-message`. Those screens are part of `ios-shell`. macOS accepts `conversation` only. `examples/agent-walkover.flow.json` is a two-message flow whose reply lands at playback `1000`, matching checkpoint `after-reply`.

`examples/unsupported-poll.flow.json` is a poll. Validating it exits `2` and names `messages[0].kind`. It does not open a browser or write an image.

## 2. Preview and capture

```sh
npm run demo -- preview ./your-flow.json --json --port 4174
```

Stdout is one JSON object with the local URL. Open the iOS or macOS scene from that server. Capture uses the same renderer:

```sh
npm run demo -- capture ./your-flow.json --json --checkpoint after-reply --out artifacts/captures/run
npm run demo -- capture ./your-flow.json --json --at-ms 400 --out artifacts/captures/mid
npm run demo -- capture ./your-flow.json --json --frames --interval-ms 1000 --out artifacts/captures/frames
```

Playback time is `message.atMs` minus the first message `atMs`. A checkpoint `atMs` uses that same clock. PNGs are the `[data-demo-frame]` element only. Their pixel size is the CSS viewport times the capture device scale (2 on both platforms). `manifest.json` records the scenario, timestamps, and ready receipt.

```sh
npm run demo -- capabilities --json
```

`supported` entries can be compiled into a timeline. `catalogueOnly` components exist in the pin and in catalogue scenes, and are not timeline fields. `unsupported` is `polls` and `mini-apps`.

## Checks

```sh
npm ci
npm run verify:upstream
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

`npm run dev -- --host 127.0.0.1 --port 4173` serves the same app. `/?foundation=ios` and `/?foundation=macos` are the stock shell smoke routes. `/?flow=basic-ios-light&t=0` plays a corpus scenario. `t` is playback milliseconds.

## Unsupported

Polls, Photon mini apps, and provider send/receive are out of scope. A poll or mini-app kind fails validation. Do not rewrite it as text.

Tapbacks, quoted replies, edited labels, screen effects, FaceTime cards, and system lines are catalogue-only. The frozen `DemoMessage` does not carry those fields, so a timeline flow cannot author them. Group avatars, group details, stickers, and the larger `imessage.swerdlow.dev` registry are not in this pin.

## Troubleshooting

- Exit `2` and a path such as `messages[0].kind` or `/messages/0/kind`: the flow asks for a field this compiler rejects. Read the message. Polls stop here.
- Exit `3` on validate: the image is missing, not a PNG under `public/demo-assets`, or the path contains `..`.
- Exit `3` on preview: the requested port is already in use. Pick another `--port`.
- `npm run test:e2e` needs the Playwright browsers for the locked `@playwright/test` version: `npx playwright install chromium webkit`. A browser that is not installed is not a pass.
- Native Apple screenshots were not supplied with the pin. This repo does not treat its own PNGs as native fidelity.
