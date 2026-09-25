import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import type { DemoFlow } from "@/contracts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("corpus compile", () => {
  it("compiles every scenario on its declared platform and keeps message text", () => {
    const files = readdirSync(path.join(root, "scenarios")).filter((file) => file.endsWith(".json")).sort();
    expect(files).toHaveLength(36);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(path.join(root, "scenarios", file), "utf8")) as DemoFlow;
      const validated = validateDemo(raw);
      expect(validated.ok, file).toBe(true);
      if (!validated.ok) continue;
      const compiled = compileDemo(validated.demo);
      expect(compiled.platform).toBe(raw.platform);
      const texts = compiled.events.flatMap((event) => (event.type === "message" ? [event.message.text] : []));
      expect(texts).toEqual(raw.messages.map((message) => message.text));
      expect(compiled.events.flatMap((event) => (event.type === "message" ? [event.message.direction] : []))).toEqual(
        raw.messages.map((message) => message.direction),
      );
      if (raw.platform === "ios" && (raw.screen === "list" || raw.screen === "new-message")) {
        const flipped = validateDemo({ ...raw, platform: "macos" });
        expect(flipped.ok, `${file} macos`).toBe(false);
      }
    }
  });
});
