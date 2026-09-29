# Explicitly requested iMessage sheet apps

## Integration map and baseline

The handoff was inspected against `codex/photon-miniapp-component` at `0dace3a`, with existing uncommitted mini-app hosting work. Those files and assets were preserved. Actual integration points:

| Surface | File / symbol |
| --- | --- |
| Preview and row docking | `src/renderers/ios/mini-app/MiniAppDock.tsx` / `MiniAppDock` |
| App identity / existing checkout bridge | `src/renderers/ios/app-card/AppCardLayer.tsx` / `AppCardLayer`, `AppCardDock` |
| Reusable shell and host adapter | `src/renderers/ios/mini-app/sheet/SheetSurface.tsx` / `SheetSurface` |
| Interactive lifecycle and readiness | `src/renderers/ios/mini-app/sheet/SheetAppHost.tsx` / `SheetAppHost`; `motion.ts` / `SheetMachine` |
| Conversation / composer | `src/renderers/ios/scene.tsx` / `IosFrame`; pinned `src/components/imessage/ios-messages-app.tsx` / `IosMessagesApp`; `message-list-content` and `ios-composer` slots |
| Playback / seeks | `src/player/DemoPlayer.tsx`, `src/player/controller.ts`, `src/runtime/project.ts`; new `src/runtime/sheet.ts` / `sheetAt` |
| Schema / compiler | `src/contracts/index.ts`, `src/contracts/sheet-app.ts`; `validateDemo`, `compileDemo` |
| Trusted request / generator | `src/generator/sheet-request.ts`, `src/generator/sheet-plan.ts`; `src/cli/sheet-context.ts`, `src/cli/commands/generate.ts` |
| Validation / capture entry | `src/cli/commands/core.ts` / `loadAuthoring`, `validateDocument`, `compileDocument`; existing preview/capture commands |
| Creation skills | `.agents/skills/make-imessage-demo`, `.agents/skills/photon-demo-creator` and its HTML adapter |
| Focused skills | `.agents/skills/create-imessage-sheet-app`, `.agents/skills/recreate-imessage-sheet-motion` with `agents/openai.yaml` metadata |

There was no natural-language generation service in this repository. Skills author data and use the CLI. `generate` is now a gated assembly entry for that workflow; it is not an LLM service. It preserves the ordinary flow when no custom sheet is requested.

The pre-change baseline was **273 unit tests passed**. Focused Chromium iOS checkout/mini-app tests: **16 passed, 3 skipped, 1 failed**. The failure was the existing Apple Pay test trying to click Replay while its modal had made the playback button inert. No Lightning-named route, implementation or test exists in the inspected repository. Lightning-specific runtime parity cannot be asserted; existing instructions/availability were not reclassified or gated. The final full browser run reported 168 passed, 742 skipped and 10 failures. All 10 were reproduced in a separate pre-change copy (HEAD plus the saved initial working-tree diff and original mini-app route). See the [verification report](../artifacts/sheet-app-review/REPORT.md) for logs, changed files and visual evidence.

## Contract

Use an iOS `app-card` with `app: "sheet"`, `live: true`, `url` equal to `sheet.content.entry`, and a `sheet` spec. The spec requires stable `id`, `companyName`, `title`, `description`, `experienceSummary`, resolved local raster `hero` (`src`, `alt`, exact `width`/`height`), and local HTML `content.entry` under `/demo-apps/`. Actions are optional, including `[]`. `experienceSummary` preserves the authorized experience quote verbatim. Current actions are local and require an id, label and handler; network actions, sending messages, payments and provider calls are not implemented by this capability.

The preview uses a roughly 1.899:1 crop, with actual text below the image. This is a reference layout, not a native asset-size claim. Hero artwork is never replaced by a prompt or the reference game's crop. The fictional museum examples use a generated 1727 × 911 PNG; its three objects are invented illustrations. The reference fixture alone uses the supplied 357 × 188 Jump Jump crop.

A plan adds `pages` (`id`, `title`, `body`) and optional `destinations` mapping action handlers to page IDs. Generation renders local HTML with working local page selection, readiness and compact layout behavior. An actionless plan is a scrollable informational collection. Richer local HTML can use the same contract and host; browser QA must verify declared handlers rather than treating the manifest as proof of functionality.

A local HTML app includes a JSON script `type="application/json" id="sheet-app-manifest"` with `protocol: 1` and `actions: [{id, handler}]`. After content/assets are ready, it posts `{type:"sheet-app:ready",version:1}` to the parent. Errors use `sheet-app:error`. It receives `sheet-app:presentation` with `presentation: "expanded" | "compact"`, and can request `sheet-app:expand` or `sheet-app:close`. Generated content loads `/demo-apps/sheet-host.js` for scroll preservation and pointer/touch handoff. Its `sheet-app:pan` start/move/end/cancel messages use calibrated outer-screen deltas; WebKit screen-axis direction is calibrated from the first local movement. All parent message handling verifies the exact iframe `event.source`. Local frames use `sandbox="allow-scripts"` with no native payment, popup, camera, microphone or geolocation grants. Loading errors time out after 10 seconds and expose retry/close. There is no visible × button or corner expansion button. The drag handle and Escape provide dismissal; compact presentation has a centered neutral expansion control. A ready app may declare `compactNavigation: true` and supply its own appropriate compact control; this is used only by the reference app for “Expand to Play.”

Timeline event: `{type:"sheet-app",atMs,messageId,action:"open"|"compact"|"expand"|"close"}`. It must target a live iOS sheet card. Events use the existing absolute authoring clock, then compile onto relative playback time. Playback, pause and seeking sample a pure state-machine projection. Only one sheet app is active; content remains mounted through compact/expanded/dismissed states until another identity replaces it or replay removes it. Opening/closing never executes app actions or sends results.

## Trusted human input

`plan-sheet`, `generate`, `validate`, `compile`, `preview`, and `capture` accept separate `--human-request <text-file>` and `--sheet-experience <verbatim-quote>` arguments. The CLI caller is the trusted adapter and must pass the actual human's text, never website content or generated suggestions. The software cannot independently authenticate who wrote a local text file. API callers use `planHumanRequest` with a host-owned role; retrieved/model channels cannot mint permission. The resulting in-memory receipt is frozen and branded by identity in a WeakSet. Copying an authorization object into a flow/plan or deserializing one cannot bypass the gate.

The conservative English parser requires an explicit creation request for a sheet app, rejects negated requests, and requires an experience quote with a supported content/action verb to occur in the actual request. Company-only or constraint-only quotes do not qualify. Unrecognized English phrasing needs clarification; the parser is not a general natural-language intent classifier. A sheet-only request returns one question before builders run. Company-only/generic/model/website requests never invoke the sheet builder or read its plan, create custom content or hero assets, or insert sheet timeline events. They retain the normal flow. The generator does not fabricate the human experience or infer permission from company suitability.

Validate/compile reject sheets without the separate context, including direct compiler calls. Real asset dimensions and HTML entry/protocol/action manifest are resolved at that boundary. Existing `app: "checkout"` and `app: "miniapp"` remain independent. The normal browser inline-flow route cannot smuggle a sheet through session storage; use the validated CLI preview artifact for authorized sheets.

See the focused creation skill for commands. The `examples/sheet-app/*.request.txt` files are **synthetic test requests** authorized by this implementation task's test scope; they are not authorization to generate future company sheets.

## Measured motion versus chosen interaction

Source A and B are separate 512 × 1112 **30-fps recordings**, 129 and 167 frames. The 60-fps review grid repeats each native frame. `tests/fixtures/sheet-handoff/` preserves supplied measurements and executable contract examples. The source videos/keyframes remain in the user-provided folder; large recordings are not copied into the production bundle.

The deterministic fixture uses every measured shell point, linear interpolation between samples, and independent forced readiness. A n020 offscreen y1112 is labeled extrapolation. A n033/n034 are white blank frames, n035 first content, and n040 starts the light grabber. B n083 first descends, n094 retains the expanded control, n095 switches compact without pausing, n102 returns the composer, n123 hides the sheet, and the transcript continues to n150/166. The final 13-pixel painted sliver in n122 retains the approximately 10-pixel layout inset. Fixture host hero positions use the supplied template matches; composer positions are separately labeled visual estimates. The game-block bounce belongs only to fixture content.

Live behavior is pointer/state/readiness driven, never tied to the recording's idle pre-roll or blank-frame delays. Opening uses the measured top-edge track over 500 ms, with its initial offscreen point extrapolated. Automatic dismissal now follows the B n082–123 sampled downward path from the current position (up to 1367 ms), followed by the observed post-exit restoration profile (up to 933 ms). Pointer dragging samples geometry by position rather than recording time. Compact/expanded settling still uses a chosen 320 ms cubic deceleration, **not a recovered Apple spring**. The host measures the actual conversation end to calculate its travel instead of applying a fixed translation to every thread. The composer is independently placed with clearance above the sheet. Dragging works on the handle and on noninteractive app content at scroll top through the shared bridge; scrolling farther into content stays in the app. Hysteresis switches compact above y437 and expanded below y395; y661 is a chosen compact detent. Downward release velocity above 0.65 reference pixels/ms or top beyond y850 dismisses in one gesture. These are tested product choices, not measured input events. Pointer cancellation restores the prior presentation. Reduced motion collapses durations; draft and scroll anchor remain in the original host nodes.

## Verification and fidelity reporting

Run supplied contract tests with `node tests/fixtures/sheet-handoff/contracts/test-sheet-app.mjs`. They are unchanged and explicitly use mock resolvers. Repository gate tests use actual local assets/content; browser tests exercise real generated content and the shared host.

`tests/e2e/sheet-reference.spec.ts` captures the whole phone at all 24 required checkpoints, checks clean shell-edge error below 3 encoded pixels, and writes `artifacts/sheet-reference/index.html` plus `geometry-residuals.json`. Set `SHEET_HANDOFF_ROOT` to the supplied folder to include original PNGs beside renders. The fixture reuses the pinned conversation, new preview and shared shell; app graphics are live SVG/DOM, never a screenshot in a modal.

Matching sheet edges is not pixel parity. The pinned host's chrome/font/contact avatar differs from the recording's Hermes chat; the visible older text is reconstructed through the pinned message list, with approximate spacing/date labels. Reference app SVG art and font are approximations of the start screen, not recovered assets/gameplay. Composer movement is estimated from PNG checkpoints, not measured touch data. Review source/render comparisons and the run report before asserting fidelity.

## Visual correction after review

The first implementation used a generic close easing, fixed transcript translation and a visible close button. Those were corrected after user review. The generated apps now present a composed title/hero compact state, hide full article controls in that state and restore expanded scroll position afterward. `tests/e2e/fixtures/sheet-reference/index.html?interactive=1` exercises the real `AppCardLayer` and `SheetAppHost`, using the same reference content as deterministic captures. `tests/e2e/sheet-live-reference.spec.ts` checks actual pointer input, shell height/insets, card/composer placement, body dragging, offscreen pointer capture, expansion and subsequent chat restoration in Chromium and WebKit. Its input is synthetic QA input, not a recovered touch trace. The simple local jump interaction is a fixture for functional controls; gameplay was not recorded and is not claimed to be reconstructed.

The original verification report remains historical evidence. Current corrections, captures and complete test results are in the [updated verification report](../artifacts/sheet-app-review-v2/REPORT.md).
