# Agent workflow

A coding agent authors **one JSON file**, then uses `npm run demo` for capabilities, validate, compile, preview, and capture. There is no drag editor, prompt interpreter, or cloud account.

## Commands

| Step | Command |
| --- | --- |
| Capabilities | `npm run demo -- capabilities --json` |
| Validate | `npm run demo -- validate ./demo.json --json` |
| Compile | `npm run demo -- compile ./demo.json --json` |
| Preview | `npm run demo -- preview ./demo.json --json` |
| Capture still | `npm run demo -- capture ./demo.json --json --at-ms 0` |
| Capture checkpoint | `npm run demo -- capture ./demo.json --json --checkpoint after-reply` |
| Capture frames | `npm run demo -- capture ./demo.json --json --frames --interval-ms 1000` |

`--json` writes one JSON object to stdout. Preview logs to stderr. Exit codes: `0` success, `1` usage, `2` validation (including polls), `3` environment/assets/browser.

## Rules

- Incoming vs outgoing is the message `direction` field. Do not invent a second convention.
- Polls and mini apps are unsupported. Report them and keep the human copy. Do not convert a poll into plain text.
- Assets live under `public/demo-assets`. A link preview URL is not a network fetch.
- Capture uses `window.IMESSAGE_DEMO.seek` / `ready` receipts. It does not screen-record live playback.
- An explicit `--port` that is already bound is a hard failure.

The Cursor skill is `.agents/skills/make-imessage-demo/SKILL.md`.
