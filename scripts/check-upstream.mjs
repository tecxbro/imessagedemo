import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureFlag = process.argv.indexOf("--test-registry-file");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} is not clean UTF-8: ${error.message}`);
  }
}

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

const lock = JSON.parse(await readFile(path.join(root, "vendor/upstream/lock.json"), "utf8"));
if (lock.source !== "live") {
  console.error(`upstream pin source is ${lock.source}; a fixture pin cannot pass`);
  process.exit(3);
}

const registryBytes = await readFile(path.join(root, "vendor/upstream/registry.json"));
const digest = sha256(registryBytes);
if (digest !== lock.sha256) {
  console.error(`registry digest mismatch: ${digest} !== ${lock.sha256}`);
  process.exit(1);
}
const registryText = decodeUtf8(registryBytes, "vendor/upstream/registry.json");
if (registryText.includes("\uFFFD")) {
  console.error("registry contains U+FFFD");
  process.exit(1);
}
const registry = JSON.parse(registryText);
const files = [];
for (const item of registry.items) {
  for (const file of item.files ?? []) files.push(file);
}
if (files.length !== lock.fileCount || registry.items.length !== lock.itemCount) {
  console.error("lock counts do not match the registry");
  process.exit(1);
}

const targets = new Set(files.map((file) => file.target));
for (const file of files) {
  const onDisk = await readFile(path.join(root, "src", file.target), "utf8");
  if (onDisk !== file.content) {
    console.error(`installed source drifted: ${file.target}`);
    process.exit(1);
  }
  for (const match of file.content.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = match[1];
    if (spec === "react" || spec.startsWith("react/") || spec === "@/lib/utils") continue;
    if (!spec.startsWith("@/components/imessage/")) {
      console.error(`${file.target} has an unexpected import ${spec}`);
      process.exit(1);
    }
    const base = `components/imessage/${spec.slice("@/components/imessage/".length)}`;
    if (![base, `${base}.ts`, `${base}.tsx`].some((candidate) => targets.has(candidate))) {
      console.error(`${file.target} import is not closed: ${spec}`);
      process.exit(1);
    }
  }
}

const exportsDoc = JSON.parse(await readFile(path.join(root, "vendor/upstream/exports.json"), "utf8"));
if (!Array.isArray(exportsDoc) || exportsDoc.length !== files.length) {
  console.error("exports.json does not cover every installed file");
  process.exit(1);
}

console.log(JSON.stringify({ status: "passed", source: lock.source, sha256: lock.sha256, itemCount: lock.itemCount, fileCount: lock.fileCount }));
