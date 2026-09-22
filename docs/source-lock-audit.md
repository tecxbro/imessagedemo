# Source lock audit

Pinned on 2026-09-21 from one registry response. The bytes were decoded as fatal UTF-8 and written through `scripts/pin-upstream.mjs`. Nothing was repaired.

## Pin

| Field | Value |
| --- | --- |
| URL | `https://imessage-ui.swerdlowbenjamin.workers.dev/r/registry.json` |
| SHA-256 | `0e502db26098cd3227c62bca8f1bf22629a682ede3b36a87b79829404d7914ef` |
| Bytes | 827416 |
| Items | 48 |
| Files installed | 47 |
| Encoding | UTF-8, fatal decoder, zero U+FFFD |
| Import closure | Passed. Local imports resolve inside `src/components/imessage`. The only other imports are `react` and `@/lib/utils`. |
| Lock | `vendor/upstream/lock.json` |
| Exports | `vendor/upstream/exports.json` |

`index` is a `registry:style` item with registry dependencies and no file. The other 47 items each contribute one source file under `src/components/imessage`.

## Alternate host, inspected and not installed

`https://imessage.swerdlow.dev/r/registry.json` was downloaded in the same pin run. Its SHA-256 is `a5d67edf561f04d431e1ae03af879554ac75e27b0265063b7a461049e0356391`. It is not identical. It has 55 items and 54 files. Modules present only there:

- `audio-recorder`
- `group-avatar`
- `group-details`
- `ios-search`
- `macos-details`
- `sticker-picker`
- `tapback-details`

Shared names also differ in 28 files, including `message-list`, `ios-messages-app`, `macos-messages-app`, and `message-motion`. On that host, `MessageKind` adds `"system"`, and both app prop types gain search, sticker, photo, and details fields. Those APIs are not in this freeze. The component docs still name `https://imessage.swerdlow.dev/r/{name}.json` as the install URL. This repository follows the workers.dev response named as the registry to pin, and records the divergence instead of mixing item URLs.

## Export anchors checked against the pin

`MessageKind` is `"text" | "link" | "attachment" | "image" | "audio" | "typing"`. `MessageList` rows branch to `DateSeparator`, a typing row, `LinkPreview`, `MessageImages`, `MessageAudio`, `MessageAttachment`, or `MessageBubble`.

`IosMessagesAppProps` requires `contact` and `messages`. `iosScreen` is `{ width: 402, height: 874, statusBar: 54, navBar: 94, listTop: 169.5, composer: 68, listBottom: 96 }`. `IosScreen` is `"list" | "conversation" | "new-message"`. `iosScreenTransition` is marked UNVERIFIED in the source.

`MacMessagesAppProps` requires `contact` and `messages`. `macScreen` resolves through `macWindowMetrics` to width 960, height 640, sidebar 330, plus `listTop` 84.3 and `listBottom` 58.2.

`messageMotion.send.duration` is 690 and `messageMotion.receive.duration` is 300. `ArrivalAnimation` is `{ id: string; progress?: number }`. `MotionHandle` exposes `seek`, `play`, `pause`, `cancel`, `finished`, and `animations`. `useArrivalAnimation` starts from `send.id` / `receive.id` and seeks when `progress` is set.

`MessageAudioProps` is a controlled waveform (`duration`, `position`, `playing`). `MessageImagesProps` takes `images` and `onOpenImage(index, rect)`. `ImageViewerProps` takes `photos`, `sourceRect`, `open`, and `progress`.

`ScreenEffectProps.kind` is `ScreenEffectKind` (`echo`, `spotlight`, `balloons`, `confetti`, `love`, `lasers`, `fireworks`, `celebration`). Durations live in `screenEffectDuration`. Bubble effects are `slam`, `loud`, `gentle`, and `invisible-ink`, with durations in `bubbleEffectDuration`. `SystemMessage` and `FaceTimeCard` are standalone. They are not branches of the pinned `MessageList`.

Exact numbers, file paths, and confidence labels are in `src/contracts/motion-tokens.json`, produced by parsing the export literals. The extractor does not execute the TypeScript.

## Docs

`vendor/upstream/docs` archives the harness page, both llms indexes, and the llms pages linked from `https://imessage.swerdlow.dev/llms.txt`, including the three pages named in the brief. The harness and docs URLs returned HTML. Those files are saved response bodies. They were not opened in a browser and no harness scenario was executed while pinning.

Unavailable:

- `https://imessage.swerdlow.dev/references/SPEC.md` returned 404
- `https://imessage-ui.swerdlowbenjamin.workers.dev/references/SPEC.md` returned 404
- `https://imessage.swerdlow.dev/llms/polls.txt` returned 404
- `https://imessage.swerdlow.dev/llms/mini-apps.txt` returned 404
- Native captures were not supplied
- `references/SPEC.md` is not in the registry response

## Browser evidence

Shell screenshots and Playwright results are separate from this document. They are produced by `tests/foundation/shell-smoke.spec.ts` and listed in `docs/foundation-report.json` after that command runs. A fetched HTML file is not that test.
