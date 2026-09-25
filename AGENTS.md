# Agent notes

This is an assembled studio for making any product feel like itself in iMessage, not a messaging provider. The app entry is `src/main.tsx` -> `src/App.tsx`. Use the pinned source in `src/components/imessage` and `vendor/upstream`; do not replace or silently patch it to make a conversation render.

## First-run setup

For a request to set up, install, clone, or get this project running for demo creation, follow [Agent bootstrap](docs/agent-bootstrap.md) before company research. A request that supplies this repository for setup is not a request to make a demo about this repository. Do not ask for a company name before setup is verified. Load both existing skills; do not generate another skill or overwrite personal/global skill folders.

A repository link plus a read-only review/question remains read-only. If the user already supplied a company or transcript along with setup, finish the necessary setup and continue that task without asking again. Otherwise, after the required checks pass, report the loaded skills and real preview/capture paths, then end with `hit me with a company name.` Missing tools, access, dependency downloads, capture, or preview reachability are blockers/partial results, not permission to claim readiness.

## Skills and ordinary demo work

The canonical skills are versioned together in this repository:

- [Photon Demo Creator](.agents/skills/photon-demo-creator/SKILL.md) owns company research, story selection, asset preparation, conversation defaults, and visual review.
- [Make an iMessage demo](.agents/skills/make-imessage-demo/SKILL.md) owns schema/capabilities and the validate, compile, preview, and capture commands.

Either tag is sufficient. Company-only requests enter research once, then render. Exact transcripts and existing flows go straight to rendering; do not loop between skills. Prefer repository copies over stale globally installed copies. [Agent workflow](docs/agent-workflow.md) explains usage and synchronization.

A request to make a company demo authorizes flow data, local assets, and the preview/capture work needed to inspect them. It does not authorize changing application code, contracts, dependencies, upstream components, provider resources, or publishing. Preserve unrelated files and demos. Use only supported capabilities; do not disguise unsupported interactions as images or text. This repo stays render-only even if a global skill also documents Spectrum.

Create one flow per conversation with unique IDs and run outputs. Use the existing commands repeatedly, not a new generator service or multi-player framework. Follow the high-level skill's HTML defaults only when the user has not supplied a count, transcript, or style. Do not claim logo/background placement without a supported field and inspected output.

## Implementation work

For explicitly requested implementation or skill-maintenance tasks, inspect the branch/base, working tree, and current source first. Scope changes to the request and preserve unrelated work. Foundation-era frozen-contract and lane instructions describe the original build; they do not mean the assembled application still throws `NOT_IMPLEMENTED`. Ordinary demo authoring still must not change those contracts. Any later contract or upstream change requires explicit implementation scope and matching tests/docs.

Historical lane ownership:

| Worktree | Branch | Owns |
| --- | --- | --- |
| WT-01 | codex/wt-01-compiler | `src/compiler/**` |
| WT-02 | codex/wt-02-runtime | `src/runtime/**` |
| WT-03 | codex/wt-03-ios-renderer | `src/renderers/ios/**` |
| WT-04 | codex/wt-04-macos-renderer | `src/renderers/macos/**` |
| WT-05 | codex/wt-05-player | `src/player/**` |
| WT-06 | codex/wt-06-cli | `src/cli/**` |

Run checks appropriate to the changed surface. For skill/docs alignment, run `node scripts/check-demo-skills.mjs` and `node scripts/check-agent-bootstrap.mjs`; this is not a substitute for flow validation, browser review, or application tests. Preserve test doubles in tests, not production source.

Polls, Photon mini apps, and provider accounts remain out of scope. The public `imessage.swerdlow.dev` registry is larger than the pin; do not install it over `vendor/upstream`. Historical release/handoff reports are evidence from their recorded run, not fresh test results.
