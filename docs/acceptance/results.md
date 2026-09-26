# Acceptance results

Recorded from `/Users/admin/imessage-demo-maker-worktrees/WT-06-qa` on branch `codex/wt-06-qa-fixtures`. Merge base is tag `imessage-demo/foundation-v1` (`9bfe884459ac0b06ca5e4a12a040e2dc985008a1`). No scenario baseline was written. No vendor hash was changed.

`docs/build/PROJECT.md`, `CONTRACTS.md`, `CAPABILITIES.md`, `SOURCE-AUDIT.md`, and `WORKTREES.md` are not in this repository. The freeze used here is `src/contracts/**`, `docs/source-lock-audit.md`, and `docs/build/START-HERE.md`.

## Executed

| Command | Result |
| --- | --- |
| `npm ci` | passed, 117 packages, own `node_modules` |
| `npm run typecheck` | passed |
| `npm run test:unit` | passed, 5 files, 23 tests |
| `npm run verify:upstream` | passed. `{"status":"passed","source":"live","sha256":"0e502db26098cd3227c62bca8f1bf22629a682ede3b36a87b79829404d7914ef","itemCount":48,"fileCount":47}` |
| `npm run build` | passed. `dist/assets/index-Zi4MmDXs.js` |
| `npm run test:e2e` | passed, 8/8 `tests/foundation/shell-smoke.spec.ts` |

Foundation smoke, Chromium and WebKit, iOS and macOS, light and dark:

```
✓ [chromium-ios-light] stock shell mounts
✓ [chromium-macos-light] stock shell mounts
✓ [chromium-ios-dark] stock shell mounts
✓ [chromium-macos-dark] stock shell mounts
✓ [webkit-macos-light] stock shell mounts
✓ [webkit-ios-light] stock shell mounts
✓ [webkit-ios-dark] stock shell mounts
✓ [webkit-macos-dark] stock shell mounts
8 passed (14.7s)
```

Playwright printed `NO_COLOR` / `FORCE_COLOR` warnings. The tests still passed. Screenshots from that run are gitignored at `artifacts/foundation/<project>/shell.png`. They show the stock foundation fixture, not these scenarios, and they are not native captures.

Unit tests that passed include the scenario schema check, checkpoint ids, asset IHDR and SHA-256, `buildRows` date headers and the three-message cluster, SMS and status prefixes, emoji-only, negative diagnostics, registry coverage, catalogue `NOT_IMPLEMENTED`, and the upstream hash.

## NOT RUN

Assembled specs were not collected. Root projects set `testMatch` to `foundation/shell-smoke.spec.ts`.

```
npx playwright test tests/e2e --list
Error: No tests found.
Listing tests:
Total: 0 tests in 0 files
exit 1

npx playwright test tests/e2e --reporter=line
Error: No tests found.
exit 1
```

| Spec | State | Why |
| --- | --- | --- |
| `tests/e2e/replay.spec.ts` | Historical gap | Recorded before the player seek hook. `/?flow=&t=` now renders a compiled flow. This row is not a claim that seek is missing |
| `tests/e2e/network.spec.ts` | Historical gap | Recorded before the preview route. Path escapes still surface `[data-slot="scenario-error"]` |
| `tests/e2e/agent-workflow.spec.ts` | Historical gap | Recorded before `validateDemo` and `compileDemo` were implemented. They no longer throw `NOT_IMPLEMENTED` |
| Scenario visual baselines | NOT RUN | Captured after the real renderers are on the branch. Placeholder stubs were not screenshotted |
| Native fidelity | NOT RUN | `vendor/upstream/lock.json` `unavailable[].id = native-captures`, archived false, reason "No native capture set was supplied. None is claimed." |

Replies, reactions, edits, removals, and overlays are implemented on the timeline and drawn by the iOS renderer. They are not catalogue-only. FaceTime cards and group-chat system lines remain catalogue-only. Polls and mini apps stay unsupported.

The frozen test double accepts several negative files by stripping unknown keys (`silentOnFrozenDouble: true` in `tests/negative/`). `diagnoseDemo` rejects them. Production `validateDemo` enforces the same families: it accepts a local asset path or an `https://` attachment href, and it rejects other href schemes.
