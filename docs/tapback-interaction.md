# iOS tapback interaction

A scripted customer reaction plays through the ordinary flow, compiler, runtime, and iOS renderer. Play starts it. The viewer does not press the message or the heart.

The canonical recipe is [examples/ios-tapback-interaction.flow.json](../examples/ios-tapback-interaction.flow.json):

1. `overlay` long-press opens the menu.
2. A second long-press on the same message sets `selected`. That is picker feedback only. It does not add a reaction, and it does not dismiss and reopen the menu.
3. `overlay` `closed` plays the dismissal.
4. `reaction` commits the badge.

`selected` may be omitted, `null`, a classic type, or a non-empty custom emoji. Omitted keeps the previous behavior for a message that already has your reaction. `null` clears the transient choice. A value highlights that choice before the badge exists.

Company and other remote reactions stay a single `reaction` event. `byMe` decides the actor. Message direction does not. An already-present reaction does not replay this menu.

The hold while the picker sits open in the reference recording is authored time between events. Other conversations reuse the same motion tracks without copying that wait. If an exact transcript has no room for the open, hold, dismissal, and landing, report the conflict instead of clipping it.

## Motion

[src/contracts/tapback-motion.ts](../src/contracts/tapback-motion.ts) is the only clock. It does not read the wall clock. Entrance, dismissal, selection feedback, and the reaction landing durations are fitted to the 30 fps reference. They are not Apple's spring constants. A 2D recording does not establish 3D rotation. The question mark's narrowing is a fitted scale reconstruction. Recent emoji share the row entrance; their internal motion was not captured.

Dismissal fades the glyph row before the pill surface finishes contracting through a short pill, a circle, and a dot. The heart does not fly from the picker to the badge.

## Pinned UI

These four files differ from the upstream pin by [patches/imessage/tapback-interaction.patch](../patches/imessage/tapback-interaction.patch):

- `src/components/imessage/ios-messages-app.tsx`
- `src/components/imessage/message-actions.tsx`
- `src/components/imessage/tapback-bar.tsx`
- `src/components/imessage/tapback.tsx`

`npm run verify:upstream` rebuilds the pinned baseline, applies the recorded patches, and requires the result to match the installed files. The tapback patch may import `@/contracts/tapback-motion` and nothing else outside the pin. Any other drift fails.

[patches/imessage/selection-thread.patch](../patches/imessage/selection-thread.patch) is not part of this interaction. It records the selection-row changes already committed on this branch (`message-list.tsx` and `ios-select-mode.tsx`) so that difference stays reproducible instead of an ignored file. The registry, lock, and live source are unchanged.

Ordinary demo authoring does not edit these files.
