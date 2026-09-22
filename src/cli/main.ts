import { installSignalCleanup, runCleanup } from "@/cli/cleanup";
import { loadDeps } from "@/cli/deps";
import { EXIT_USAGE } from "@/cli/errors";
import { runCli } from "@/cli/run";

installSignalCleanup();

const deps = await loadDeps();
try {
  process.exitCode = await runCli(process.argv.slice(2), deps);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = EXIT_USAGE;
} finally {
  if (process.env.IMESSAGE_DEMO_PREVIEW_ONCE === "1" || process.exitCode) {
    await runCleanup();
  }
}
