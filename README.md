# iMessage demo maker

Local studio for authoring a Messages conversation as JSON and previewing or capturing it with the pinned iMessage UI. It does not send iMessage, SMS, or RCS, and it does not need a provider account.

The assembled app entry is `src/main.tsx` -> `src/App.tsx`. Flows live in `scenarios/`. Two repository skills work together: [Photon Demo Creator](.agents/skills/photon-demo-creator/SKILL.md) handles company research, story selection, and review; [Make an iMessage demo](.agents/skills/make-imessage-demo/SKILL.md) handles the renderer's schema and commands.

## Start with a company

From this checkout, tell your agent:

```text
Use $photon-demo-creator to make HTML iMessage demos for https://lovable.dev.
Choose relevant conversations, inspect the renders, and return preview URLs
and PNG captures so I can screen-record them.
```

Only one tag is needed. `$make-imessage-demo` can also route a company-only request into the same research workflow. Existing transcripts go straight to authoring/rendering. Read [Agent workflow](docs/agent-workflow.md) for skill ownership and synchronization. The renderer remains unchanged; agents produce data/assets, not new UI code.

## 1. Write and validate a flow

Create a JSON file matching `DemoFlow` in `src/contracts/index.ts`, plus optional CLI fields from `src/cli/authoring.ts`. `platform` is `ios` or `macos`. `theme` is `light` or `dark`. Each message needs `direction` `incoming` or `outgoing`; `kind`, when supplied, is `text`, `link`, `attachment`, `image`, or `audio`. Typing is the flow field `typing`, not a message kind. Local images are files in `public/demo-assets/` referenced as `/demo-assets/<file>`.

```sh
npm run demo -- validate ./your-flow.json --json
```

Exit `0` means valid. Exit `1` means usage error. Exit `2` means invalid or unsupported flow content, including polls and mini apps. Exit `3` means an asset, browser, or environment failure. Supported image formats are PNG, JPEG, GIF, and WebP; SVG needs preparation as a supported image.

`screen` is `conversation` for ordinary demos. On iOS it may also be `list` or `new-message`; macOS accepts `conversation` only. `examples/agent-walkover.flow.json` has a reply arriving at playback `1000`, matching `after-reply`. Use `1690` for a post-arrival settled capture of that example.

`examples/unsupported-poll.flow.json` fails validation with exit `2`. It does not open a browser or write an image.

## 2. Preview and capture

```sh
npm run demo -- preview ./your-flow.json --json --platform ios
```

Use the actual local URL returned by the CLI and keep its process alive. Preview has playback controls. A specified `--port` must be free. Capture uses the same renderer from another terminal/session:

```sh
npm run demo -- capture ./your-flow.json --json --platform ios --checkpoint after-reply --out artifacts/captures/run
npm run demo -- capture ./your-flow.json --json --platform ios --at-ms 400 --out artifacts/captures/mid
npm run demo -- capture ./your-flow.json --json --platform ios --frames --interval-ms 1000 --out artifacts/captures/frames
```

Checkpoint IDs must exist in your flow. Use fresh output directories for each run. `targets` chooses platform variants; preview/capture selects one variant per invocation, so repeat explicitly for each desired platform.

Playback time is `message.atMs` minus the first message `atMs`; checkpoints use that clock. PNGs contain `[data-demo-frame]` only. Their pixel size is the CSS viewport times the capture device scale (2 on both platforms). `manifest.json` records the scenario, timestamps, and ready receipt. Sampled PNGs are not a video, and a local preview is not publication.

```sh
npm run demo -- capabilities --json
```

`supported` entries can be compiled into a timeline. `catalogueOnly` components exist in stock scenes but are not authorable timeline fields. The [renderer skill](.agents/skills/make-imessage-demo/SKILL.md) is the canonical command cookbook.

## Checks

```sh
npm ci
node scripts/check-demo-skills.mjs
npm run verify:upstream
npm run typecheck
npm run test:unit
npm run build
npm run test:e2e
```

`check-demo-skills` checks instructions and example timing, not browser output. `npm run dev -- --host 127.0.0.1 --port 4173` serves the app. `/?foundation=ios` and `/?foundation=macos` are stock shell smoke routes. `/?flow=basic-ios-light&t=0` plays a corpus scenario; `t` is playback milliseconds.

## Current boundaries

Polls, Photon mini apps, and provider send/receive are out of scope. Do not rewrite a required unsupported interaction as text or a picture. Tapbacks, quoted replies, edited labels, screen effects, FaceTime cards, and system lines are catalogue-only. Group avatars, group details, stickers, and the larger `imessage.swerdlow.dev` registry are not in this pin.

The current flow has contact name/initials, not an avatar-logo field, chat wallpaper, or outer presentation settings. Researching an asset does not add its placement to the renderer. Keep prepared versus visibly applied branding clear. There is no built-in MP4 or publish command; export/publication requires actual supported tooling, not a claim based on a development URL.

## Troubleshooting

- Exit `2` with a field path: inspect the unsupported/schema error rather than inventing a replacement field.
- Exit `3` on validation: check asset existence, format, dimensions, root containment, and external paths.
- Exit `3` on preview: an explicit port may be occupied; omit `--port` for an available one.
- Capture needs `npx playwright install chromium`. The full e2e suite also needs the locked WebKit browser: `npx playwright install chromium webkit`. Missing browsers are not passing tests.
- Native Apple screenshots were not supplied with the pin. The repo's own PNGs are not native-fidelity evidence. Historical release reports describe their original run, not checks rerun today.
