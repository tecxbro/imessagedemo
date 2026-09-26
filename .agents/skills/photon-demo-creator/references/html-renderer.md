# HTML renderer workflow

Use this reference for render-only work in `tecxbro/imessagedemo`. This is an execution adapter for Photon Demo Creator, not a new demo framework. Reuse the existing company-analysis and conversation-design approach; change the execution target from Spectrum to the repository renderer.

## Boundaries and source of truth

- Follow the target repository's `AGENTS.md`. Read [the repository renderer skill](../../make-imessage-demo/SKILL.md) before authoring. Run its capabilities command and inspect the current authoring contract when necessary. Current repository evidence controls schemas, command flags, and render support; this reference does not add features.
- Do not call Spectrum, provision a project, request an iMessage number, send messages, create a checkout, or run a live message consumer. No provider credentials are needed for this visual workflow.
- Produce conversation data and local assets. Do not modify the renderer, install another UI library, add custom message components, embed mini-apps, or render screenshots of unsupported widgets to disguise missing support. A renderer implementation change is a separate task.
- Keep playback deterministic. Conversation copy should sound like the product in iMessage. Put integration limits in the handoff, not in message bubbles. Never report that a search, generation, diagnosis, booking, or payment actually occurred when the experience only shows the conversation.
- Preserve supplied transcripts, assets, and established presentation choices. Keep unrelated files and existing demos intact. Do not edit this reusable skill library while making one company's demo.

## Choose one path

### 1. Read-only discussion

Inspect or explain only what is needed. Do not create files, start servers, run a full company-research process, or publish.

### 2. Small local edit

Use the existing demo as the source of truth. Change only the requested copy, asset, or supported presentation setting. Do not redo company analysis or rebuild the app. Validate the changed flow, capture the affected checkpoint, and inspect it. Reuse an existing preview only when its ownership and selected flow are clear. Never publish just because an asset changed.

### 3. Conversation-flow change

Read the relevant parts of [Conversation design](conversation-design.md). Edit the existing flow data, not a live handler. Record exact visible messages, direction, asset order, playback timing, and checkpoints. Preserve user-approved copy and unaffected scenes. Validate and inspect the changed moments. Do not carry over inbound-event handlers, per-`space.id` state, read/reaction API calls, upload loops, or provider retry logic.

### 4. Full new-company demo

When the company name or URL is all the user supplies, use these defaults unless existing project instructions or the request say otherwise:

- Create **three distinct conversations**, each with one narrow product thesis, rather than three paraphrases of the same story. If the user supplies a complete transcript or a count, follow it instead. Do not fabricate capabilities to fill a count.
- Use iOS conversation mode. Reuse a supplied or saved presentation style. With no style evidence, use the renderer's supported light theme; do not invent brand-specific wallpaper or palette claims.
- Keep roughly four to eight meaningful turns per conversation when appropriate. The customer's phone is the viewpoint: the customer is `outgoing`; the company is `incoming`. Default to the conversation screen. Use the renderer's existing capabilities. Do not change application code, add components, or invent fields for one company.
- Return flow files, ready preview URLs, and inspected PNGs. A recording-ready browser preview is sufficient when the user plans to screen-record. Video encoding, static packaging, and publication are separate deliverables: use them only when requested and actually supported.

#### Research and choose the story

Read [Company analysis](company-analysis.md), retaining its product research, brand provenance, evidence labels, narrow thesis, and brief. Read [Conversation design](conversation-design.md), retaining its natural opening, proof moment, media selection, concise copy, and exact visible transcript. Domain references may inform the story, but their historical Spectrum, checkout, project, number, price, and route details are not HTML defaults.

Those references were written for live Spectrum demos. In HTML mode:

- The story ends with a useful visible result or supported next step; a mini-app, purchase gate, or Apple Pay ending is not required.
- A stock link preview is a link preview, never a substitute claimed to be a functioning mini-app.
- A timeline and its checkpoints replace the executable inbound/outbound state machine. Reset means replay/reset using the existing player, not sending `reset` to a bot.
- Record the brief and assumptions in working notes. Do not impose the Spectrum new-company preflight or ask for approval of every transcript when a local build was already requested. Ask only when a material required input cannot be resolved, or the user requested an approval checkpoint.

Research current first-party product information when the transcript is not already prescribed. Collect the target user, job, natural input, recognizable output, proof moment, product voice, official assets, and why messaging helps. Preserve the Observed / First-party claim / Inferred / Unknown distinction. Do not cross account, OAuth, purchase, or other gated boundaries without authorization.

#### Prepare assets without inventing render support

Find the official logo and relevant product imagery using the company-analysis evidence order. Preserve user-supplied assets and image order. Save locally under the renderer's accepted asset root with namespaced paths. Convert an official SVG to an accepted raster format only when needed and supported by available tools; preserve the mark and aspect ratio. Do not redraw logos. Do not fetch displayed link destinations during capture.

Treat these as different roles: contact avatar, conversation wallpaper inside Messages, and presentation background outside the Messages frame. Reuse the supplied reference for the distinction. Before promising any placement, check that the current authoring schema, renderer, and capture path can actually apply it.

- If supported, wire the asset through the documented field and visually verify the placement.
- If unsupported, keep the prepared asset and report that its placement is not available. Do not invent JSON fields, inject CSS or DOM overrides, patch the renderer during a content task, or claim the asset appeared.
- For a newly authored story, choose only supported capabilities. For a required feature in an exact supplied transcript, do not silently rewrite it as text, a picture, or another interaction. Stop that affected flow, name the missing capability, and keep independent supported flows separate.

Downloaded is not applied; validated is not visually approved. An unmet required logo or wallpaper placement means the requested branded presentation is still partial, even if the underlying conversation renders.

#### Author one file per conversation

Create one authoring document per demo using the current repository schema. Reuse shared assets, but give each demo a unique ID, file path, output directory, and preview handle. Keep research and asset-provenance notes outside the flow schema unless it explicitly supports them.

For multiple demos, repeat the existing workflow sequentially by default. Use separate preview pages/servers when necessary. Do not assume several players can share one global controller. Do not build a gallery, multi-instance manager, database, or new CLI merely to render three conversations.

Set pacing deliberately. Confirm how the repository maps message timestamps to playback milliseconds; do not assume wall-clock times are independent. Checkpoints must use the actual playback clock and occur after the intended content and arrival motion are visible. Use several-seconds pacing appropriate to reading length, not a minute-long gap copied accidentally from fictional chat timestamps.

Typing and reactions are supported timeline events. Turn typing on before each company response and add an explicit typing-off event when that incoming message arrives. A later reply needs its own on/off pair. Do not leave typing on, and do not expect message arrival to clear it. Target each reaction at a stable message id that already exists, at a deliberate time. The customer owns `byMe: true`; the company owns `byMe: false`. The runnable pattern is [examples/typing-reactions.flow.json](../../../../examples/typing-reactions.flow.json). Load that executor automatically; do not ask for a second skill tag.

#### Validate, preview, capture, and inspect

Follow the validate, compile, preview, and capture sequence in [the repository renderer skill](../../make-imessage-demo/SKILL.md). That file is the sole command cookbook; do not copy a second set of flags or examples here. Return to this review step after rendering, rather than re-entering company research.

Keep flow files at `scenarios/<company>-<use-case>.json` (the current built-in scenario loader is not recursive), assets at `public/demo-assets/<company>/`, and run outputs at unique `artifacts/<company>/<use-case>/<run-id>/` paths. These are file conventions, not new JSON fields. Pass one declared platform explicitly for each preview/capture; compile targets are platform variants, not different conversations.

Use the actual preview URL returned by the command. Keep its owning session alive; run captures in another session. Starting a preview proves the server answered, not that the browser, playback, or visuals were inspected. The normal preview has controls; capture excludes them. Do not promise a clean fullscreen recording mode that the CLI does not implement. Before calling the output ready, play the preview and check Play, Pause, and Reset, including typing dots and reactions on the messages they target.

Inspect the rendered image, not only the command's exit code. Check the company name, customer/agent direction, text wrapping, media order, crops, clipped messages, scrolling, proof visibility, actual applied branding, and visible old-brand leftovers. Inspect the opening and proof/final states; add transition checks for timing changes. When playback is requested, open the preview and check play/pause/reset using the existing controls. A still image is not evidence that playback was tested.

Correct flow data or assets, rerender the affected view, and inspect again. If the problem is in renderer behavior or a missing field, report the exact limitation rather than expanding the task into implementation. Capture scope is whatever the current renderer captures: a phone-only PNG does not include an outer background just because that background appears elsewhere on the page.

### 5. Operations: preview, capture, export, or publish

Preserve the existing story when the user asks only to preview, capture, or publish it. Manage only a positively identified local preview process. Never stop unrelated processes or run a Spectrum lifecycle procedure.

A request to create a local rendered demo permits the temporary local preview/capture work needed for it, not external publication. An explicit publication request permits publication of the agreed artifact to an identifiable authorized target, but not creation of unrelated provider resources, a replacement checkout, or paid upgrades.

For `@Sites` or another publishing tool, read that tool's actual supported interface. First identify the exportable artifact and verify it locally. Publish only when the current renderer and publishing tool support that artifact. Do not assume a development-server URL or its middleware becomes a static site. Do not rewrite the renderer into a different frontend merely to publish. If packaging is missing, return the working local output and identify that precise blocker.

Do not promise MP4 output because a frame-sequence command exists. Label PNGs, sampled frame sequences, browser previews, packaged sites, hosted URLs, and encoded videos as the different outputs they are. Add no export subsystem unless separately requested.

## Verification matrix

| Changed surface | Required evidence |
| --- | --- |
| Copy or transcript | Flow validation and affected checkpoint render |
| Image asset | Local asset preflight, correct source/crop/order, inspected render |
| Supported branding setting | Correct asset visibly applied in the actual capture scope |
| Timing or playback | Correct checkpoint clock, transition inspection, play/reset check when requested |
| Multiple conversations | Unique IDs/paths/outputs, correct content in each returned preview/capture |
| Publish | Verified export artifact, authorized target, fresh hosted render |

Do not run checkout tests, provider tests, or unrelated repositories for HTML content edits. If a repository-mandated check applies, follow it. If a browser or rendering check cannot run, name that missing verification and never mark the visual output approved.

## Handoff

Return the exact produced flow paths, capture paths, working local preview URLs, and any actually verified published URL. For multiple conversations, identify the distinct use case for each. Briefly report product evidence versus invented sample data, checks actually run, assets prepared versus applied, unsupported requested features, and unverified playback/export/publishing.

No texting number, provider-delivered status, device-tested claim, checkout URL, or paid transaction is implied by an HTML render. Do not finish with only a plan when the user asked for a demo and the current renderer can produce it.
