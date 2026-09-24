# Video demos

Use this reference for photo-to-video, hiring video, avatar video, or render-purchase demos.

## Proven Teddy/Bounty pattern

The committed Teddy server in `/Users/darshan/Documents/ChatGPT/photon-travel-demo` uses a deterministic per-space state machine:

1. Start a short task/idea conversation and ask for photos.
2. Accept image attachments individually or inside a Spectrum group.
3. React to each accepted photo with `❤️` and start its read receipt concurrently.
4. After the asset gate, send a fixed preview-intro message and the supplied preview video.
5. Record the returned preview message ID and accept a heart only when it targets that preview.
6. Ask whether to generate the full video.
7. Accept a fixed positive confirmation, send the render/payment introduction, and send the live mini-app card.
8. `reset` clears phase, photo IDs, and preview ID.

The historical example used the supplied `assets/teddy/0721.mov` and a `$19.00` `/bounty` card. Those are source examples, not defaults for a new brand. Do not generate a substitute preview or claim a full video was rendered when the flow only sends a prepared asset.

## Messaging details

- Extract only image attachments; ignore unrelated group items.
- Deduplicate photo message IDs.
- Start `message.react("❤️")` and `message.read()` together so the visible reaction is not serialized behind the receipt.
- Treat a missing returned preview ID as a real targeting failure; do not accept a global heart as a shortcut.
- Long uploads may need periodic `startTyping()` refreshes (the proven interval was four seconds) and `stopTyping()` in `finally`; a one-shot `space.responding()` does not renew typing for a long upload.
- Preserve the complete asset until the provider upload finishes. A smaller preview may be used only when it is an explicit, separately validated asset.

## Group variant and failure to avoid

The Koyal variant required one photo from each of two distinct senders in an existing group before preview generation. Keep sender-aware state and deduplicate by message and sender.

Its first handler added a global iMessage-group-only gate and silently broke the existing direct-message path. Do not restrict the whole handler to groups unless the user explicitly requests group-only behavior and the focused tests cover that boundary. Shared Photon projects may reply in existing groups but cannot create the group for the user.

The Koyal `/bounty` mini-app was published separately while the server was later restored to Teddy/Bounty. Treat code identity, cloud project/number, card route, and visible mini-app brand as independent scopes during conversions and rollbacks.

## Known source baselines

- `src/teddy-flow.ts` — pure transitions and reaction matching;
- `src/teddy-message-routing.ts` — photo extraction, reactions, and reads;
- `src/index.ts` — Spectrum loop, preview upload, and app-card send;
- `assets/teddy/` — supplied video assets;
- `airial-pay-site/lib/bounty.ts` — hosted render checkout.

The Koyal source was an attempted historical variant and was not retained as the final server baseline. Rebuild its reusable behavior from the verified requirements rather than assuming those files remain in the checkout.

## Verification

Test single images, grouped images, non-image rejection, deduplication, zero-photo text, preview-send failure, exact reaction targeting, confirmation variants, reset, DM compatibility, and two-sender group gating when requested. Typecheck and inspect the actual video metadata/size. Provider acceptance does not prove visible tapbacks, typing duration, upload time, video playback, app-card rendering, or payment UI on a physical phone.
