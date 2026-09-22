import { CliError, EXIT_USAGE } from "@/cli/errors";
import type { DemoPlatform } from "@/contracts";

export type CliCommand = "capabilities" | "validate" | "compile" | "preview" | "capture" | "help";

export type ParsedArgs = {
  command: CliCommand;
  json: boolean;
  help: boolean;
  file?: string;
  platform?: DemoPlatform;
  port?: number;
  out?: string;
  atMs?: number;
  checkpoint?: string;
  frames: boolean;
  intervalMs: number;
  catalogue: boolean;
};

const COMMANDS = new Set<CliCommand>(["capabilities", "validate", "compile", "preview", "capture", "help"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") continue;
    if (token === "-h" || token === "--help") {
      flags.help = true;
      continue;
    }
    if (token === "--json") {
      flags.json = true;
      continue;
    }
    if (token === "--frames") {
      flags.frames = true;
      continue;
    }
    if (token === "--catalogue") {
      flags.catalogue = true;
      continue;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      const name = eq === -1 ? token.slice(2) : token.slice(2, eq);
      const inline = eq === -1 ? undefined : token.slice(eq + 1);
      const value = inline ?? argv[index + 1];
      if (inline === undefined) index += 1;
      if (value === undefined || value.startsWith("--")) {
        throw new CliError(`Missing value for --${name}`, EXIT_USAGE);
      }
      flags[name] = value;
      continue;
    }
    positionals.push(token);
  }

  const commandToken = positionals[0] ?? "help";
  if (!COMMANDS.has(commandToken as CliCommand)) {
    throw new CliError(`Unknown command: ${commandToken}`, EXIT_USAGE);
  }

  return {
    command: commandToken as CliCommand,
    json: Boolean(flags.json),
    help: Boolean(flags.help) || commandToken === "help",
    file: positionals[1],
    platform: parsePlatform(flags.platform),
    port: parseNumber(flags.port, "port"),
    out: optionalString(flags.out),
    atMs: parseNumber(flags["at-ms"], "at-ms"),
    checkpoint: optionalString(flags.checkpoint),
    frames: Boolean(flags.frames),
    intervalMs: parseNumber(flags["interval-ms"], "interval-ms") ?? 1000,
    catalogue: Boolean(flags.catalogue),
  };
}

function parsePlatform(value: string | boolean | undefined): DemoPlatform | undefined {
  if (value === undefined) return undefined;
  if (value === "ios" || value === "macos") return value;
  throw new CliError("--platform must be ios or macos", EXIT_USAGE);
}

function parseNumber(value: string | boolean | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(`--${name} must be a non-negative integer`, EXIT_USAGE);
  }
  return parsed;
}

function optionalString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
