import { mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import type { ParsedArgs } from "@/cli/args";
import { bootPlayerHost } from "@/cli/commands/preview";
import { loadAuthoring } from "@/cli/commands/core";
import { runCaptureEngine } from "@/cli/capture/engine";
import type { CliDeps } from "@/cli/deps";
import { writeJson, writeLine } from "@/cli/deps";
import { CliError, EXIT_ENVIRONMENT, EXIT_OK, EXIT_USAGE } from "@/cli/errors";
import { registerCleanup } from "@/cli/cleanup";

export async function captureCommand(args: ParsedArgs, deps: CliDeps): Promise<number> {
  const modes = [args.atMs !== undefined, Boolean(args.checkpoint), args.frames].filter(Boolean).length;
  if (modes > 1) {
    throw new CliError("Use only one of --at-ms, --checkpoint, or --frames", EXIT_USAGE);
  }
  if (!args.catalogue && !args.file) throw new CliError("Missing demo JSON file", EXIT_USAGE);

  const loaded = args.catalogue ? null : loadAuthoring(args, deps);
  const engine = deps.runCaptureEngine ?? runCaptureEngine;
  const outDir = path.resolve(args.out ?? path.join(deps.repoRoot, "artifacts/captures", `run-${process.pid}-${Date.now()}`));
  mkdirSync(outDir, { recursive: true });

  const host = await bootPlayerHost(args, deps, { clean: true });
  registerCleanup(() => host.close());

  try {
    const result = await engine({
      repoRoot: deps.repoRoot,
      origin: host.url,
      scenarioId: host.manifest.approvedScenarioId,
      platform: host.manifest.platform,
      theme: host.manifest.theme,
      outputDir: outDir,
      checkpoints: host.manifest.checkpoints,
      atMs: args.atMs,
      checkpoint: args.checkpoint,
      frames: args.frames,
      intervalMs: args.intervalMs,
      durationMs: host.manifest.compiled?.durationMs ?? 0,
    });
    if (args.json) writeJson(deps.io, { ok: true, manifest: result.manifest, png: result.samples.map((sample) => sample.png) });
    else {
      writeLine(deps.io, result.manifest);
      for (const sample of result.samples) writeLine(deps.io, sample.png);
    }
    return EXIT_OK;
  } catch (error) {
    const successManifest = path.join(outDir, "manifest.json");
    if (existsSync(successManifest)) rmSync(successManifest);
    const report = {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
      payload: error instanceof CliError ? error.payload : undefined,
    };
    writeFileSync(path.join(outDir, "failure.json"), `${JSON.stringify(report, null, 2)}\n`);
    throw error instanceof CliError
      ? error
      : new CliError(error instanceof Error ? error.message : String(error), EXIT_ENVIRONMENT);
  } finally {
    await host.close();
    rmSync(host.tempDir, { recursive: true, force: true });
    void loaded;
  }
}
