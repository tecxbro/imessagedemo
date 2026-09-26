---
name: make-imessage-demo
description: Render local iMessage demo flows with the pinned UI. Owns schema, capabilities, validation, preview, and capture. For a company-only brief, first use the repository photon-demo-creator workflow, then execute these commands; no provider account or live messages.
---

# Make an iMessage demo

This is the renderer executor for a **local visual demo maker**. Produce one JSON file per conversation, not application code or a replacement Messages UI.

One company-name workflow: research the company, author the conversation, validate, preview and capture, then inspect playback before calling it ready. The user should not write JSON, pick UI components, or tag a second skill. Load this file and [Photon Demo Creator](../photon-demo-creator/SKILL.md) from the repository when either skill is requested. Do not change application code for each company; use the renderer that is already here.

## Skill handoff and source of truth

For project setup without a company, follow [Agent bootstrap](../../../docs/agent-bootstrap.md) first. Load the included skills, verify the supplied example, and start a usable preview before asking for a company name. Do not treat the repository URL as a company brief or start research during setup. Read-only review stays read-only; an already supplied company/transcript continues after setup without another question.

If the user supplies only a company name or URL, read [Photon Demo Creator](../photon-demo-creator/SKILL.md) and its HTML workflow to prepare the brief, assets, and conversations first. If a brief, exact transcript, or flow already exists, execute it here without restarting research or routing back. Either skill can be the user's only tag.

Photon Demo Creator owns research, conversation count/defaults, story selection, asset provenance, and visual review. This skill owns the current renderer contract and commands. Code and capability output control actual support; neither skill adds capabilities. The repository copies are canonical in this checkout.

Read `AGENTS.md`. For a content task, keep renderer code, contracts, upstream components, dependencies, and other demos unchanged. Use only the pinned UI. No Spectrum, provider credentials, phone number, mini-app, or live send is involved. An explicitly required unsupported feature blocks the affected flow, not independent supported flows; never silently replace it with text or a picture.

## 1. Inspect support and prepare the environment

Run from the repository root. Use the existing lockfile; install dependencies only when needed with `npm ci`. Capture needs the locked Playwright Chromium browser (`npx playwright install chromium`). Do not upgrade packages to make a content task work.

```sh
npm run demo -- capabilities --json
```

Use `supported` capabilities only for authored flows. `catalogueOnly` entries are not timeline fields. `unsupported` includes polls and mini-apps. Check [the flow contract](../../../src/contracts/index.ts) and [CLI authoring fields](../../../src/cli/authoring.ts) for exact data shapes rather than inventing fields.

Current flow messages use `kind`: `text`, `link`, `attachment`, `image`, or `audio`. Direction is `incoming` or `outgoing`. From the customer's phone, the customer is outgoing and the company is incoming. Default `screen` to `conversation`. Typing and draft are timeline events. Do not encode typing as a message row. Turn typing on before each company response and add an explicit typing-off event at the same time that incoming message arrives. A later typing interval is another on/off pair. Do not rely on message arrival to clear typing. Audio is waveform data plus an `audio-control` event, not an uploaded audio track; attachment rows do not imply playable video or file delivery.

Reactions are timeline events aimed at a stable message id, after that message exists. `byMe: true` is the customer; `byMe: false` is the company. Use a classic tapback type or `custom` with `emoji`. Time the add, replacement, or removal deliberately. [examples/typing-reactions.flow.json](../../../examples/typing-reactions.flow.json) is the small runnable pattern for typing and reactions. Keep using the walkover file below for the command cookbook.

Author the useful iOS surface with canonical events. Examples: react to m4 with love, reply to m2, open thread m2, long-press m5, open image m7, play audio m8 at 2.4 seconds, open the effects picker on the Screen tab, send m9 with confetti, open the plus menu, enter selection, swipe to reveal timestamps, and navigate to the Messages list. The checked-in conversation `scenarios/ios-surface-ios-light.json` is the full sequence, including read time, quoted reply, rich link image, attachment href, image viewer, edit, Undo Send, photo picker, and the return to the conversation. Do not author `tail`, `gapBefore`, or pixel positions.

Contact supports name/initials, not a logo field. The current flow has no conversation-wallpaper or outer-presentation-background field. Keep prepared branding assets separate from claims that they were applied. Do not inject CSS/DOM overrides or new schema keys.

## 2. Author one file per conversation

Match `DemoFlow` plus optional CLI `targets` and `checkpoints`. Start from the existing [agent walkover example](../../../examples/agent-walkover.flow.json), not a second copied example in this skill. Save new flows as `scenarios/<company>-<use-case>.json`. Give each flow a unique ID. The current built-in scenario loader only reads JSON directly inside `scenarios/`.

`targets` chooses platform variants of one flow. It does not define multiple conversations. Use one flow file per story. For several stories repeat this workflow sequentially, with independent preview processes and output directories. Do not mount multiple players behind the single `window.IMESSAGE_DEMO` controller.

Local images belong in `public/demo-assets/<company>/` and use `/demo-assets/<company>/<file>` paths. Preflight accepts PNG, JPEG, GIF, and WebP; SVG needs conversion to a supported image format without redrawing the logo. Preserve supplied assets and their order. Remote media and filesystem paths outside this root are not supported. A displayed `link.url` is label data, not permission to fetch during rendering. Keep provenance/research notes outside the flow JSON.

Playback time is `message.atMs - firstMessage.atMs`. Checkpoints use that relative clock. Do not confuse display timestamps with playback delays. The example reply begins at 1000 ms; 1690 ms is after its 690 ms outgoing arrival. A checkpoint at message arrival is not proof of settled motion. Use reading-length pauses, inspect transitions, and place proof checkpoints after the intended content settles and within compiled duration.

## 3. Validate and compile

These runnable commands use the checked-in example. Replace `FLOW`, `OUT`, and checkpoint IDs for a real company flow. Choose a fresh output directory for each run so stale manifests/captures cannot be mistaken for success.

```sh
FLOW="examples/agent-walkover.flow.json"
OUT="artifacts/agent-walkover/$(date +%Y%m%dT%H%M%S)-$$"

npm run demo -- validate "$FLOW" --json
npm run demo -- compile "$FLOW" --json --out "$OUT/compiled"
```

Compilation writes deterministic artifacts after validation. Exit codes are `0` success, `1` usage, `2` validation/unsupported features, and `3` assets/environment/browser. `--platform` must be a declared target; specify it when previewing or capturing each requested variant.

## 4. Preview

In a long-running terminal/session, use the real flow path:

```sh
npm run demo -- preview examples/agent-walkover.flow.json --json --platform ios
```

With no port specified the server selects an available port. CLI JSON returns the actual bound URL; do not invent one. An explicit `--port` already in use fails instead of attaching to another server. Keep the owning process alive. `IMESSAGE_DEMO_PREVIEW_ONCE=1` closes it and must not be used for a persistent handoff.

Preview displays player controls. Before calling a demo ready, open that preview and check Play, Pause, and Reset. Typing dots should move while Play is running, stop when typing turns off, and hold still on Pause. Seek and Reset must show the authored state. For screen recording, crop to the Messages frame as needed; there is no documented clean/fullscreen CLI flag. A server-ready response alone is not visual or playback verification.

```sh
npm run demo -- validate examples/typing-reactions.flow.json --json
```

## 5. Capture and inspect

Run captures in a separate terminal/session; set `FLOW` and `OUT` there too. Each invocation selects one declared platform, not all `targets`. Repeat explicitly for macOS when requested.

```sh
FLOW="examples/agent-walkover.flow.json"
OUT="artifacts/agent-walkover/$(date +%Y%m%dT%H%M%S)-$$"

npm run demo -- capture "$FLOW" --json --platform ios --at-ms 0 --out "$OUT/opening"
npm run demo -- capture "$FLOW" --json --platform ios --at-ms 1690 --out "$OUT/settled"
npm run demo -- capture "$FLOW" --json --platform ios --checkpoint after-reply --out "$OUT/checkpoint"
npm run demo -- capture "$FLOW" --json --platform ios --frames --interval-ms 500 --out "$OUT/frames"
```

Named checkpoint IDs must exist in the actual flow. The commands above refer to the walkover example. Captures contain `[data-demo-frame]` only, not player controls or an outer background. Device scale is 2; manifests record revision-specific `IMESSAGE_DEMO.ready` receipts and the rendering environment. Frame sampling produces PNGs, not an MP4 or a live screen recording.

Inspect opening, proof/final, and changed-transition images for direction, company name, wrapping, clipping, scroll position, media order, crops, and old-brand remnants. Correct data/assets and capture again. If the issue requires renderer changes, report it instead of silently expanding the task. Follow Photon Demo Creator's HTML review and handoff after rendering. Do not label an uninspected render approved.

On failure, inspect the error/`failure.json` and use a fresh output directory when retrying. Never report a pre-existing success manifest as this run's output. Do not turn an unavailable browser into a successful capture claim.

## 6. Handoff and optional publishing

Return the exact flow paths, produced PNG/manifest paths, and actual running preview URLs. Identify each use case and state what was visually/playback checked. Report prepared versus applied branding and any unsupported required feature. A preview is not a phone number, a PNG sequence is not a video, and local output is not publication.

Publishing requires an explicit request, an authorized identifiable target, and an export artifact the actual tool supports. This CLI has no publish or MP4 command; the development manifest middleware is not a static export. Do not rebuild the frontend or provision Photon to disguise an unsupported deliverable.

For changes to these instructions, run `node scripts/check-demo-skills.mjs`; it checks documentation alignment, not native UI fidelity.
