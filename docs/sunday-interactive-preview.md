# Interactive Sunday previews

The three Sunday stories retain their quoted replies, official logo, proof images, and $5 tip ending. Playback now shows the full long-press reaction sequence: a heart for dinner, ☕ for espresso, and 🧦 for laundry. Each outgoing blue text message is typed into the input field before it sends, and the field clears at that exact send time. A four-second opening lead-in also types the first message; the tip card remains last. Incoming typing dots represent Sunday and never place company text in the composer. Pause, seek, and Replay preserve the same draft/send timing.

Press Play to watch, or hold a text message to explore. Holding pauses playback. The menu supports:

- Reply: shows the quoted context above the composer; sending adds an outgoing reply to the local conversation. Reply counts open the existing thread view.
- Copy: writes the selected text to the browser clipboard. A status message reports success or blocked clipboard access.
- Select: selects messages before the tip card is visible; use the circles to change the selection and the close button to exit. The existing live-card guard still applies after the checkout appears.
- Reactions: use the native classic tapbacks, recent emoji, or the emoji button for additional emoji. Choosing an existing reaction again removes it.

The preview API also clears transient menus on seek and restores the source timeline on reset. Replay demo discards local edits and restarts the authored conversation. Local sends, reactions, and deletions become canonical timeline events in an in-memory compiled copy; the flow file is never rewritten. Menus, reply composition, and the emoji dialog are temporary UI state. These controls are enabled in normal iOS previews and disabled for deterministic captures. macOS is unchanged. No message is delivered, and the Apple Pay sheet remains visual-only.

## Implementation

`src/player/interactive-preview.tsx` connects the existing shell controls. `DemoPlayer` owns the temporary compiled timeline and replay reset. `IosFrame` passes the interactive shell overrides and composes its transient overlays alongside the existing checkout host.

The original upstream registry is unchanged. `patches/imessage/interactive-preview.patch` only exposes optional menu items and the emoji callback on `IosMessagesApp`, forwarding them to its existing `MessageActions`. `verify:upstream` applies this after the existing patches and checks the exact installed result.

The browser regression in `tests/e2e/sunday-interactions.spec.ts` exercises actual pointer holds, clipboard behavior, local replies, threads, selection, classic/custom reactions, replay reset, and the retained tip sheet. The authored reaction sequence remains covered by the existing timeline and tapback tests.

## Run

Use the commands in [Sunday tipping](sunday-tip-demo.md). The existing previews use ports 5174 (dinner), 5175 (espresso), and 5176 (laundry).
