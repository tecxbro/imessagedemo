# Integration log

Worktree: `/Users/admin/imessage-demo-maker-worktrees/wt-00-integration`  
Branch: `codex/wt-00-integration`  
Base tag: `imessage-demo/foundation-v1` = `9bfe884459ac0b06ca5e4a12a040e2dc985008a1`

`node scripts/create-worktrees.mjs --integration` was run from the primary repo. The script has no `--integration` flag. It ran the upstream check, then threw `Refusing to reuse existing worktree path .../WT-01`. The integration worktree was created with `git worktree add -b codex/wt-00-integration` at that tag. It was not checked out in a lane worktree.

## Lane readiness

`node scripts/report-worktrees.mjs` listed WT-01 through WT-06. WT-01..WT-05 and `codex/wt-06-qa-fixtures` each have one commit past the foundation and a handoff. Official `codex/wt-06-cli` (`/Users/admin/imessage-demo-maker-worktrees/WT-06`) is still `9bfe884` with no handoff and no diff. Its CLI work is the WT-05 commit. That empty branch was not merged.

Requested names that do not exist, and the branches that were merged:

| Requested | Merged | Implementation commit |
| --- | --- | --- |
| `codex/wt-01-schema-compiler` | `codex/wt-01-compiler` | `5cf47b2ba6f90f8543d65e6c944861f48dd89761` |
| `codex/wt-02-runtime` | `codex/wt-02-runtime` | `fdc914e3220a07c23157639890d1ce05e735450e` |
| `codex/wt-03-ios-renderer` | `codex/wt-03-ios-renderer` | `45504b8a92164ebd3f21977d528a99d5d0c65993` |
| `codex/wt-04-macos-renderer` | `codex/wt-04-macos-renderer` | `5a3c90c1f4f0078c48838074be5fd398e08a13ec` |
| `codex/wt-05-agent-tooling` | `codex/wt-05-player` | `7e5a97dd18e6169fccf1d2a4239c95c100c4b373` |
| `codex/wt-06-qa-fixtures` | `codex/wt-06-qa-fixtures` | `a3f0c9013a2653c97598411fe3d2ac0dbf44cf5c` |

## Merges

Ordinary `--no-ff` merges. No content conflicts.

| Order | Merge commit | Branch |
| --- | --- | --- |
| 1 | `e278805d7c08c6721130c90c6fcdafd1f19004fb` | `codex/wt-01-compiler` |
| 2 | `3bb38577424ebb0db8ffc9a9e04631a0011577cd` | `codex/wt-02-runtime` |
| 3 | `09144e6f13cf2e4ab48fd489f0c7e026e162c223` | `codex/wt-03-ios-renderer` |
| 4 | `4c9deab738b626f3205c550987794dfaa5834ac7` | `codex/wt-04-macos-renderer` |
| 5 | `968755a893eb01afcf8ed4cc699cb04b04ea958e` | `codex/wt-05-player` |
| 6 | `9b66f34bacc37323b2e6b69913f11638fbff86d9` | `codex/wt-06-qa-fixtures` |

`src/components/imessage/**` and `vendor/upstream/**` were not edited. Packages were not upgraded.

## Wiring after the merges

- `src/App.tsx` mounts `ShellPreview` for `/?foundation=`, `DemoPlayer` for `/?flow=`, a diagnostic for `/?flow=negative`, and `PlayerHost` when `/__demo/manifest.json` is present. Preview and capture use that same player and the iOS/macOS renderers.
- `src/cli/preview-server.ts` serves the repository root so the CLI and `npm run dev` share `src/App.tsx`.
- Image sources under `/demo-assets/` pass the compiler. `..` still fails. Corpus files and CLI preflight already used that prefix; the compiler previously rejected every leading slash.
- `--platform` that is not in `targets` is exit 2 at `/targets`. It is not compiled in place of the declared platforms.
- `capabilities.json` moves `tapback`, `reply`, and `edited` to `catalogueOnly`. The pin renders them in catalogue scenes. `DemoMessage` still rejects those fields, so they are not timeline features.
- `playwright.config.ts` keeps the foundation smoke projects and adds `*-e2e` projects for `tests/e2e`. Rationale: the assembled specs were implemented on WT-06 and the root config's `testMatch` dropped them.
- Production `NOT_IMPLEMENTED` stubs are gone from compiler, runtime, renderers, player, and CLI. `notImplemented()` remains for unused symbols. Test doubles stay in `tests/contracts`.
- `DemoPlayer` subscribes to the runtime so a seek re-renders the frame passed into both renderers. The mac renderer pauses typing-indicator dots with the same freeze delay as iOS, so fresh and sequential captures match. iOS arrival cues treat elapsed `0` as settled so a checkpoint on a message timestamp is not a one-pixel flight edge.
- Replay checks that require a transcript row run only on `screen: "conversation"`. Media image checks seek to the last checkpoint, where the image message exists.
- `capabilities.json` `ios-list` stays catalogue-only as a message kind. Its reason now says the list screen is authored with `screen: "list"` on an iOS flow.
- Capture screenshots use Playwright `animations: "allow"` so a paused send or effect stays at the requested time. `animations: "disabled"` was finishing those Web Animations and making a mid-flight PNG identical to the settled frame.
- macOS developer-limitation text stays in the DOM for tests and is clipped out of the preview layout.
- macOS readiness no longer waits forever on `img.decode()` for an image node that was replaced during seek. A pending image has 2.5 seconds, then a decode error. `ready()` uses the same bound for `img` load events so a detached image cannot hold the receipt open.

Contract files other than `capabilities.json` were not expanded. Reply, reaction, edit, removal, overlay, and multi-conversation fields stay rejected. See the lane change requests and `docs/release-report.md`.
