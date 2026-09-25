export const HELP = `Usage: npm run demo -- <command> [file] [options]

Commands:
  capabilities   Print the frozen capability manifest
  validate       Validate a demo JSON file and preflight local assets
  compile        Validate, then write deterministic compiled artifacts
  preview        Serve a local player preview and print the bound URL
  capture        Capture PNG frames through the IMESSAGE_DEMO ready API

Options:
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
  Messages list. Use the canonical events in src/contracts/index.ts. Do not author
  tail, gapBefore, or pixel positions.

Exit codes:
  0  success
  1  usage or unexpected error
  2  validation (schema, polls, unsupported features)
  3  environment (assets, port, browser)
`;

export const COMMAND_HELP: Record<string, string> = {
  capabilities: `Usage: npm run demo -- capabilities [--json]

Print the same capability manifest the compiler uses (src/contracts/capabilities.json).
`,
  validate: `Usage: npm run demo -- validate <file> [--json] [--platform ios|macos]

Load unknown JSON, reject polls and unsupported features, preflight local assets
under public/demo-assets, then validate every declared target.
`,
  compile: `Usage: npm run demo -- compile <file> [--json] [--out <dir>] [--platform ios|macos]

Validate, then write deterministic compiled artifacts. Nothing is written on failure.
`,
  preview: `Usage: npm run demo -- preview <file> [--json] [--port <n>] [--catalogue]

Prints the real local URL only after the server is bound and the run manifest is ready.
Logs go to stderr. --json prints one ready object to stdout.
`,
  capture: `Usage: npm run demo -- capture <file> [--json] [--at-ms <n> | --checkpoint <id> | --frames] [--out <dir>] [--port <n>]

Waits on IMESSAGE_DEMO.seek/ready receipts. Screenshots [data-demo-frame] only.
A capture failure writes failure.json and does not write a success manifest.
`,
};
