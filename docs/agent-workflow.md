# Agent workflow

The agent supplies the company research and conversation. The existing renderer draws it. No additional AI service, provider account, custom Messages UI, or renderer rebuild is required for supported flows.

## Start from the GitHub link

A new user can give the repository link to a coding agent and ask it to set up the project. Follow [Agent bootstrap](agent-bootstrap.md): load the two included skills, install the locked environment, verify the supplied example, and leave a usable local preview running. Only then ask for the company name. Do not replace setup with a list of commands for the user to run when the agent can execute them.

The ready handoff lists both loaded skills and actual output paths, and ends with `hit me with a company name.` A company-only reply in that session enters the normal workflow below without another setup ceremony. If a company or transcript arrived with the setup request, proceed directly after verification. Loading repository skills is not a global installation, and local startup is not public publication.

## Two aligned skills, one user invocation

[Photon Demo Creator](../.agents/skills/photon-demo-creator/SKILL.md) is the high-level workflow. Its [HTML adapter](../.agents/skills/photon-demo-creator/references/html-renderer.md) owns research, assets, distinct stories, defaults, and review. [Make an iMessage demo](../.agents/skills/make-imessage-demo/SKILL.md) is the executor and sole command cookbook.

In this checkout:

```text
Use $photon-demo-creator to make HTML iMessage demos for https://lovable.dev.
Choose relevant conversations, inspect the renders, and return preview URLs
and captures so I can screen-record them.
```

`$make-imessage-demo` also works: it enters the same research workflow for a company-only request. Once a brief/transcript exists, it renders without routing back. An exact user transcript is authoritative. No second tag is necessary.

Shared defaults apply across companies: one header identity, natural text-bubble width and progressive header blur (clear below, strongest toward the top edge) from the renderer, and muted inline video synchronized to the conversation with no extra “Play video” footer, elapsed-time label, scrubber, mute button, or other browser media controls. Use supported fields and preserve exact supplied transcripts; do not add per-company CSS. The three skills document their respective authoring, research and visual-payment responsibilities.

The HTML adapter defaults to three distinct use cases only when no count/transcript is supplied. It uses one JSON file per conversation, shared namespaced assets, separate output directories, and independent previews. The story can end in a useful result; no mandatory checkout, mini-app, live number, or payment ending is imported from Spectrum references. When a story does end at an existing Photon checkout, the executor can embed it as an iOS `app-card` as the final message, with automatic visual sheet presentation during normal playback and an Apple Pay mark-only button for reopening after cancellation ([presentation notes](apple-pay-presentation.md)).

## Source of truth

Runtime code and capability output decide what can render. Both skills must use the renderer contract instead of inventing fields or flags. Prepared logos are not applied avatars; inner wallpaper and outer presentation backgrounds are different roles. The current authoring format does not expose those placements. Unsupported required interactions block only affected flows and must not be silently rewritten.

Use the executor's existing example and actual CLI commands. `targets` is for platform variants, not multiple conversations. Explicitly select the platform for each preview/capture. Customer messages are outgoing and company messages are incoming. Stay on the conversation screen. Turn typing on before a company reply and explicitly turn it off when that message arrives. Reactions target stable message ids. Inspect the opening, proof/final state, and changed transitions, and watch one Play click through Pause, Resume, and Replay before calling a preview ready. Server readiness, flow validity, PNG capture, playback inspection, and publication are different checks.

Preview includes controls; captures crop to the Messages frame. PNG samples are not MP4 output. Publishing with Sites or another tool requires an explicit request plus a supported, verified export artifact and authorized target. A local development URL is not a hosted demo.

## Keep local and repository copies aligned

The renderer and creator folders, plus the scoped `recreate-apple-pay` skill, under `.agents/skills/` are canonical for this checkout. After pulling `main`, use these repository files directly. When an agent has loaded an older global `$photon-demo-creator`, point it explicitly at `.agents/skills/photon-demo-creator/SKILL.md` before starting.

To refresh a personal installation, first compare and back up that installation; then copy the complete repository skill folder, including `agents/` and `references/`. Keep these repository skill folders in the renderer checkout. Do not overwrite unrelated personal skills or assume a repository push changes files on the user's Mac. Do not maintain separately edited copies of the HTML command cookbook.

The eight supplied Spectrum reference files are preserved for the high-level skill's separate Spectrum mode. They are historical/domain context in HTML mode, not permission to use their provider operations, payment endings, project IDs, or local paths here.

## Verify instruction changes

```sh
node scripts/check-demo-skills.mjs
node scripts/check-agent-bootstrap.mjs
```

These dependency-free checks verify bootstrap routing and handoff requirements as well as local documentation links, routing ownership, metadata, CLI command/flag alignment, and the checked-in example's checkpoint clock. They do not execute the renderer, prove visual fidelity, provision anything, or publish a demo. Application changes still require the repository's normal tests; company-demo creation still requires actual validation and visual review.
