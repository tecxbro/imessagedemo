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
| Catalogue, not a transcript | `tests/fixtures/catalogue-expectations.json` | FaceTime and SystemMessage stay off `message-row`. Screen effect, image viewer, and the effects picker stay catalogue-only |
| Edit / removal final state | `tests/negative/edit-removal-final.json` | Settled `EditedLabel` or absence. Not `EditableBubble` or `UndoSendPoof` |
| Reactions, replies, group | `tests/negative/reactions.json`, `invalid-reply-removal.json`, `group-chat.json` | Diagnostics. Not a plain text row |
| Polls and mini apps | `tests/negative/polls.json`, `mini-apps.json` | Unsupported. Not implementation coverage |

## Determinism

For one pinned browser, platform, and theme, these five paths must produce the same shell pixels at checkpoint `t`:

1. Fresh page seek to `t`
2. Sequential seek through earlier checkpoints, then `t`
3. Seek to the end, then back to `t`
4. Seek to `t` again
5. Reload, then seek to `t`

Compare those buffers only with each other. Do not compare Chromium with WebKit, or a macOS font with an iOS font.

Included in that matrix once the player exists: edited text, removed messages, reactions, typing, overlays, local images, the long-thread tail, and macOS conversation-switch history. The last group is blocked on the contract request: the freeze has one contact per flow, so Alex and Jordan are two files.

## Browser projects

Owned specs are `tests/e2e/replay.spec.ts`, `tests/e2e/network.spec.ts`, and `tests/e2e/agent-workflow.spec.ts`. They use source `data-slot` selectors and the shell box from `src/contracts/render-profiles.json`. Root `playwright.config.ts` still collects only `tests/foundation/shell-smoke.spec.ts`.

## Not a native gate

`vendor/upstream/lock.json` records `native-captures` as not supplied. Foundation smoke screenshots under `artifacts/foundation/` are regression shots of the stock shell. They are not Apple references and they are not scenario baselines.
