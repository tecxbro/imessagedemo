import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const listing = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: root, encoding: "utf8" });
const blocks = listing.trim().split(/\n\n/).map((block) => {
  const record = {};
  for (const line of block.split("\n")) {
    const [key, ...rest] = line.split(" ");
    record[key] = rest.join(" ");
  }
  return record;
});

const lanes = [
  ["WT-01", "codex/wt-01-compiler", "docs/worktrees/WT-01.md"],
  ["WT-02", "codex/wt-02-runtime", "docs/worktrees/WT-02.md"],
  ["WT-03", "codex/wt-03-ios-renderer", "docs/worktrees/WT-03.md"],
  ["WT-04", "codex/wt-04-macos-renderer", "docs/worktrees/WT-04.md"],
  ["WT-05", "codex/wt-05-player", "docs/worktrees/WT-05.md"],
  ["WT-06", "codex/wt-06-cli", "docs/worktrees/WT-06.md"],
];

const report = lanes.map(([id, branch, prompt]) => {
  const match = blocks.find((block) => block.branch === `refs/heads/${branch}`);
  const worktree = match?.worktree ?? null;
  const promptPath = worktree ? path.join(worktree, prompt) : null;
  return {
    id,
    path: worktree,
    branch,
    head: match?.HEAD ?? null,
    prompt: promptPath,
    promptExists: promptPath ? existsSync(promptPath) : false,
  };
});

console.log(JSON.stringify({ report }, null, 2));
if (report.some((lane) => !lane.promptExists || !lane.head)) process.exit(1);
