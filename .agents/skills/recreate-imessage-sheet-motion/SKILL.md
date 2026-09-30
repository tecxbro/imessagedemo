---
name: recreate-imessage-sheet-motion
description: Implement and verify the shared iMessage sheet-app opening, compact transition, dismissal, and conversation/composer restoration against supplied video evidence.
---

# Recreate the sheet presentation, not a generic modal

## Read the evidence

Inspect the actual attached source recording and frame data. The supplied example files encode 30 fps at 512 × 1112; their 60-fps review exports hold each source image twice. Do not claim native 60-fps motion, exact Apple spring constants, exact blur, or hidden touch events.

Read the attached frame analysis, motion specification, measurement tracks, and acceptance checkpoints. Discover the current repository's card, host, transcript/composer, timeline, and test integration points before editing. Suggested paths in the handoff are proposals only.

## Implement the shared behavior

Separate host conversation layout, sheet geometry, content readiness, and app content. Recreate bottom-origin entry, rounded/clipped surface, loading state where applicable, expanded display, drag/collapse, compact content presentation, composer return above the panel, continued offscreen dismissal, and subsequent host restoration.

In the reference, opening includes host reflow before the dark sheet is visible, a spinner, two white blank frames, then app content. Loading timing belongs to readiness, not a mandatory universal delay. During close, “Start Game” is last visible in B n094; compact “Expand to Play” first appears in n095; the composer is visible by n102; the sheet is gone in n123; chat movement continues afterward.

Do not reverse the opening animation to obtain closing. Do not apply one scale transform to a frozen full-screen app. Do not require a compact pause or second swipe; neither is established. Use measured geometry for a deterministic fixture and explicitly chosen/tested input behavior for live interaction.

Keep the active app instance stable through presentation changes. Prevent duplicate opens and action replays. Handle canceled/interrupted motion and content readiness after dismissal. Restore draft, anchor, and focus. Provide an accessible close route and reduced-motion behavior.

## Separate app-specific content

Jump Jump's title, hero, game block bounce, “Start Game,” “Expand to Play,” underline, and footer are app-specific. Do not impose them on every company. A custom app can have no business actions. Implement shared shell behavior without automatically generating or inserting any custom app into future company-only requests.

## Validate

Compare whole-chat reference frames, including header treatment, transcript movement, composer, insets, clipping, loading/content changes, and final restoration. Test both actual interaction and deterministic fixture timing. State all remaining mismatches. Preserve existing Lightning and Apple Pay behavior.

## Repository integration and verification

Read [the implementation map and motion choices](../../../docs/imessage-sheet-apps.md). The shared surface is `src/renderers/ios/mini-app/sheet/SheetSurface.tsx`; the event-driven machine is adjacent in `motion.ts`. The host adapter uses the pinned iOS message-list and composer slots, without altering upstream files. The timeline projection is `src/runtime/sheet.ts`.

The reference fixture at `tests/e2e/fixtures/sheet-reference/index.html` uses the shared shell over `IosMessagesApp`, measured 30-fps tracks under `tests/fixtures/sheet-handoff/`, and separate fixture content. It is not the production loading clock or another conversation renderer. Reference labels/bounce remain confined to that fixture. PNGs and comparison reports go under `artifacts/sheet-reference/`.

Run `node tests/fixtures/sheet-handoff/contracts/test-sheet-app.mjs`, `npm run test:unit`, `npm run typecheck`, `npm run verify:upstream`, and the real Playwright suite. `tests/e2e/sheet-app.spec.ts` checks actual interaction; `tests/e2e/sheet-reference.spec.ts` captures every required checkpoint. Distinguish measured shell-edge residuals from font, host chrome, and app-art approximations when reporting fidelity.

The shared presentation has no visible × close button and no corner expansion button. Use the handle or Escape to dismiss, and the centered compact expansion affordance. Generated local HTML uses `/demo-apps/sheet-host.js` to preserve article scroll and hand downward body gestures to the sheet only at scroll top. Keep compact content composed and readable instead of shrinking or clipping a full scrolling article. Check the actual `SheetAppHost` through the interactive reference fixture and `sheet-live-reference.spec.ts`; a deterministic screenshot fixture alone does not prove live fidelity.
