# Demo server lifecycle

Use this reference for setting up, starting, switching, restarting, stopping, or ending a Photon demo server.

Here, “server” means the long-running local Spectrum message consumer, normally `bun start` with a `bun src/index.ts` child. It is separate from the Photon cloud project and the hosted mini-app.

## Establish the target

1. Read the target repository's `AGENTS.md` and inspect its start scripts, `photon.config.json`, installed Spectrum version, and provider imports.
2. Run `git worktree list --porcelain` and `git status --short --branch`. Preserve unrelated dirty files.
3. Inspect existing Bun/Spectrum processes and prove their cwd with `lsof -a -p <pid> -d cwd -Fn`. Process names alone do not establish ownership.
4. Decide from the prompt whether to start the existing configured project, replace it with a newly named project, or create an isolated sibling demo. Do not repoint a different demo merely because its config is nearby.

If the user asks only to start an existing demo, do not create another Photon project. If the user asks to switch, replace, or start a newly named project, preserve the previous cloud project and create exactly one free replacement unless cloud deletion is explicit.

## Set up and start a server

1. Load the `photon-cli` skill for cloud operations and the repository's `spectrum` skill for the installed SDK/provider contract.
2. Check the installed CLI with `photon --version`, then run plain `photon whoami`. For the known CLI 2.2.0, `photon whoami --json` is unsupported.
3. If and only if login is missing or expired, run the official device flow. Do not log out a valid session just to retest authentication.
4. For a new project:
   - use the exact user-supplied name;
   - create one free project with iMessage enabled;
   - capture only its ID from CLI output using a narrow `jq` projection;
   - update only the non-secret project ID/name in `photon.config.json` with `apply_patch`;
   - never print, store, or rotate the project secret.
5. For an existing project, verify that the authenticated account can access its configured ID and that iMessage is enabled. Configure another provider only when the project reports that platform enabled.
6. Install dependencies only when needed, preserving the repository's package manager and lockfile. Run the focused state/routing tests and typecheck before startup.
7. If a matching server is already running and the request requires replacement or restart, stop that verified server using the shutdown procedure below. Do not start a second consumer.
8. Run `bun start` as one long-running process. Require fresh output identifying the intended project and Spectrum provider startup, then confirm the parent and child processes remain alive in the target cwd.
9. For a free/shared iMessage project, resolve the owner's texting number from the project-owner record returned by `photon spectrum users list --project <id> --json`. `photon spectrum lines list` may legitimately be empty. Do not guess or reuse an old number.

When the user reports a slow live demo, inspect the current consumer output before stopping it. Separate application-side serialization—such as awaiting read receipts, reactions, or unnecessary typing controls before a reply—from a provider stream interruption or reconnect. Fix the identified application path, preserve any transient provider evidence in the handoff, then perform the same scoped restart and startup checks. A restart alone is not a latency fix.

Startup proves local credential resolution and provider initialization. It does not prove receipt of a message, card delivery, tapbacks, typing bubbles, attachments, or physical-device rendering.

## Stop or end a server

“End this demo/project” means stop its local server by default. Preserve the cloud project, project secret, config, assets, hosted mini-app, and deployment unless the user explicitly asks to change or delete them.

1. Prefer sending Ctrl-C to the known live execution session.
2. Otherwise locate the `bun start` parent and `bun src/index.ts` child. Inspect the process group with `ps` and prove the cwd of the target PID with:

   ```sh
   lsof -a -p <pid> -d cwd -Fn
````

3. Send `SIGINT` only to that verified process group:
   ```
   kill -INT -- -<pgid>
   ```
4. Wait up to 10 seconds and verify the same target processes exited. Use `SIGTERM` only if that same verified group remains alive.
5. Never use `killall bun`, an unscoped `pkill`, or a workspace-wide termination. If no matching process exists, report that the server was already stopped.
6. Do not delete the Photon cloud project as part of shutdown. Cloud deletion, secret rotation, paid upgrades, and message sends are separate actions requiring explicit authorization.

## Switch to a replacement project

When the user asks to end the current project and start a named replacement:

1. Record the current non-secret project name/ID.
2. Stop only the current checkout's local server.
3. Preserve the old cloud project.
4. Create exactly one free iMessage project with the new name.
5. Patch only `photon.config.json` project identity and validate the JSON.
6. Verify the new cloud project, start one server, and resolve the new assigned texting number.

If any step after project creation fails, reuse the created project while fixing the failure. Do not create duplicates.

## Handoff

Report:

- checkout path and demo category;
- configured Photon project name and non-secret ID;
- whether a prior local server was stopped;
- whether the new server is running;
- assigned texting number, if available;
- focused tests/typecheck and startup evidence;
- whether the old cloud project and hosted mini-app were preserved;
- that no test message was sent unless one was explicitly authorized and actually sent.

