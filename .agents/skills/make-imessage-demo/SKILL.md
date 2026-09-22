---
name: make-imessage-demo
description: Author one local iMessage demo JSON file, then validate, compile, preview, and capture it with npm run demo. Use when making a Messages screenshot or checking demo-maker capabilities.
---

# Make an iMessage demo

This repo is a **local visual demo maker**. Author one JSON file. Do not write application code, a chat UI, a cloud service, or a custom Messages shell.

## 1. Look up what is supported

```sh
npm run demo -- capabilities --json
```

Use `supported` IDs only. `catalogueOnly` scenes exist in the pin but are not on the compile path. `unsupported` includes `polls` and `mini-apps`. If the human asked for a poll or mini app, **stop** and report it. Do not rewrite a poll as text.

Direction is `incoming` or `outgoing` on each message. `kind` is `text` | `link` | `attachment` | `image` | `audio`. Typing is the flow-level `typing` boolean, not a message kind.

## 2. Author one JSON file

Match `src/contracts/index.ts` `DemoFlow`, plus optional CLI fields `targets` and `checkpoints`.

```json
{
  "id": "agent-text",
  "title": "Agent text",
  "platform": "ios",
  "theme": "light",
  "contact": { "name": "Alex Morgan", "initials": "AM" },
  "nowMs": 1790008860000,
  "draft": "On my way over.",
  "typing": false,
  "screen": "conversation",
  "targets": ["ios", "macos"],
  "checkpoints": [
    { "id": "after-question", "atMs": 0 },
    { "id": "after-reply", "atMs": 1000 }
  ],
  "messages": [
    {
      "id": "in-1",
      "text": "Are you close?",
      "direction": "incoming",
      "atMs": 1790008740000,
      "status": "read"
    },
    {
      "id": "out-1",
      "text": "See you there.",
      "direction": "outgoing",
      "atMs": 1790008800000,
      "status": "delivered"
    }
  ]
}
```

Local images must be files under `public/demo-assets` and referenced as `/demo-assets/photo.png`. Do not point `images[].src` at `http(s)` URLs. A displayed `link.url` is label data only; do not fetch the destination.

## 3. Validate

```sh
npm run demo -- validate ./demo.json --json
```

Exit `0` on success. Exit `2` for schema, polls, or other unsupported features. Exit `3` for missing assets, escaped paths, or external media. `--platform ios` or `--platform macos` constrains declared `targets`.

## 4. Compile

```sh
npm run demo -- compile ./demo.json --json --out artifacts/compiled
```

Writes deterministic artifacts only after validation succeeds.

## 5. Preview

```sh
npm run demo -- preview ./demo.json --json --port 4174
```

Stdout is one ready object with the real bound URL. Logs go to stderr. If `--port` is occupied the command exits `3`; it does not attach to another server.

## 6. Capture

Clean chrome. Screenshots `[data-demo-frame]` only.

Single timestamp:

```sh
npm run demo -- capture ./demo.json --json --at-ms 1000 --out artifacts/captures/run
```

Named checkpoint:

```sh
npm run demo -- capture ./demo.json --json --checkpoint after-reply --out artifacts/captures/run
```

Logical frames (not a real-time recording):

```sh
npm run demo -- capture ./demo.json --json --frames --interval-ms 1000 --out artifacts/captures/run
```

Success prints one JSON object with `manifest` and `png` paths. Failure writes `failure.json` and does not write a success `manifest.json`. Exit `3` for browser or environment failures.

## Checkpoints and artifacts

Checkpoints are `{ "id", "atMs" }` on the authoring file. Capture records revision-specific `IMESSAGE_DEMO.ready` receipts, theme, time, digest, viewport, locale `en-US`, timezone `UTC`, reduced motion, and host/browser/font environment.

## After assembly

Preview and capture of a compiled demo need the compiler, runtime, and platform renderers merged by WT-00. This skill is the command sequence against that assembled app.
