# Contact profile pictures

Use `contact.photo` with a local PNG, JPEG, GIF, or WebP path under `/demo-assets/`. Omit it to retain the existing initials fallback. The current feature-exposure branch already preserves this field in the compiler/runtime and renders it through the native iOS shell. CLI preflight checks contact photos, including seeded conversation contacts, before preview or compilation.

The Sunday demos use this existing API. They do not require `avatarSrc`, custom avatar slots, or an additional upstream patch. Single-contact photos are shown in the conversation header; the registry conversation-list row still uses initials. Existing dimensions, circular clipping, animation, and interactions stay owned by the pinned UI.

`public/demo-assets/sunday/avatar.png` uses the official mark from Sunday’s homepage, preserving its SVG path, centered on a 256-pixel brand-yellow square (`#f7e731`). The mark is about 154 pixels wide so the circular crop leaves padding. Each Sunday conversation uses the same avatar and `m3.replyTo: "m2"`, with the settled `quoted-reply` checkpoint at 9690 ms. The $5 tipping ending uses the existing checkout and Apple Pay presentation.
