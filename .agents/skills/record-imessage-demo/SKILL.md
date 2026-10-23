---
name: record-imessage-demo
description: Record existing local iMessage demos as complete MP4 videos. Use when the user asks to screen-record, capture video, or get recorded versions of demos; deliver one video per conversation with controls and scrollbars hidden.
---

# Record iMessage Demo

Record the actual browser playback from its opening through its final result. Deliver **one complete MP4 per requested conversation**, including its existing checkout or sheet ending. Keep excerpts and raw segments internal unless requested. If the user wants several conversations combined into one video, join them in the requested order and inspect the transitions.

This skill records existing flows; it does not research a company or rewrite its story. Use [Make an iMessage demo](../make-imessage-demo/SKILL.md) for validation, compilation and preview startup. Use [Photon Demo Creator](../photon-demo-creator/SKILL.md) only if the requested demo still needs to be authored. Keep the renderer, upstream UI, contracts, dependencies and unrelated demos intact. Recording a local visual checkout does not submit a payment.

## Choose the correct preview

Work from the repository root. Inspect the requested flow, its existing run outputs and the process serving its preview. Reuse a healthy preview that belongs to that flow. Otherwise start one through the renderer skill, keeping required company review and custom-sheet authorization arguments. Use the actual URL returned by the CLI and keep its process alive.

For CLI-authored flows, prefer the validated manifest route: the returned root URL or `/?scenario=<approved-scenario-id>`. Some raw `/?flow=` routes reject CLI-only `targets` and `checkpoints` with `UNKNOWN_FIELD`. Do not strip fields or patch the app to record them. A successful HTTP response is insufficient: require a visible `[data-demo-frame]`, `window.IMESSAGE_DEMO`, and the intended contact and content. Read `window.IMESSAGE_DEMO.state().durationMs` rather than guessing duration from absolute message timestamps.

The CLI's `capture --frames` samples PNGs at logical timestamps. It does not record animation or create an MP4. Use the bundled [browser recorder](scripts/record-demo.mjs) for real-time video.

## Record and encode

The helper needs the locked Playwright Chromium browser, Node, `ffmpeg` and `ffprobe` on PATH. Follow the renderer skill for missing Node/browser dependencies; do not upgrade packages. If ffmpeg is unavailable, report it rather than calling a WebM or PNG sequence an MP4. The helper resolves Playwright from this repository's installed `@playwright/test`.

Choose a fresh run directory and an actual preview URL:

```sh
node .agents/skills/record-imessage-demo/scripts/record-demo.mjs \
  --url 'http://127.0.0.1:5174/?scenario=approved-flow-id' \
  --out 'artifacts/company/use-case/recording-run/demo.mp4'
```

Replace the illustrative port and scenario with the identified preview. The script defaults to a single continuous take, silent H.264/yuv420p MP4 at 25 fps, and a two-second final hold. It detects iOS/macOS dimensions and theme from the frame, crops the browser viewport to that frame, hides outer playback controls and native scrollbars in the recording page, resets to zero with a revision-specific ready receipt, and runs normal playback to completion. These temporary capture styles do not change conversation layout, sheet contents or repository source.

Use `--headful` if a visible Chromium window is needed. `--hold-ms 3000` changes the final hold. `--fps 30` changes the encoded frame rate; Chromium's source video cadence may remain 25 fps. The helper records silently; it does not capture system audio. Preserve native aspect ratio by default. If explicitly asked for 1:1 or another canvas, pad the full frame during encoding rather than stretching it or cutting off the phone, and inspect the result.

For several requested demos, record each sequentially into its own run directory. Do not silently record every scenario in the repository. Keep the terminal/session alive while the recorder runs; poll long commands and report meaningful progress. Wait for browser-context closure to finalize WebM before ffmpeg conversion. Existing output files are never overwritten.

## Recover an interrupted recording

Inspect the failure and use a fresh output directory. The default Playwright waiter is 30 seconds unless the options are passed as the **third** argument: `waitForFunction(fn, arg, { timeout })`; use `undefined` for an absent argument. The bundled helper sets a duration-based timeout. Some environments have closed longer recording sessions unexpectedly; that observation does not establish a universal time limit.

For a deterministic authored timeline, retry with `--segment-ms 16000`. The helper records adjacent intervals, trims browser startup and intermediate holds, and joins them into **one** MP4. A short remainder (up to a quarter interval, capped at four seconds) is included in the preceding take to avoid reopening a settled ending in a tiny final take. Its JSON receipt records every interval and whether the result was segmented. This is an assembled recording, not a single continuous take. If the user explicitly requires one continuous take, fix/retry the continuous recorder and report a blocker if it still fails.

Fresh-page seeks can reconstruct a different scroll position, sheet state or media state. Inspect every join before accepting a segmented result. For interactive mini apps, unscripted clicks or state that cannot be restored by seek, use a continuous recording; the helper records only authored playback and cannot recreate manual actions. Do not place a segment boundary inside an opening/dismissal animation. If joins disagree, choose a stable boundary or record continuously; never hide missing content by duplicating an ending.

## Inspect and deliver

The script checks MP4 codec, pixel format, dimensions and expected duration, and writes a `.recording.json` receipt, review images and internal raw videos alongside the MP4. A successful encode is not visual approval. Inspect the returned `*-review-opening.png`, `*-review-middle.png`, `*-review-final.png` and every `*-review-join-*.png`; watch the output where timing or interaction matters. Confirm the correct identity, readable text, drafts/typing, natural scrolling, media and sheet transitions, settled ending, and absence of controls, scrollbar thumbs, startup flashes, freezes or missing content. A short settling motion at the opening must be reviewed against the intended opening.

Return the single final MP4 for each requested conversation, preferably with an inline local video preview and an absolute file link. State any material limitation, including segmented capture when relevant. Do not present a separate checkout excerpt as another demo. Local MP4 files are the deliverable; no sending, publishing or global skill installation is implied.
