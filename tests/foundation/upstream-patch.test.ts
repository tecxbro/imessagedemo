import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PATCHED_TARGETS, applyPatchToBaseline, assertPatchPaths, patchPaths, verifyTree, verifyWorktree } from "@/foundation/upstream-pin";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

function diff(before: string, after: string) {
  const directory = mkdtempSync(path.join(tmpdir(), "tapback-diff-"));
  const file = path.join(directory, "src/components/imessage/tapback.tsx");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, before);
  execFileSync("git", ["init"], { cwd: directory, stdio: "pipe" });
  execFileSync("git", ["add", "src/components/imessage/tapback.tsx"], { cwd: directory, stdio: "pipe" });
  writeFileSync(file, after);
  const patch = execFileSync("git", ["diff", "--", "src/components/imessage/tapback.tsx"], { cwd: directory }).toString();
  rmSync(directory, { recursive: true, force: true });
  return patch;
}

describe("tapback upstream patch", () => {
  it("rejects a patch that leaves the four-file set", () => {
    expect(() => assertPatchPaths(["src/components/imessage/tokens.ts"])).toThrow(/outside/);
    expect(() => assertPatchPaths(["src/components/imessage/../tapback.tsx"])).toThrow(/confined|outside/);
  });

  it("reconstructs pin plus patch and rejects a stale patch", () => {
    const before = "export const pin = 1;\n";
    const after = "export const pin = 2;\n";
    const patch = diff(before, after);
    expect(patchPaths(patch)).toEqual(["src/components/imessage/tapback.tsx"]);
    const applied = applyPatchToBaseline(new Map([["components/imessage/tapback.tsx", before]]), patch);
    expect(applied.get("components/imessage/tapback.tsx")).toBe(after);
    expect(() => applyPatchToBaseline(new Map([["components/imessage/tapback.tsx", "export const other = 1;\n"]]), patch)).toThrow();
  });

  it("reports unrelated installed drift and an installed file the patch does not produce", () => {
    const before = "export const pin = 1;\n";
    const after = "export const pin = 2;\n";
    const patch = diff(before, after);
    const files = [
      ...PATCHED_TARGETS.map((target) => ({ target, content: target.endsWith("tapback.tsx") ? before : "export const same = 1;\n" })),
      { target: "components/imessage/tokens.ts", content: "export const token = 1;\n" },
    ];
    const registryText = JSON.stringify({ items: [{ files }] });
    const lock = { fileCount: files.length, itemCount: 1 };
    const directory = mkdtempSync(path.join(tmpdir(), "tapback-installed-"));
    const installedPath = path.join(directory, "installed.txt");
    writeFileSync(installedPath, before);
    const drifted = verifyTree({
      root,
      registryText,
      lock,
      patchText: patch,
      readInstalled: {
        path: () => installedPath,
        text: (target) => (target.endsWith("tokens.ts") ? "export const token = 2;\n" : target.endsWith("tapback.tsx") ? before : "export const same = 1;\n"),
      },
    });
    expect(drifted.join("\n")).toContain("installed source drifted: components/imessage/tokens.ts");
    rmSync(directory, { recursive: true, force: true });
  });

  it("accepts the worktree pin plus the checked-in patch", () => {
    const result = verifyWorktree(root);
    expect(result.status, result.status === "failed" ? result.message : "").toBe("passed");
  });
});
