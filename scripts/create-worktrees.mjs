import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const parent = path.resolve(root, "..", "imessage-demo-maker-worktrees");
const tag = "imessage-demo/foundation-v1";

execFileSync("node", ["node_modules/tsx/dist/cli.mjs", "scripts/check-upstream.ts"], { cwd: root, stdio: "inherit" });

const lanes = [
  ["WT-01", "codex/wt-01-compiler", "docs/worktrees/WT-01.md"],
  ["WT-02", "codex/wt-02-runtime", "docs/worktrees/WT-02.md"],
  ["WT-03", "codex/wt-03-ios-renderer", "docs/worktrees/WT-03.md"],
  ["WT-04", "codex/wt-04-macos-renderer", "docs/worktrees/WT-04.md"],
  ["WT-05", "codex/wt-05-player", "docs/worktrees/WT-05.md"],
  ["WT-06", "codex/wt-06-cli", "docs/worktrees/WT-06.md"],
];

const created = [];
for (const [id, branch, prompt] of lanes) {
  const destination = path.join(parent, id);
  if (existsSync(destination)) {
    throw new Error(`Refusing to reuse existing worktree path ${destination}`);
  }
  execFileSync("git", ["worktree", "add", "-b", branch, destination, tag], { cwd: root, stdio: "inherit" });
  const promptPath = path.join(destination, prompt);
  if (!existsSync(promptPath)) throw new Error(`Missing prompt ${promptPath}`);
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: destination, encoding: "utf8" }).trim();
  created.push({ id, path: destination, branch, head, prompt: promptPath });
}

console.log(JSON.stringify({ created }, null, 2));
