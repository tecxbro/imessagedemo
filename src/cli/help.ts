export const HELP = `Usage: npm run demo -- <command> [file] [options]

Commands:
  plan-sheet     Gate the separate human request before sheet generation
  generate       Assemble an ordinary flow and an authorized optional sheet plan
  capabilities   Print the frozen capability manifest
  validate       Validate a demo JSON file and preflight local assets
  compile        Validate, then write deterministic compiled artifacts
  preview        Serve a local player preview and print the bound URL
  capture        Capture PNG frames through the IMESSAGE_DEMO ready API

Options:
  --company-review <file>   Company avatar/receipt preflight (validate/compile/preview/capture)
  --human-request <file>    Actual human input, separate from generated app data
  --sheet-experience <quote> Verbatim intended experience from that human input
  --sheet-plan <file>       Company-specific app/pages/optional local actions
  --json              Write one JSON object to stdout
  --platform <name>   Constrain validation/compile to ios or macos
  --port <n>          Bind exactly this port; fail if it is occupied
  --out <path>        Artifact directory
  --at-ms <n>         Capture a single logical timestamp
  --checkpoint <id>   Capture a named checkpoint
  --frames            Sample fixed logical timestamps (not a real-time recording)
  --interval-ms <n>   Frame sampling interval (default 1000)
  --catalogue         Preview/capture the finite catalogue route
  -h, --help          Show this help

Authoring:
  React to a message, reply to one, open its thread, long-press it, open an image,
  play an audio message at a position, open the effects picker, send with confetti,
  open the plus menu, enter selection, swipe to reveal timestamps, and move to the
  Messages list. An iOS poll is kind "poll" plus a poll-vote event
  { messageId, participantId, optionId, voted } at the moment the option should respond.
  Use the canonical events in src/contracts/index.ts. Do not author
  tail, gapBefore, or pixel positions.

Exit codes:
  0  success
  1  usage or unexpected error
  2  validation (schema, malformed polls, unsupported features)
  3  environment (assets, port, browser)
`;

export const COMMAND_HELP: Record<string, string> = {
  capabilities: `Usage: npm run demo -- capabilities [--json]

Print the same capability manifest the compiler uses (src/contracts/capabilities.json).
`,
  validate: `Usage: npm run demo -- validate <file> [--json] [--platform ios|macos] [--company-review <file>]

Load unknown JSON, reject malformed polls and unsupported features, preflight local assets
under public/demo-assets, then validate every declared target.
With --company-review, also require the company avatar and outgoing Delivered → Read
transitions, except documented user/transcript exceptions. This is not visual approval.
`,
  compile: `Usage: npm run demo -- compile <file> [--json] [--out <dir>] [--platform ios|macos] [--company-review <file>]

Validate, then write deterministic compiled artifacts. Nothing is written on failure.
`,
  preview: `Usage: npm run demo -- preview <file> [--json] [--port <n>] [--catalogue] [--company-review <file>]

Prints the real local URL only after the server is bound and the run manifest is ready.
Logs go to stderr. --json prints one ready object to stdout.
`,
  capture: `Usage: npm run demo -- capture <file> [--json] [--at-ms <n> | --checkpoint <id> | --frames] [--out <dir>] [--port <n>] [--company-review <file>]

Waits on IMESSAGE_DEMO.seek/ready receipts. Screenshots [data-demo-frame] only.
A capture failure writes failure.json and does not write a success manifest.
`,
};
