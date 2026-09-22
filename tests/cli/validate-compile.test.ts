import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "@/cli/run";
import { fixturePath, makeDeps, parseStdoutJson } from "./helpers";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("validate and compile", () => {
  it("validates every declared target", async () => {
    const { deps, io } = makeDeps();
    const code = await runCli(["validate", fixturePath("valid-flow.json"), "--json"], deps);
    expect(code).toBe(0);
    expect(parseStdoutJson(io.stdout())).toEqual({ ok: true, id: "agent-text", targets: ["ios", "macos"] });
  });

  it("constrains targets with --platform", async () => {
    const { deps, io } = makeDeps();
    const code = await runCli(["validate", fixturePath("valid-flow.json"), "--platform", "ios", "--json"], deps);
    expect(code).toBe(0);
    expect(parseStdoutJson(io.stdout())).toMatchObject({ targets: ["ios"] });
  });

  it("returns exit 2 for polls without launching capture", async () => {
    let engineCalls = 0;
    const { deps, io } = makeDeps({
      runCaptureEngine: async () => {
        engineCalls += 1;
        throw new Error("should not capture");
      },
      startPreviewServer: async () => {
        throw new Error("should not start preview");
      },
    });
    const code = await runCli(["capture", fixturePath("poll-flow.json"), "--json"], deps);
    expect(code).toBe(2);
    expect(engineCalls).toBe(0);
    const payload = parseStdoutJson(io.stdout()) as { ok: false; payload: { issues: { path: string }[] } };
    expect(payload.ok).toBe(false);
    expect(payload.payload.issues.some((issue) => issue.path.includes("polls"))).toBe(true);
  });

  it("returns exit 3 for a missing local asset", async () => {
    const { deps, io } = makeDeps();
    const code = await runCli(["validate", fixturePath("missing-asset.json"), "--json"], deps);
    expect(code).toBe(3);
    expect(parseStdoutJson(io.stdout())).toMatchObject({ ok: false, exitCode: 3 });
  });

  it("returns exit 3 for external media", async () => {
    const { deps } = makeDeps();
    expect(await runCli(["validate", fixturePath("external-media.json"), "--json"], deps)).toBe(3);
  });

  it("returns exit 3 for path escape", async () => {
    const { deps } = makeDeps();
    expect(await runCli(["validate", fixturePath("escape-flow.json"), "--json"], deps)).toBe(3);
  });

  it("rejects a symlink that escapes public/demo-assets", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "imessage-symlink-"));
    tempDirs.push(dir);
    const link = path.join(depsRoot(), "public/demo-assets/escape-link.png");
    try {
      symlinkSync(path.join(depsRoot(), "package.json"), link);
      const file = path.join(dir, "flow.json");
      writeFileSync(
        file,
        JSON.stringify({
          ...JSON.parse(readFileSync(fixturePath("photo-flow.json"), "utf8")),
          messages: [
            {
              id: "img-1",
              text: "",
              kind: "image",
              direction: "outgoing",
              atMs: 1790008800000,
              images: [{ src: "/demo-assets/escape-link.png", alt: "Escape" }],
            },
          ],
        }),
      );
      const { deps } = makeDeps();
      const code = await runCli(["validate", file, "--json"], deps);
      expect(code).toBe(3);
    } finally {
      rmSync(link, { force: true });
    }
  });

  it("accepts a local photo under public/demo-assets", async () => {
    const { deps } = makeDeps();
    expect(await runCli(["validate", fixturePath("photo-flow.json"), "--json"], deps)).toBe(0);
  });

  it("does not fetch a displayed link destination during validate", async () => {
    const { deps } = makeDeps();
    expect(await runCli(["validate", fixturePath("link-flow.json"), "--json"], deps)).toBe(0);
  });

  it("writes compile artifacts only after success", async () => {
    const out = mkdtempSync(path.join(os.tmpdir(), "imessage-compile-"));
    tempDirs.push(out);
    const { deps, io } = makeDeps();
    const code = await runCli(["compile", fixturePath("valid-flow.json"), "--out", out, "--json"], deps);
    expect(code).toBe(0);
    const payload = parseStdoutJson(io.stdout()) as { artifacts: string[] };
    expect(payload.artifacts).toHaveLength(2);
    for (const artifact of payload.artifacts) {
      expect(existsSync(artifact)).toBe(true);
      const body = JSON.parse(readFileSync(artifact, "utf8")) as { compiled: { id: string } };
      expect(body.compiled.id).toBe("agent-text");
    }
  });

  it("does not write artifacts when validation fails", async () => {
    const out = mkdtempSync(path.join(os.tmpdir(), "imessage-compile-fail-"));
    tempDirs.push(out);
    const { deps } = makeDeps();
    const code = await runCli(["compile", fixturePath("poll-flow.json"), "--out", out, "--json"], deps);
    expect(code).toBe(2);
    expect(existsSync(path.join(out, "poll-demo.json"))).toBe(false);
  });
});

function depsRoot(): string {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
}
