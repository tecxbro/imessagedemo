import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const PATCHED_TARGETS = [
  "components/imessage/ios-messages-app.tsx",
  "components/imessage/message-list.tsx",
  "components/imessage/message-bubble.tsx",
  "components/imessage/message-actions.tsx",
  "components/imessage/tapback-bar.tsx",
  "components/imessage/tapback.tsx",
] as const;

const EXTENSION_IMPORT = "@/contracts/tapback-motion";
const TAPBACK_PATCH = "patches/imessage/tapback-interaction.patch";
const PLAYBACK_PATCH = "patches/imessage/playback-controls.patch";
const INTERACTIVE_PATCH = "patches/imessage/interactive-preview.patch";
const LAYOUT_PATCH = "patches/imessage/conversation-layout.patch";
const LAYOUT_TARGETS = ["components/imessage/ios-messages-app.tsx", "components/imessage/message-bubble.tsx"] as const;
const TAPBACK_TARGETS = [
  "components/imessage/message-actions.tsx",
  "components/imessage/tapback-bar.tsx",
  "components/imessage/tapback.tsx",
] as const;
const PLAYBACK_TARGETS = [
  "components/imessage/ios-messages-app.tsx",
  "components/imessage/message-list.tsx",
] as const;
const INTERACTIVE_TARGETS = ["components/imessage/ios-messages-app.tsx"] as const;
const EXTENSION_TARGETS = new Set<string>(TAPBACK_TARGETS);

type RegistryFile = { target: string; content: string };
type LockFile = { source?: string; sha256: string; fileCount: number; itemCount: number };

export type VerifyResult =
  | { status: "passed"; lock: LockFile }
  | { status: "fixture" | "failed"; message: string };

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function decodeUtf8(bytes: Uint8Array, label: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label} is not clean UTF-8: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function patchPaths(patchText: string): string[] {
  const paths: string[] = [];
  for (const line of patchText.split("\n")) {
    if (/^(?:new file mode|old mode|new mode|deleted file mode|rename from|rename to|Binary files)/.test(line)) {
      throw new Error(`patch changes file mode or kind: ${line}`);
    }
    const match = /^(?:\+\+\+|---) [ab]\/(.+)$/.exec(line);
    if (!match || match[1] === "/dev/null") continue;
    paths.push(match[1]);
  }
  return [...new Set(paths)];
}

export function assertPatchPaths(paths: readonly string[], allowedRelative: readonly string[] = PATCHED_TARGETS): void {
  const allowed = new Set(allowedRelative.map((target) => `src/${target}`));
  if (paths.length === 0) throw new Error("tapback patch does not touch the pinned components");
  for (const file of paths) {
    if (file.includes("..") || file.startsWith("/") || file.includes("\\")) {
      throw new Error(`patch path is not confined: ${file}`);
    }
    if (!allowed.has(file)) throw new Error(`patch path is outside the tapback extension: ${file}`);
  }
}

function assertRealFile(file: string): void {
  const stat = lstatSync(file);
  if (stat.isSymbolicLink()) throw new Error(`refusing symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`refusing non-file: ${file}`);
}

function closureErrors(target: string, content: string, targets: Set<string>, allowExtension: boolean): string[] {
  const errors: string[] = [];
  for (const match of content.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = match[1];
    if (!spec) continue;
    if (spec === "react" || spec.startsWith("react/") || spec === "@/lib/utils") continue;
    if (allowExtension && spec === EXTENSION_IMPORT) continue;
    if (!spec.startsWith("@/components/imessage/")) {
      errors.push(`${target} has an unexpected import ${spec}`);
      continue;
    }
    const base = `components/imessage/${spec.slice("@/components/imessage/".length)}`;
    if (![base, `${base}.ts`, `${base}.tsx`].some((candidate) => targets.has(candidate))) {
      errors.push(`${target} import is not closed: ${spec}`);
    }
  }
  return errors;
}

export function applyPatchToBaseline(
  baseline: Map<string, string>,
  patchText: string,
  allowedRelative: readonly string[] = PATCHED_TARGETS,
): Map<string, string> {
  assertPatchPaths(patchPaths(patchText), allowedRelative);
  const directory = mkdtempSync(path.join(tmpdir(), "tapback-pin-"));
  try {
    for (const [target, content] of baseline) {
      const file = path.join(directory, "src", target);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const patchFile = path.join(directory, "extension.patch");
    writeFileSync(patchFile, patchText);
    execFileSync("git", ["apply", "--whitespace=nowarn", patchFile], { cwd: directory, stdio: "pipe" });
    const applied = new Map<string, string>();
    for (const target of baseline.keys()) {
      applied.set(target, readFileSync(path.join(directory, "src", target), "utf8"));
    }
    return applied;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export function verifyTree(input: {
  root: string;
  registryText: string;
  lock: { fileCount: number; itemCount: number };
  patchText: string;
  allowed?: readonly string[];
  readInstalled: { path: (target: string) => string; text: (target: string) => string };
}): string[] {
  const errors: string[] = [];
  const registry = JSON.parse(input.registryText) as { items?: Array<{ files?: RegistryFile[] }> };
  const files: RegistryFile[] = [];
  for (const item of registry.items ?? []) {
    for (const file of item.files ?? []) files.push(file);
  }
  if (files.length !== input.lock.fileCount || (registry.items ?? []).length !== input.lock.itemCount) {
    errors.push("lock counts do not match the registry");
  }
  try {
    assertPatchPaths(patchPaths(input.patchText), input.allowed ?? PATCHED_TARGETS);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  const allowed = new Set<string>(PATCHED_TARGETS);
  const targets = new Set(files.map((file) => file.target));
  const baseline = new Map<string, string>();
  const installed = new Map<string, string>();
  for (const file of files) {
    try {
      assertRealFile(input.readInstalled.path(file.target));
      const onDisk = input.readInstalled.text(file.target);
      installed.set(file.target, onDisk);
      if (allowed.has(file.target)) {
        baseline.set(file.target, file.content);
        continue;
      }
      if (onDisk !== file.content) errors.push(`installed source drifted: ${file.target}`);
      errors.push(...closureErrors(file.target, file.content, targets, false));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length === 0) {
    let applied: Map<string, string> | null = null;
    try {
      applied = applyPatchToBaseline(baseline, input.patchText, input.allowed ?? PATCHED_TARGETS);
    } catch (error) {
      errors.push(`tapback patch did not apply: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (applied) {
      for (const target of PATCHED_TARGETS) {
        if (!baseline.has(target)) errors.push(`patch target missing from the pin: ${target}`);
        else if (applied.get(target) !== installed.get(target)) errors.push(`installed source is not pin plus tapback patch: ${target}`);
        else errors.push(...closureErrors(target, installed.get(target) ?? "", targets, true));
      }
    }
  }
  try {
    assertRealFile(path.join(input.root, "src/contracts/tapback-motion.ts"));
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }
  return errors;
}

export function verifyWorktree(root: string): VerifyResult {
  const lock = JSON.parse(readFileSync(path.join(root, "vendor/upstream/lock.json"), "utf8")) as LockFile;
  if (lock.source !== "live") {
    return { status: "fixture", message: `upstream pin source is ${lock.source}; a fixture pin cannot pass` };
  }
  const registryBytes = readFileSync(path.join(root, "vendor/upstream/registry.json"));
  const digest = sha256(registryBytes);
  if (digest !== lock.sha256) {
    return { status: "failed", message: `registry digest mismatch: ${digest} !== ${lock.sha256}` };
  }
  const registryText = decodeUtf8(registryBytes, "vendor/upstream/registry.json");
  if (registryText.includes("\uFFFD")) {
    return { status: "failed", message: "registry contains U+FFFD" };
  }
  const playbackText = readFileSync(path.join(root, PLAYBACK_PATCH), "utf8");
  const tapbackText = readFileSync(path.join(root, TAPBACK_PATCH), "utf8");
  const interactiveText = readFileSync(path.join(root, INTERACTIVE_PATCH), "utf8");
  const layoutText = readFileSync(path.join(root, LAYOUT_PATCH), "utf8");
  assertRealFile(path.join(root, PLAYBACK_PATCH));
  assertRealFile(path.join(root, TAPBACK_PATCH));
  assertRealFile(path.join(root, INTERACTIVE_PATCH));
  assertRealFile(path.join(root, LAYOUT_PATCH));
  const registryFiles = (JSON.parse(registryText) as { items: Array<{ files?: RegistryFile[] }> }).items.flatMap((item) => item.files ?? []);
  const baseline = new Map(registryFiles.map((file) => [file.target, file.content]));
  let reconstructed: Map<string, string>;
  try {
    const withPlayback = applyPatchToBaseline(
      new Map(PLAYBACK_TARGETS.map((target) => [target, baseline.get(target) ?? ""])),
      playbackText,
      PLAYBACK_TARGETS,
    );
    for (const [target, content] of withPlayback) baseline.set(target, content);
    const withTapback = applyPatchToBaseline(
      new Map(TAPBACK_TARGETS.map((target) => [target, baseline.get(target) ?? ""])),
      tapbackText,
      TAPBACK_TARGETS,
    );
    for (const [target, content] of withTapback) baseline.set(target, content);
    const withInteractive = applyPatchToBaseline(
      new Map(INTERACTIVE_TARGETS.map((target) => [target, baseline.get(target) ?? ""])),
      interactiveText,
      INTERACTIVE_TARGETS,
    );
    for (const [target, content] of withInteractive) baseline.set(target, content);
    const withLayout = applyPatchToBaseline(
      new Map(LAYOUT_TARGETS.map((target) => [target, baseline.get(target) ?? ""])),
      layoutText,
      LAYOUT_TARGETS,
    );
    for (const [target, content] of withLayout) baseline.set(target, content);
    reconstructed = baseline;
  } catch (error) {
    return { status: "failed", message: `recorded patch did not apply: ${error instanceof Error ? error.message : String(error)}` };
  }
  const errors: string[] = [];
  const targets = new Set(registryFiles.map((file) => file.target));
  for (const file of registryFiles) {
    const expected = reconstructed.get(file.target);
    let onDisk: string;
    try {
      assertRealFile(path.join(root, "src", file.target));
      onDisk = readFileSync(path.join(root, "src", file.target), "utf8");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    if (onDisk !== expected) errors.push(`installed source is not pin plus recorded patches: ${file.target}`);
    const allowExtension = EXTENSION_TARGETS.has(file.target);
    errors.push(...closureErrors(file.target, onDisk, targets, allowExtension));
  }
  if (registryFiles.length !== lock.fileCount || (JSON.parse(registryText) as { items: unknown[] }).items.length !== lock.itemCount) {
    errors.push("lock counts do not match the registry");
  }
  if (errors.length > 0) return { status: "failed", message: errors.join("\n") };
  const exportsDoc = JSON.parse(readFileSync(path.join(root, "vendor/upstream/exports.json"), "utf8")) as unknown;
  const registry = JSON.parse(registryText) as { items: Array<{ files?: RegistryFile[] }> };
  const files = registry.items.flatMap((item) => item.files ?? []);
  if (!Array.isArray(exportsDoc) || exportsDoc.length !== files.length) {
    return { status: "failed", message: "exports.json does not cover every installed file" };
  }
  return { status: "passed", lock };
}
