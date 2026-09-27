# iOS feature coverage

The pin is `https://imessage.swerdlow.dev/r/registry.json`. Polls are repository-owned (`src/components/owned/ios-poll.tsx`) because the registry has no poll item.

Authoring goes flow JSON, validation, compilation, one runtime timeline, then the iOS renderer. Playback is Play, Pause or Resume, and Replay. Interactive preview pauses, applies transcript changes as canonical events in a local session, and Replay demo restores the authored opening. Reply, copy, selection, and custom emoji controls are described in [Interactive Sunday previews](sunday-interactive-preview.md). Selection remains unavailable once a live checkout card is visible.

A one-to-one conversation is the default. Groups, polls, stickers, search, and the recorder are available when the story needs them.

## Registry items

| Item | Disposition |
| --- | --- |
| platform | Infrastructure. Platform context, not an authoring field. |
| tokens | Infrastructure. Colors, type, and bubble metrics. |
| bubble-shape | Infrastructure. Bubble geometry. |
| use-screen-space | Infrastructure. Screen-space fill. |
| message-bubble | Authorable text rows, tails, and status. |
| tapback | Reactions on message ids. Classic types and emoji. |
| tapback-details | Overlay `tapback-details`. |
| typing-indicator | Flow field `typing`, cleared by an explicit false event. |
| date-separator | Derived from message times. |
| link-preview | Kind `link`. |
| message-attachment | Kind `attachment`. |
| conversation | Shared conversation helper. Composed by the shells. |
| message-motion | Send and receive cues follow the timeline. |
| facetime-card | Kind `facetime`. Visual state only. No call is placed. |
| avatar | Contact photo, initials, or silhouette. |
| macos-window | macOS infrastructure. |
| macos-sidebar | macOS conversation list. |
| macos-header | macOS header. |
| macos-composer | macOS composer. |
| tapback-bar | Long-press picker. Scripted by the timeline. |
| context-menu | macOS catalogue-only menu. |
| message-actions | Long-press menu. Reply, copy, and select are local. Forward does not send. |
| use-long-press | Infrastructure hook used by the shell. |
| message-list | Authorable transcript, clustering, dates, typing, system rows. |
| ios-status-bar | Composed by the iOS shell. |
| ios-nav-bar | Composed by the iOS shell. Photo, initials, or silhouette. |
| ios-composer | Progressive outgoing text through `draft` events; clear at send. Incoming typing is separate. |
| ios-conversation-list | Screen `list`. Multiple conversations with stable ids. |
| ios-new-message-sheet | Screen `new-message`. iOS only. |
| palette | Infrastructure. Theme variables. |
| ios-messages-app | iOS shell. Status, nav, composer, screens, and controlled overlays. |
| macos-messages-app | macOS shell. Preserved. iOS-only kinds are rejected. |
| macos-plus-menu | macOS catalogue-only menu. |
| macos-details | macOS details. Not an iOS authoring field. |
| message-effects | Bubble effects slam, loud, gentle, invisible-ink. |
| screen-effects | Event `screen-effect`. |
| ios-effects-picker | Overlay `effects-picker` with bubble or screen tab. |
| message-reply | replyTo, reply counts, overlay `thread`. |
| message-image | Kind `image`. |
| image-viewer | Overlay `image-viewer` with index, chrome, and dismiss. |
| message-audio | Kind `audio`. Optional `src` plays in the browser. |
| message-edit | Event `edit` sets Edited. Event `remove` is Undo Send. |
| ios-details | Overlay `details` for one person. |
| group-details | Overlay `details` when the conversation is a group. |
| ios-plus-menu | Overlay `plus-menu`. Camera, Cash, and Check In do not call native services. |
| photo-picker | Overlay `photo-picker`. `library` supplies local assets. |
| sticker-picker | Overlay `sticker-picker` and sticker messages. |
| ios-select-mode | Overlay `selection`. |
| ios-search | Overlay `search`. |
| ios-swipe-times | Event `time-reveal`. |
| ios-notices | Event `notice`. |
| system-message | Kind `system` with a SystemMessage event. Not a bubble. |
| group-avatar | Participants with photos or initials. |
| audio-recorder | Overlay `recorder`. Fixture levels, no microphone. |
| index | Registry index. No source file. |

## Outgoing composer playback

The input composer represents the outgoing blue side. Use the existing `draft` timeline events to grow grapheme-safe prefixes of the next outgoing text, show its complete text before send, and set `value: ""` exactly at its arrival time. Incoming responses use separate `typing` on/off events; their text, attachment titles, and checkout labels do not belong in the composer. Explicit drafts and supplied transcript timing remain authoritative. Pause, seek, and Replay read the same deterministic draft state.

`message.atMs - (flow.startAtMs ?? firstMessage.atMs)` is the playback clock. Optional `startAtMs` is an absolute message-clock timestamp at or before the first message; an earlier value makes room for opening typing. Omitting it retains the first-message baseline. Authored message and event timestamps use the same absolute clock. Only compiled event offsets and checkpoints are relative to the baseline. Adding an authorized lead-in leaves existing authored timestamps unchanged; compilation increases their playback offsets. Increase later checkpoints by the same lead-in offset, retaining an opening checkpoint at zero.

## Polls

Repository-owned (`src/renderers/ios/poll/`), not a registry item. Kind `poll` with up to 12 options. `question` may be empty. `selectionMode` `single` replaces one person's previous option; omitted or `multiple` keeps a set of selections. Optional `voters` point at local avatar files. Events `poll-option`, `poll-vote`, and overlay `poll-details`. A `poll-vote` samples the recorded option transition from that event's time: label, widening pill, ring-to-avatar, width overshoot, then settle at 70% of the phone width. Unselected options stay within 2/5 of the phone width. Other options stay put. Replay does not double-count. The clip does not validate a creation sheet, counts, percentages, or a multi-voter layout. Examples: `examples/ios-poll.flow.json` and `examples/ios-poll-vote.flow.json`. See [docs/ios-poll.md](ios-poll.md).

## Not a rendered iMessage feature

Mini apps other than the checkout `app-card`, real FaceTime calls, Apple Cash, and payments stay outside this renderer.

## Verification

`scripts/check-ios-coverage.mjs` fails when a registry item is missing from this document or when `capabilities.json` still lists polls as unsupported.

## Playable video messages

The repository-owned iOS `video` message supports local MP4/WebM with an optional local poster. It automatically plays muted inline with the conversation timeline, pauses with the player, and restores media time on seek or Replay. It shows no “Play video” footer, elapsed-time label, scrubber, mute button, or other browser media controls, and requires no extra click. See [the video contract and checks](ios-video.md).

## Shared presentation defaults

New demos use one company/contact header name, content-sized text bubbles and the shared progressive header blur (clear below, strongest toward the top edge). Use existing schema fields and renderer styling, never company-specific CSS. A requested checkout ending keeps its card last and opens the visual Apple Pay sheet automatically during normal playback; the visible button contains only the Apple Pay mark. Exact supplied transcripts and explicit overrides take precedence. See [payment behavior](apple-pay-presentation.md) and the canonical authoring skills.

The shared header and text-bubble layout corrections are recorded in [conversation-layout.patch](../patches/imessage/conversation-layout.patch), after the interactive-preview patch. The header uses six masked backdrop layers with increasing blur radii (0.5–16 px), progressing from clear at the conversation edge to strongest at the top of the phone, plus a fading background wash behind sharp navigation content. Bubble measurement converts viewport-scaled text ranges back to CSS layout coordinates. The vendor pin remains unchanged; `verify:upstream` checks the pin plus recorded patches. These are shared implementation details, not flow fields.
