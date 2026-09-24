# Agent bootstrap

Turn a request to set up this repository into a working local demo environment, then ask for the company. Execute the setup when your tools permit it; do not just give the user an installation checklist. This is an instruction-driven workflow using the existing CLI, not a new installer service or public deployment system.

## 1. Resolve the request and checkout

Use this path for setup/install/get-running requests for `tecxbro/imessagedemo`, including the README's copy-paste prompt. Do not treat the repository URL as a company brief. A read-only review or explanation stays read-only. When a company or exact transcript is already supplied, preserve it and continue into that demo after setup; do not ask for it again.

Use the user's named workspace, or a new `imessagedemo` directory in the agent's working area. If the repository is absent, use the user's existing GitHub authentication to clone it:

```sh
git clone https://github.com/tecxbro/imessagedemo.git
cd imessagedemo
```

Before reusing an existing checkout, inspect its path, remote, branch, HEAD, worktrees, and working-tree status. Preserve existing work. Fetch the current `main`; fast-forward an existing clean `main` only. Never discard/stash someone else's changes, force-push, reset a branch, or switch an active worktree just to run setup. Use a separate checkout/worktree when necessary, or report the exact conflict. Record which commit you actually set up. Do not silently use an older branch and call it current.

The agent needs terminal/filesystem execution, repository access, and network access for dependencies/browser downloads. GitHub access to a private repository is not supplied by its URL. If access or execution is missing, report that blocker without requesting pasted tokens, claiming a clone succeeded, or changing repository visibility.

## 2. Load the two included skills

Read [AGENTS.md](../AGENTS.md), [Make an iMessage demo](../.agents/skills/make-imessage-demo/SKILL.md), [Photon Demo Creator](../.agents/skills/photon-demo-creator/SKILL.md), and its [HTML workflow](../.agents/skills/photon-demo-creator/references/html-renderer.md). For setup, use the renderer skill only for its environment and supplied-example commands; do not enter company research or route back into this bootstrap recursively.

Both complete skill folders are already in `.agents/skills/`. Keep them together with their `agents/` metadata and `references/`. Do not create a third skill, copy only the top-level Markdown file, or rewrite the bundled skills during installation.

For Codex, repository skills are discovered from `.agents/skills/` inside the checkout. Work from the checkout and verify the loaded file paths, particularly if an older global skill has the same name. With another agent or a session whose picker has not refreshed, read the repository `SKILL.md` files directly; report that mode accurately instead of claiming a native picker registration. Reopen the project/session only when needed. See the [official skill discovery documentation](https://developers.openai.com/codex/skills/).

Do not overwrite personal/global skill folders. The default setup makes the skills available in this project; it is not an installation into the user's home directory. An explicit separate request to install them globally requires comparing/backing up the target and preserving both folders and their cross-links. No `photon-cli`, `spectrum`, or `brand-mini-app` installation is needed here.

## 3. Install and check the locked environment

Inspect `node --version`, `npm --version`, `package.json`, and `package-lock.json`. Use a Node version compatible with the locked packages. Existing toolchain reports are historical evidence, not permission to upgrade dependencies. If a compatible runtime is missing, use an already available user-managed runtime where authorized, or report the prerequisite. Do not change system-wide runtimes, run privileged OS installs, or upgrade dependencies silently.

For a fresh checkout, run:

```sh
npm ci
npx playwright install chromium
node scripts/check-demo-skills.mjs
node scripts/check-agent-bootstrap.mjs
npm run build
```

For an existing setup, reuse verified matching dependencies/browser instead of reinstalling without need. Stop on a failed required command; preserve logs and report the actual error. Never replace the lockfile, substitute unavailable package versions, or bypass a failing check to manufacture success. Browser OS dependencies that require extra privileges are a separate prerequisite. No credentials for a messaging provider are required.

## 4. Verify the supplied example

Follow the [renderer skill's command cookbook](../.agents/skills/make-imessage-demo/SKILL.md). Use `examples/agent-walkover.flow.json` unchanged. Inspect capabilities, validate, compile, preview explicitly on iOS, and capture the opening at 0 ms and the settled state at 1690 ms into a fresh `artifacts/setup/<run-id>/` output tree. These times belong to this supplied example, not arbitrary future company demos. Confirm its checkpoint timing has not changed.

Keep the preview in its own persistent terminal/session; run capture from a separate session. Leave the port unspecified so the existing CLI chooses a free one. Do not use the one-shot preview environment option, kill unrelated processes, or launch duplicates of a positively identified healthy preview just to repeat setup. Record the actual URL, checkout, selected example, and owning process/session.

Inspect the fresh opening and settled PNGs. Check that the Messages frame renders, incoming/outgoing text is on the intended sides, the reply is present in the settled image, and the composer/viewport are not clipped. Open the preview and test Play, Pause, and Reset. CLI success, visual inspection, and playback verification are separate checks; record any missing one instead of treating it as passed.

Keep an `artifacts/setup/<run-id>/setup-notes.md` receipt with the checkout/commit, actual command results, loaded skill paths, preview URL and process/session, capture/manifest paths, and checks actually observed. This is an internal receipt, not a new renderer schema. Do not commit setup artifacts, modify source/fixtures/skills, or push changes as part of ordinary installation.

## 5. Hand off a reachable local preview

On the user's machine, return the actual local preview URL and keep its owning process running. In a remote agent environment, a loopback URL alone is not a usable handoff to the user. Use the environment's existing authorized private preview/port-forwarding mechanism when available and verify the returned route reaches this preview; do not open a public tunnel or expose a Vite development server to the internet as an improvised deployment. If reachability or persistent process support is missing, report that limitation and the available captures/restart instructions rather than promising a running accessible preview.

A setup request authorizes local dependency/browser installation and sample preview/capture work, not cloud hosting, paid resources, a Photon project, a phone number, or live message sending. An explicit request for public hosting is a separate operation: identify a supported export and authorized target first. Do not call `npm run build` or a development URL a published company demo.

## 6. Finish with the company invitation

Only after dependencies, the build, sample validation/capture, image inspection, playback, and a usable persistent preview are verified, use this compact success handoff. Replace every placeholder with the actual result; do not invent values or claim global installation:

```text
Local setup is ready.

Skills loaded from this project:
$make-imessage-demo — render, preview, and capture conversations
$photon-demo-creator — research companies and design the demos

Preview: <actual running URL>
Sample capture: <actual inspected PNG path>

hit me with a company name.
```

For a blocked or partial setup, name the failed/missing step, completed work, and the concrete prerequisite instead of sending the success template. Do not ask for a company as though setup passed. When a company or transcript is already supplied, skip the invitation and continue the existing request using the two skills.

Once a ready user replies with a company name or URL, use the included HTML workflow automatically. Do not ask them to reinstall, retag both skills, repeat the company, or write JSON. Do not redo full setup on every demo. Render only supported conversations and report preview URLs/captures; missing logo/background placement, video encoding, or public export is not supplied by these instructions.
