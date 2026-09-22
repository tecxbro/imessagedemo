# Agent notes

This repository is the foundation for an agent-operated visual demo maker. The pinned iMessage UI source is `src/components/imessage` and `vendor/upstream`. Do not fork it to make a lane compile.

Frozen files: `src/contracts/**`, root configs, `package.json`, and `scripts/check-upstream.mjs`. A lane that needs a contract change stops and reports it.

Lane ownership after the foundation tag:

| Worktree | Branch | Owns |
| --- | --- | --- |
| WT-01 | codex/wt-01-compiler | `src/compiler/**` |
| WT-02 | codex/wt-02-runtime | `src/runtime/**` |
| WT-03 | codex/wt-03-ios-renderer | `src/renderers/ios/**` |
| WT-04 | codex/wt-04-macos-renderer | `src/renderers/macos/**` |
| WT-05 | codex/wt-05-player | `src/player/**` |
| WT-06 | codex/wt-06-cli | `src/cli/**` |

Production entry points throw `NOT_IMPLEMENTED`. Test doubles belong in `tests/contracts`, not in `src`.

Polls, Photon mini apps, and provider accounts are out of scope. The public `imessage.swerdlow.dev` registry is larger than the pin; do not install it over `vendor/upstream`.
