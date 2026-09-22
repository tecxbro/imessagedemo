import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryUrl = "https://imessage-ui.swerdlowbenjamin.workers.dev/r/registry.json";
const alternateRegistryUrl = "https://imessage.swerdlow.dev/r/registry.json";
const userAgent = "imessage-demo-maker-pin/1.0";

const docTargets = [
  { id: "harness", url: "https://imessage-ui.swerdlowbenjamin.workers.dev/harness" },
  { id: "workers-llms", url: "https://imessage-ui.swerdlowbenjamin.workers.dev/llms.txt" },
  { id: "llms-index", url: "https://imessage.swerdlow.dev/llms.txt" },
  { id: "ios-messages-app", url: "https://imessage.swerdlow.dev/llms/ios-messages-app.txt" },
  { id: "macos-messages-app", url: "https://imessage.swerdlow.dev/llms/macos-messages-app.txt" },
  { id: "message-motion", url: "https://imessage.swerdlow.dev/llms/message-motion.txt" },
];

const unavailableProbes = [
  "https://imessage.swerdlow.dev/references/SPEC.md",
  "https://imessage-ui.swerdlowbenjamin.workers.dev/references/SPEC.md",
  "https://imessage.swerdlow.dev/llms/polls.txt",
  "https://imessage.swerdlow.dev/llms/mini-apps.txt",
];

function decodeUtf8(bytes, label) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} is not clean UTF-8: ${error.message}`);
  }
}

async function fetchBytes(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent, accept: "*/*" } });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { url, status: response.status, ok: response.ok, bytes, contentType: response.headers.get("content-type") };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function exportNames(content) {
  const names = [];
  const decl = /^export\s+(?:async\s+)?(?:type|interface|function|const|class|enum)\s+([A-Za-z0-9_]+)/gm;
  for (const match of content.matchAll(decl)) names.push(match[1]);
  const blocks = /^export\s*\{([^}]+)\}/gm;
  for (const match of content.matchAll(blocks)) {
    for (const part of match[1].split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const alias = trimmed.split(/\s+as\s+/).pop().trim();
      names.push(alias);
    }
  }
  return [...new Set(names)];
}

function localSpecToTarget(spec) {
  const prefix = "@/components/imessage/";
  if (!spec.startsWith(prefix)) return null;
  const base = `components/imessage/${spec.slice(prefix.length)}`;
  return [base, `${base}.ts`, `${base}.tsx`];
}

const result = await fetchBytes(registryUrl);
if (!result.ok) throw new Error(`Registry download failed: ${result.status} ${registryUrl}`);
const registryText = decodeUtf8(result.bytes, registryUrl);
if (registryText.includes("\uFFFD")) {
  throw new Error("Registry contains U+FFFD. Refusing to repair encoding.");
}
const registry = JSON.parse(registryText);
if (!Array.isArray(registry.items)) throw new Error("Registry has no items array");

const files = [];
for (const item of registry.items) {
  for (const file of item.files ?? []) {
    if (typeof file.content !== "string" || typeof file.target !== "string") {
      throw new Error(`Item ${item.name} is missing file content or target`);
    }
    decodeUtf8(Buffer.from(file.content, "utf8"), file.target);
    if (file.content.includes("\uFFFD")) {
      throw new Error(`${file.target} contains U+FFFD. Refusing to repair encoding.`);
    }
    files.push({ item: item.name, path: file.path ?? null, target: file.target, type: file.type ?? null, content: file.content });
  }
}

const targets = new Set(files.map((file) => file.target));
const closureErrors = [];
for (const file of files) {
  for (const match of file.content.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = match[1];
    if (spec === "react" || spec.startsWith("react/") || spec === "@/lib/utils") continue;
    const candidates = localSpecToTarget(spec);
    if (!candidates) {
      closureErrors.push(`${file.target} imports ${spec}`);
      continue;
    }
    if (!candidates.some((candidate) => targets.has(candidate))) {
      closureErrors.push(`${file.target} imports missing ${spec}`);
    }
  }
}
if (closureErrors.length) {
  throw new Error(`Import closure failed:\n${closureErrors.join("\n")}`);
}

const vendorDir = path.join(root, "vendor", "upstream");
const componentDir = path.join(root, "src", "components", "imessage");
await mkdir(vendorDir, { recursive: true });
await mkdir(componentDir, { recursive: true });
await writeFile(path.join(vendorDir, "registry.json"), result.bytes);

const exportsDoc = files.map((file) => ({
  item: file.item,
  target: file.target,
  exports: exportNames(file.content),
}));
await writeFile(path.join(vendorDir, "exports.json"), `${JSON.stringify(exportsDoc, null, 2)}\n`);

for (const file of files) {
  const destination = path.join(root, "src", file.target);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, file.content, "utf8");
}

const alternate = await fetchBytes(alternateRegistryUrl);
let alternateRecord = { url: alternateRegistryUrl, status: alternate.status, installed: false };
if (alternate.ok) {
  const alternateText = decodeUtf8(alternate.bytes, alternateRegistryUrl);
  const alternateJson = JSON.parse(alternateText);
  const pinnedNames = new Set(registry.items.map((item) => item.name));
  const alternateNames = new Set(alternateJson.items.map((item) => item.name));
  alternateRecord = {
    url: alternateRegistryUrl,
    status: alternate.status,
    installed: false,
    sha256: sha256(alternate.bytes),
    bytes: alternate.bytes.length,
    itemCount: alternateJson.items.length,
    fileCount: alternateJson.items.reduce((sum, item) => sum + (item.files?.length ?? 0), 0),
    identicalToPin: sha256(alternate.bytes) === sha256(result.bytes),
    onlyInAlternate: [...alternateNames].filter((name) => !pinnedNames.has(name)).sort(),
    onlyInPin: [...pinnedNames].filter((name) => !alternateNames.has(name)).sort(),
  };
}

const docsDir = path.join(vendorDir, "docs");
await mkdir(docsDir, { recursive: true });
const archivedDocs = [];
for (const doc of docTargets) {
  const fetched = await fetchBytes(doc.url);
  const record = {
    id: doc.id,
    url: doc.url,
    status: fetched.status,
    contentType: fetched.contentType,
    bytes: fetched.bytes.length,
    archived: false,
  };
  if (fetched.ok) {
    try {
      decodeUtf8(fetched.bytes, doc.url);
      const filename = `${doc.id}.txt`;
      await writeFile(path.join(docsDir, filename), fetched.bytes);
      record.archived = true;
      record.file = `vendor/upstream/docs/${filename}`;
      record.sha256 = sha256(fetched.bytes);
    } catch (error) {
      record.error = error.message;
    }
  }
  archivedDocs.push(record);
}

const indexDoc = archivedDocs.find((doc) => doc.id === "llms-index" && doc.archived);
if (indexDoc) {
  const indexText = decodeUtf8(await readFile(path.join(docsDir, "llms-index.txt")), "llms-index");
  const linked = [...indexText.matchAll(/https:\/\/imessage\.swerdlow\.dev\/llms\/[a-z0-9-]+\.txt/g)].map((match) => match[0]);
  const seen = new Set(docTargets.map((doc) => doc.url));
  for (const url of [...new Set(linked)]) {
    if (seen.has(url)) continue;
    const id = `llms-${url.split("/").pop().replace(/\.txt$/, "")}`;
    const fetched = await fetchBytes(url);
    const record = { id, url, status: fetched.status, contentType: fetched.contentType, bytes: fetched.bytes.length, archived: false };
    if (fetched.ok) {
      const filename = `${id}.txt`;
      await writeFile(path.join(docsDir, filename), fetched.bytes);
      record.archived = true;
      record.file = `vendor/upstream/docs/${filename}`;
      record.sha256 = sha256(fetched.bytes);
    }
    archivedDocs.push(record);
  }
}

const unavailable = [];
for (const url of unavailableProbes) {
  const fetched = await fetchBytes(url);
  unavailable.push({
    url,
    status: fetched.status,
    archived: false,
    reason: fetched.ok ? "unexpected success" : "not present at this URL",
  });
}
unavailable.push({
  url: null,
  id: "native-captures",
  archived: false,
  reason: "No native capture set was supplied. None is claimed.",
});
unavailable.push({
  url: null,
  id: "references/SPEC.md",
  archived: false,
  reason: "references/SPEC.md is not part of the registry response and the probed URLs did not serve it.",
});

const lock = {
  source: "live",
  url: registryUrl,
  retrievedAt: new Date().toISOString(),
  sha256: sha256(result.bytes),
  bytes: result.bytes.length,
  encoding: "utf-8",
  encodingCheck: "fatal-utf8",
  itemCount: registry.items.length,
  fileCount: files.length,
  replacementCharacterCount: 0,
  importClosure: "passed",
  externalImportsAllowed: ["react", "@/lib/utils"],
  alternateRegistry: alternateRecord,
  docs: archivedDocs,
  unavailable,
};
await writeFile(path.join(vendorDir, "lock.json"), `${JSON.stringify(lock, null, 2)}\n`);
console.log(JSON.stringify({ sha256: lock.sha256, itemCount: lock.itemCount, fileCount: lock.fileCount, docs: archivedDocs.length }, null, 2));
