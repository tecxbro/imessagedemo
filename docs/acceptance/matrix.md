# Acceptance matrix

Planned coverage for the pinned demo maker. Execution state is in `docs/acceptance/results.md`. Native Apple fidelity is a separate gate and is not part of the scenario pass.

The authored flows use the frozen `DemoFlow` schema in `src/contracts/index.ts`. There is no second scenario format. Named checkpoints live in `tests/fixtures/checkpoints.json` because that schema has no checkpoint field.

| Family | Corpus | What a passing capture must show |
| --- | --- | --- |
| Basic conversation | `scenarios/basic-{ios,macos}-{light,dark}.json` | Incoming "Are you close?" and outgoing "See you there." |
| Wrapping, clusters, date gaps | `scenarios/long-thread-*` | Wrapped sentence, three-message incoming cluster, three date headers, tail row in view |
| SMS | `scenarios/sms-*` | Every message `service: "sms"`. Last outgoing label is "Sent as Text Message" |
| Link, file, photos, voice | `scenarios/media-*` | `link-preview`, `message-attachment`, local PNGs, `message-audio` |
| Typing and statuses | `scenarios/typing-status-*` | Prefixes reveal Sending (no label), Sent, Delivered, Read, then the failed badge and the typing indicator |
| Bubble effects | `scenarios/bubble-effects-*` | Rows with `data-effect` slam, loud, gentle, invisible-ink |
| Emoji-only | `scenarios/emoji-*` | `isEmojiOnly` on both messages |
| iOS list | `scenarios/ios-list-ios-*` | `screen: "list"` on iOS only |
| iOS new message | `scenarios/ios-new-message-ios-*` | `screen: "new-message"` and draft "Hi Jordan" |
| Second macOS conversation | `scenarios/macos-jordan-*` | Jordan Lee transcript. Not a switch animation |
| iOS Messages surface | `scenarios/ios-surface-ios-{light,dark}.json` | Replies, reactions, read time, rich links, attachment hrefs, image viewer, audio, long press, effects picker, confetti, edit/Undo Send, plus menu, photo picker, selection, timestamp reveal, and list / new-message / conversation navigation |
| Catalogue, not a transcript | `tests/fixtures/catalogue-expectations.json` | FaceTime stays off `message-row`. Group-chat system rows stay catalogue-only. Screen effects, the image viewer, and the effects picker are timeline overlays |
| Edit / removal final state | `scenarios/ios-surface-ios-{light,dark}.json` | Settled edited text with an edited label, then Undo Send removes the row. `tests/negative/edit-removal-final.json` still rejects a malformed final state |
| Reactions and replies | `scenarios/ios-surface-ios-{light,dark}.json` | A love tapback and a quoted reply on the timeline. `tests/negative/group-chat.json` stays a diagnostic |
| Polls | `examples/ios-poll-vote.flow.json`, `examples/ios-poll.flow.json`, `tests/negative/polls.json` | A poll in the transcript. The reference vote shows the label response, width overshoot, and settled avatar. A poll without options still fails. Mini apps other than checkout stay unsupported (`tests/negative/mini-apps.json`). |

## Determinism

For one pinned browser, platform, and theme, these five paths must produce the same shell pixels at checkpoint `t`:

1. Fresh page seek to `t`
2. Sequential seek through earlier checkpoints, then `t`
3. Seek to the end, then back to `t`
4. Seek to `t` again
5. Reload, then seek to `t`

Compare those buffers only with each other. Do not compare Chromium with WebKit, or a macOS font with an iOS font.

Edited text, removed messages, reactions, typing, overlays, and local images are in the timeline. The iOS surface scenario seeks each of those poses. A macOS conversation switch is still two files: the freeze has one contact per flow, so Alex and Jordan are `macos-jordan-*` beside the primary transcript.

## Browser projects

Owned specs are `tests/e2e/replay.spec.ts`, `tests/e2e/network.spec.ts`, and `tests/e2e/agent-workflow.spec.ts`. They use source `data-slot` selectors and the shell box from `src/contracts/render-profiles.json`. Root `playwright.config.ts` still collects only `tests/foundation/shell-smoke.spec.ts`.

## Not a native gate

`vendor/upstream/lock.json` records `native-captures` as not supplied. Foundation smoke screenshots under `artifacts/foundation/` are regression shots of the stock shell. They are not Apple references and they are not scenario baselines.
