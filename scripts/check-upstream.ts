import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decodeUtf8, verifyWorktree } from "../src/foundation/upstream-pin.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureFlag = process.argv.indexOf("--test-registry-file");

if (fixtureFlag !== -1) {
  const fixturePath = process.argv[fixtureFlag + 1];
  if (!fixturePath) {
    console.error("--test-registry-file requires a path");
    process.exit(2);
  }
  const bytes = await readFile(path.resolve(fixturePath));
  decodeUtf8(bytes, fixturePath);
  JSON.parse(decodeUtf8(bytes, fixturePath));
  console.error("fixture pin cannot pass the worktree creation gate");
  process.exit(3);
}

const result = verifyWorktree(root);
if (result.status === "fixture") {
  console.error(result.message);
  process.exit(3);
}
if (result.status !== "passed") {
  console.error(result.message);
  process.exit(1);
}
console.log(JSON.stringify({
  status: "passed",
  source: result.lock.source,
  sha256: result.lock.sha256,
  itemCount: result.lock.itemCount,
  fileCount: result.lock.fileCount,
}));
