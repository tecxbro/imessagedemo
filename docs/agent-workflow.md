# Agent workflow

The agent supplies the company research and conversation. The existing renderer draws it. No additional AI service, provider account, custom Messages UI, or renderer rebuild is required for supported flows.

## Two aligned skills, one user invocation

[Photon Demo Creator](../.agents/skills/photon-demo-creator/SKILL.md) is the high-level workflow. Its [HTML adapter](../.agents/skills/photon-demo-creator/references/html-renderer.md) owns research, assets, distinct stories, defaults, and review. [Make an iMessage demo](../.agents/skills/make-imessage-demo/SKILL.md) is the executor and sole command cookbook.

In this checkout:

```text
Use $photon-demo-creator to make HTML iMessage demos for https://lovable.dev.
Choose relevant conversations, inspect the renders, and return preview URLs
and captures so I can screen-record them.
```

`$make-imessage-demo` also works: it enters the same research workflow for a company-only request. Once a brief/transcript exists, it renders without routing back. An exact user transcript is authoritative. No second tag is necessary.

The HTML adapter defaults to three distinct use cases only when no count/transcript is supplied. It uses one JSON file per conversation, shared namespaced assets, separate output directories, and independent previews. The story can end in a useful result; no mandatory checkout, mini-app, live number, or payment ending is imported from Spectrum references.

## Source of truth

Runtime code and capability output decide what can render. Both skills must use the renderer contract instead of inventing fields or flags. Prepared logos are not applied avatars; inner wallpaper and outer presentation backgrounds are different roles. The current authoring format does not expose those placements. Unsupported required interactions block only affected flows and must not be silently rewritten.

Use the executor's existing example and actual CLI commands. `targets` is for platform variants, not multiple conversations. Explicitly select the platform for each preview/capture. Inspect the opening, proof/final state, and changed transitions. Server readiness, flow validity, PNG capture, playback inspection, and publication are different checks.

Preview includes controls; captures crop to the Messages frame. PNG samples are not MP4 output. Publishing with Sites or another tool requires an explicit request plus a supported, verified export artifact and authorized target. A local development URL is not a hosted demo.

## Keep local and repository copies aligned

The two folders under `.agents/skills/` are canonical for this checkout. After pulling `main`, use these repository files directly. When an agent has loaded an older global `$photon-demo-creator`, point it explicitly at `.agents/skills/photon-demo-creator/SKILL.md` before starting.

To refresh a personal installation, first compare and back up that installation; then copy the complete repository skill folder, including `agents/` and `references/`. Keep both skill folders in the renderer checkout. Do not overwrite unrelated personal skills or assume a repository push changes files on the user's Mac. Do not maintain separately edited copies of the HTML command cookbook.

The eight supplied Spectrum reference files are preserved for the high-level skill's separate Spectrum mode. They are historical/domain context in HTML mode, not permission to use their provider operations, payment endings, project IDs, or local paths here.

## Verify instruction changes

```sh
node scripts/check-demo-skills.mjs
```

This dependency-free check verifies local documentation links, routing ownership, metadata, CLI command/flag alignment, and the checked-in example's checkpoint clock. It does not execute the renderer, prove visual fidelity, provision anything, or publish a demo. Application changes still require the repository's normal tests; company-demo creation still requires actual validation and visual review.
