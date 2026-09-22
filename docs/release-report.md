# Release report

Integration branch `codex/wt-00-integration` in worktree `/Users/admin/imessage-demo-maker-worktrees/wt-00-integration`. Base tag `imessage-demo/foundation-v1` is `9bfe884459ac0b06ca5e4a12a040e2dc985008a1`. This document is committed with the assembled application. The completion message records the commit that contains it. Nothing was merged to `main` and nothing was pushed. No git remote is configured.

This repository renders a local conversation. It does not send iMessage, SMS, or RCS.

## Included commits

Implementation commits, then the no-fast-forward merges into this branch:

| Lane | Implementation | Merge |
| --- | --- | --- |
| `codex/wt-01-compiler` | `5cf47b2ba6f90f8543d65e6c944861f48dd89761` | `e278805d7c08c6721130c90c6fcdafd1f19004fb` |
| `codex/wt-02-runtime` | `fdc914e3220a07c23157639890d1ce05e735450e` | `3bb38577424ebb0db8ffc9a9e04631a0011577cd` |
| `codex/wt-03-ios-renderer` | `45504b8a92164ebd3f21977d528a99d5d0c65993` | `09144e6f13cf2e4ab48fd489f0c7e026e162c223` |
| `codex/wt-04-macos-renderer` | `5a3c90c1f4f0078c48838074be5fd398e08a13ec` | `4c9deab738b626f3205c550987794dfaa5834ac7` |
| `codex/wt-05-player` | `7e5a97dd18e6169fccf1d2a4239c95c100c4b373` | `968755a893eb01afcf8ed4cc699cb04b04ea958e` |
| `codex/wt-06-qa-fixtures` | `a3f0c9013a2653c97598411fe3d2ac0dbf44cf5c` | `9b66f34bacc37323b2e6b69913f11638fbff86d9` |

Requested names `codex/wt-01-schema-compiler`, `codex/wt-05-agent-tooling`, and `codex/wt-06-qa-fixtures` map to the branches above. Official `codex/wt-06-cli` is still the foundation commit with no handoff. Its CLI work is the WT-05 commit, so that empty branch was not merged. `node scripts/create-worktrees.mjs --integration` has no `--integration` flag and refused to recreate `WT-01`. The worktree was created with `git worktree add -b codex/wt-00-integration` at the foundation tag. Details are in `docs/integration-log.md`.

## Source and packages

`npm run verify:upstream` passed:

`{"status":"passed","source":"live","sha256":"0e502db26098cd3227c62bca8f1bf22629a682ede3b36a87b79829404d7914ef","itemCount":48,"fileCount":47}`

`vendor/upstream/lock.json` item `native-captures` is `archived: false` with reason "No native capture set was supplied. None is claimed."

Locked packages: Vite 7.3.6, React 19.3.0, TypeScript 5.9.3, Vitest 4.1.11, Playwright 1.63.0, Zod 4.6.5, tsx 4.23.15. Node v25.6.0 on darwin arm64. Playwright browsers used by the gate: Chromium 153.0.8010.12 and WebKit 26.6. Capture manifests record Chromium 153.0.8010.12. Firefox is in the Playwright pin and was not part of the e2e projects.

## Gates

`npm ci` was run in this worktree against the lockfile before the passing gate. Commands after the assembled source edits:

| Command | Result |
| --- | --- |
| `npm run verify:upstream` | passed, digest above |
| `npm run typecheck` | passed |
| `npm run test:unit` | 115 passed, 0 skipped |
| `npm run build` | passed, 173 modules, `dist/assets/index-CeIX8igM.js` |
| `npm run test:e2e` | 100 passed, 204 skipped |

The 204 e2e skips are project filters: each scenario runs only on the matching engine, platform, and theme. Foundation shell smoke, replay, network, and agent-workflow specs ran on Chromium and WebKit for the matching projects. A later macOS dark replay of `basic-macos-dark` passed after the limitation text was clipped.

Native Apple fidelity is **NOT RUN**. No native capture set was supplied, and this app's PNGs were not saved as native baselines. There is no claim of cross-OS or cross-font pixel identity.

## Workflow evidence

1. `npm run demo -- capabilities --json` lists timeline ids `text`, `link`, `attachment`, `image`, `audio`, `typing`, `emoji-only`, `status`, `service-color`, `bubble-effect`, `ios-shell`, `macos-shell`. `catalogueOnly` includes tapback, reply, edited, screen effects, FaceTime, system lines, overlays, and the `ios-list` message kind. `unsupported` is `polls` and `mini-apps`. The list screen is authored with `screen: "list"` under `ios-shell`, not as a message kind.
2. All 34 files in `scenarios/` validated with exit 0. `examples/unsupported-poll.flow.json` exited 2 with path `messages[0].kind` and message `Unsupported kind "poll"`. That command wrote no PNG and did not start a browser.
3. `scenarios/basic-ios-light.json` compiled to `artifacts/proof/compiled-basic/basic-ios-light.json`. Playback events are a message at 0 ms (`Are you close?`, incoming) and a message at 60000 ms (`See you there.`, outgoing), plus the draft `On my way over.` Duration is 60690 ms. `examples/agent-walkover.flow.json` compiled for both declared targets to `artifacts/proof/compiled-agent/agent-walkover.ios.json` and `agent-walkover.macos.json`, duration 1690 ms, checkpoints `after-question` at 0 and `after-reply` at 1000.
4. Preview is running at `http://127.0.0.1:4174/` (iOS light, `examples/agent-walkover.flow.json`) and `http://127.0.0.1:4175/` (macOS dark, `scenarios/basic-macos-dark.json`). The iOS frame shows the status bar, wrapped incoming bubble with a tail, blue outgoing bubble, and the composer draft. The macOS frame is 960×640, with the sidebar, traffic lights, dark window, tails, and composer. Seeking the macOS preview to 60000 ms returned a ready receipt for revision 1, time 60000, theme dark, platform macos.
5. Clean captures, device scale 2:
   - `artifacts/proof/checkpoint/frame.png` is 804×1748 (402×874 × 2) at checkpoint `after-reply`, receipt time 1000, theme light, platform ios.
   - `artifacts/proof/mid/frame.png` is 804×1748 at 1345 ms. It differs from the checkpoint by 20659 pixels. The frame element has no player controls.
   - `artifacts/proof/macos-dark/frame.png` is 1920×1280 (960×640 × 2) at 60000 ms, theme dark, platform macos.
   - `artifacts/proof/slam-mid/frame.png` is the iOS slam effect at 320 ms.
   Receipts match the requested revision, time, theme, and platform. The frozen `ReadyReceipt` stores a frame digest, not a source-file hash. Independently, `examples/agent-walkover.flow.json` is SHA-256 `6962a87971dcf4585793f4db3774f28207fd8f7762592e1d0a8d77fd4cf7356b`. The pin digest is the upstream digest above. This flow has no image asset.
6. E2e replay compared fresh, sequential, reverse, repeat, and reset frames for basic, long-thread, sms, media, typing-status, bubble-effects (including invisible ink), emoji, macos-jordan, ios-list, and ios-new-message on the matching Chromium and WebKit projects. Edits, reactions, removals, closing overlays, and an in-timeline macOS conversation switch are **NOT RUN**: `DemoMessage` rejects those fields, and capabilities lists them as catalogue-only. `macos-jordan-*` is a separate cached conversation, and its replay passed. It is not a live switch between two conversations.
7. `artifacts/proof/frames/` has five PNGs at 0, 500, 1000, 1500, and 1690 ms (`--frames --interval-ms 500` over duration 1690). Those timestamps are playback samples, not a screen-recording duration. 0 and 500 match (reply not yet present). 1000 matches the settled checkpoint. 1500 differs by 20476 pixels. 1690 matches the settled frame again.
8. The capture engine aborts external URLs and fails the run if any were blocked. These captures succeeded, so none were blocked. E2e `network.spec.ts` passed for link clicks and path escapes. Ready receipts match the requested revision, time, and theme.
9. `examples/agent-walkover.flow.json` was authored from `.agents/skills/make-imessage-demo/SKILL.md`, then validated, compiled, and captured with `npm run demo` and no further application edit for that file. The skill example's checkpoints sit at 0 and 1000 while its sample messages are 60 seconds apart. This proof file places the reply 1000 ms after the first message so `after-reply` shows that reply.

`artifacts/` is gitignored. The paths above are on this machine.

## Catalogue versus transcript

Timeline flows can author text, links, attachments, images, audio, typing, emoji-only messages, delivery status, service color, bubble effects, and the iOS or macOS conversation shell. iOS can also use `screen` `list` or `new-message`. Catalogue scenes still mount pinned components for tapbacks, quoted replies, edited labels, screen effects, FaceTime cards, system lines, and caller-owned overlays. Those are not timeline fields. Polls and mini apps fail validation instead of being rewritten as text.

## Remaining blockers

- Replies, reactions, edits, removals, and overlays cannot be authored on a timeline without a contract change. That change was not made.
- Native fidelity is NOT RUN.
- `codex/wt-06-cli` has no implementation commit. It was not merged.
- `scripts/create-worktrees.mjs` does not implement `--integration`.
- Capture manifests do not embed a source-file or asset digest. The frozen receipt is the frame digest plus revision, time, theme, and platform.
