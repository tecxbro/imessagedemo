import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compileDemo, validateDemo } from "@/compiler";
import { authoringDocumentSchema, declaredTargets, toDemoFlow } from "@/cli/authoring";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("corpus compile", () => {
  it("compiles every scenario on its declared platform and keeps message text", () => {
    const files = readdirSync(path.join(root, "scenarios")).filter((file) => file.endsWith(".json")).sort();
    const referenceIds = JSON.parse(readFileSync(path.join(root, "tests/fixtures/checkpoints.json"), "utf8")) as Array<{ scenarioId: string }>;
    expect(files).toEqual(expect.arrayContaining(referenceIds.map(({ scenarioId }) => `${scenarioId}.json`)));
    const ids = new Set<string>();
    for (const file of files) {
      const authored = authoringDocumentSchema.parse(JSON.parse(readFileSync(path.join(root, "scenarios", file), "utf8")));
      expect(ids.has(authored.id), `${file} duplicate flow id`).toBe(false);
      ids.add(authored.id);
      expect(file).toBe(`${authored.id}.json`);
      for (const platform of declaredTargets(authored)) {
        // Use the same authoring-envelope handoff as the CLI; targets/checkpoints are not timeline fields.
        const raw = toDemoFlow(authored, platform);
        const validated = validateDemo(raw);
        expect(validated.ok, `${file} ${platform}`).toBe(true);
        if (!validated.ok) continue;
        const compiled = compileDemo(validated.demo);
        expect(compiled.platform).toBe(platform);
        const texts = compiled.events.flatMap((event) => (event.type === "message" ? [event.message.text] : []));
        expect(texts).toEqual(raw.messages.map((message) => message.text));
        expect(compiled.events.flatMap((event) => (event.type === "message" ? [event.message.direction] : []))).toEqual(
          raw.messages.map((message) => message.direction),
        );
        if (platform === "ios" && (raw.screen === "list" || raw.screen === "new-message")) {
          const flipped = validateDemo({ ...raw, platform: "macos" });
          expect(flipped.ok, `${file} macos`).toBe(false);
        }
      }
    }
  });
});
