# Product-led conversation design

Use this reference after company analysis, or whenever the demo's interaction flow is not already exact. The goal is an executable state contract, not a high-level storyboard.

## Choose the interaction topology

Select the smallest proven shape that matches the product's real workflow:

- **Request -> options -> refine -> select -> mini-app:** search, travel, commerce, or recommendations.
- **Question -> snapshot -> targeted reaction -> insight -> mini-app:** health, analytics, monitoring, or status products.
- **Asset intake -> acknowledgement -> preview -> targeted reaction -> confirm -> mini-app:** creative, video, design, or content tools.
- **Details -> required file/photo -> confirmation -> mini-app:** applications, identity, intake, forms, or workflow products.
- **Multi-person asset/input gate -> shared result -> targeted reaction -> mini-app:** collaboration or group products.
- **Alert -> concise explanation -> decision -> mini-app:** operational, security, finance, or approval products.

These are interaction patterns, not industry labels. Combine them only when every extra stage improves the demo.

## Decide each messaging capability deliberately

| Capability | Use when | Avoid when |
| --- | --- | --- |
| Text | collecting intent, explaining value, confirming state | a visual object or bounded choice is clearer |
| Receive photos/files | the real workflow begins with device-captured or shared material | the asset is decorative or unrelated to the product |
| Send photos | the user must compare choices or see visual proof | text communicates the result equally well |
| Group/album | the assets form one bundle or snapshot | each item must feel like a distinct selectable message |
| Separate assets | individual timing, sender, or selection matters | a single bundle is the product object |
| Reaction | a targeted lightweight decision or tone-appropriate acknowledgement | accepting unrelated emoji globally, or reacting playfully to sensitive identity/health material by default |
| Poll | a small bounded refinement or team choice | free-form intent is required or the options are fake |
| Typing | upload, processing, or staged reveal creates a real wait | an immediate deterministic reply |
| Video/audio | the prepared artifact is itself the proof moment | it is filler or a fabricated live result |
| Mini-app | one compact action is better than chat: configure, confirm, pay, upgrade, review | before value is shown, or when plain text completes the job |

If an uploaded asset deserves acknowledgement but a heart would be off-brand or inappropriate, use a read receipt or immediate text confirmation instead. When a reaction is a control, record the exact target message ID and accepted emoji set.

## Write the executable transcript

For every turn, specify:

1. accepted inbound event and any synonyms;
2. required current state and participant/target constraints;
3. exact visible reply or asset;
4. non-blocking acknowledgement or typing effect;
5. next state;
6. retry, invalid-input, and reset behavior;
7. whether the mini-app is sent on that transition.

Use copy-pasteable inbound/outbound pairs in the rehearsal handoff. Mark non-text actions explicitly, for example `[send two photos]`, `[Love the preview]`, `[choose "cheaper" in poll]`, or `[mini-app card arrives]`.

Keep state per `space.id`. Track asset message IDs, preview IDs, sender IDs, and reaction targets only when the flow needs them. Preserve direct-message behavior when adding a group variant; shared Photon projects can respond in an existing group but cannot create the group for the user.

## Use the canonical Apple Pay ending in photon-travel-demo

For this repository, show the user the proposed transcript during the required preflight and get their corrections before implementation. Design the flow and the checkout together:

1. begin with what the real product user would naturally text, send, or react to;
2. show a deterministic, recognizable proof of product value;
3. resolve the user's choice, product guardrail, or configuration;
4. state the exact Apple Pay item, amount, and billing unit in chat;
5. require an explicit purchase confirmation targeted to that state;
6. send the canonical Apple Pay app card only on that confirmation transition;
7. prevent early, invalid, duplicate, or unrelated inputs from sending it;
8. provide a tested reset path.

Do not end with a generic review, create-team, dashboard, form, or marketing mini-app. Do not make the card itself the proof moment. Read [Canonical Sites and Apple Pay](sites-apple-pay.md) for the shared Site, route, renderer, and publication contract.

## Place the mini-app after the proof moment

The mini-app should be the next action, not a detached marketing card. Decide its moment from the product thesis:

- after a selected travel/property option: checkout or confirm;
- after a health/status insight: upgrade or deeper analysis;
- after a preview is accepted: render, purchase, or configure;
- after intake succeeds: review, pay, or continue the application;
- after an alert is understood: approve, remediate, or inspect details.

Wire the real conversation transition to `appCard(publicHttpsUrl, { live: true })`. Test that earlier, invalid, or unrelated events cannot send it. A hosted route, a local render, and an iPhone-delivered card are separate evidence tiers.

## Apply the historical lessons

- Use ordered albums for a unified visual set while retaining child IDs when each image can receive a reaction. Use separate sends only when distinct messages are part of the intended experience.
- Start photo reactions and read receipts concurrently so acknowledgements do not delay the result or mini-app.
- For long media uploads, refresh typing periodically and stop it in `finally`; one `space.responding()` call does not sustain a long typing bubble.
- Do not add onboarding steps to an explicitly asset-first flow.
- Do not make the entire handler group-only when a new group scenario is added unless the product contract truly excludes direct messages and tests prove that boundary.
- Keep messaging code, Photon project/number, hosted route, mini-app brand, and deployment state independently reversible.
