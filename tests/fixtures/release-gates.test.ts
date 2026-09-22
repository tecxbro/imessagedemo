import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateDemo, compileDemo } from "@/compiler";
import { createPlayer, frameAt } from "@/runtime";
import { notImplemented, type DemoFlow } from "@/contracts";
import { compiledFixture } from "../contracts/compiled.fixture";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("source integrity", () => {
  it("matches the pinned registry hash and refuses a native-capture claim", () => {
    const lock = JSON.parse(readFileSync(path.join(root, "vendor/upstream/lock.json"), "utf8")) as {
      sha256: string;
      source: string;
      unavailable: Array<{ id?: string; archived?: boolean; reason?: string }>;
    };
    const bytes = readFileSync(path.join(root, "vendor/upstream/registry.json"));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(lock.sha256);
    expect(lock.source).toBe("live");
    const native = lock.unavailable.find((item) => item.id === "native-captures");
    expect(native).toMatchObject({ archived: false, reason: "No native capture set was supplied. None is claimed." });
    const result = spawnSync(process.execPath, ["scripts/check-upstream.mjs"], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
  });
});

describe("unfinished application lanes", () => {
  it("still throws NOT_IMPLEMENTED, so assembled capture is blocked", () => {
    const flow: DemoFlow = {
      id: "gate",
      title: "Gate",
      platform: "ios",
      theme: "light",
      contact: { name: "Alex Morgan", initials: "AM" },
      nowMs: 1790008860000,
      draft: "",
      typing: false,
      screen: "conversation",
      messages: [],
    };
    expect(() => validateDemo(flow)).toThrow(/NOT_IMPLEMENTED: validateDemo/);
    expect(() => compileDemo(flow)).toThrow(/NOT_IMPLEMENTED: compileDemo/);
    expect(() => frameAt(compiledFixture, 0)).toThrow(/NOT_IMPLEMENTED: frameAt/);
    expect(() => createPlayer(compiledFixture)).toThrow(/NOT_IMPLEMENTED: createPlayer/);
    expect(() => notImplemented("demo")).toThrow(/NOT_IMPLEMENTED: demo/);
  });

  it("leaves the root Playwright config on the foundation smoke project", () => {
    const config = readFileSync(path.join(root, "playwright.config.ts"), "utf8");
    expect(config).toContain("foundation\\/shell-smoke\\.spec\\.ts");
    expect(config).not.toContain("tests/e2e");
  });
});
