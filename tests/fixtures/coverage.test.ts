import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import catalogueScenes from "@/contracts/catalogue-scenes.json";
import { messageKindSchema, type CatalogueSceneDefinition, type CatalogueSceneProps } from "@/contracts";
import { IosCatalogueScene } from "@/renderers/ios";
import { MacCatalogueScene } from "@/renderers/macos";
import { unknownSenderText, formatSystemMessage } from "@/components/imessage/system-message";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = path.join(root, "src/components/imessage");

type CoverageItem = {
  item: string;
  route: string;
  visible: boolean;
  slots?: string[];
  scenarioSlugs?: string[];
  platforms?: Array<"ios" | "macos">;
  dependants?: string[];
  orphan?: boolean;
  negative?: string;
  sceneId?: string;
  standalone?: boolean;
  importedBy?: string[];
  finalState?: string[];
  inProgress?: string[];
};

const coverage = JSON.parse(readFileSync(path.join(root, "tests/fixtures/source-coverage.json"), "utf8")) as { items: CoverageItem[] };
const expectations = JSON.parse(readFileSync(path.join(root, "tests/fixtures/catalogue-expectations.json"), "utf8")) as {
  scenes: Array<{ id: string; requiredSlots: string[]; standalone?: boolean; notMessageKind?: boolean }>;
};
const registry = JSON.parse(readFileSync(path.join(root, "vendor/upstream/registry.json"), "utf8")) as {
  items: Array<{ name: string; type: string }>;
};
const scenarioIds = readdirSync(path.join(root, "scenarios")).filter((file) => file.endsWith(".json"));

function sourceFile(item: string): string | null {
  for (const ext of [".tsx", ".ts"]) {
    const file = path.join(sourceDir, `${item}${ext}`);
    try {
      return readFileSync(file, "utf8");
    } catch {
      continue;
    }
  }
  return null;
}

function importersOf(item: string): string[] {
  const needle = `@/components/imessage/${item}"`;
  const found: string[] = [];
  for (const file of readdirSync(sourceDir)) {
    if (file.startsWith(`${item}.`)) continue;
    const text = readFileSync(path.join(sourceDir, file), "utf8");
    if (text.includes(needle)) found.push(file.replace(/\.(tsx|ts)$/, ""));
  }
  return found;
}

describe("registry coverage", () => {
  it("maps every installed registry item once", () => {
    const names = registry.items.map((item) => item.name).sort();
    expect(coverage.items.map((item) => item.item).sort()).toEqual(names);
    expect(new Set(coverage.items.map((item) => item.item)).size).toBe(names.length);
  });

  it("ties transcript and shell items to real scenarios and slots", () => {
    for (const item of coverage.items) {
      if (item.item === "index") {
        expect(item.route).toBe("pin-style");
        expect(registry.items.find((entry) => entry.name === "index")?.type).toBe("registry:style");
        expect(sourceFile(item.item)).toBeNull();
        continue;
      }
      const source = sourceFile(item.item);
      expect(source, item.item).not.toBeNull();
      if (!source) continue;
      for (const slot of item.slots ?? []) expect(source, `${item.item}:${slot}`).toContain(`data-slot="${slot}"`);
      for (const slug of item.scenarioSlugs ?? []) {
        expect(scenarioIds.some((file) => file.startsWith(`${slug}-`)), slug).toBe(true);
      }
      if (item.platforms) {
        for (const platform of item.platforms) {
          const matches = (item.scenarioSlugs ?? []).flatMap((slug) => scenarioIds.filter((file) => file.startsWith(`${slug}-`)));
          const platforms = matches.map((file) => (JSON.parse(readFileSync(path.join(root, "scenarios", file), "utf8")) as { platform: string }).platform);
          expect(platforms, item.item).toContain(platform);
        }
      }
      if (item.route === "dependency") {
        if (item.orphan) expect(importersOf(item.item)).toEqual([]);
        else {
          expect(item.dependants?.length).toBeGreaterThan(0);
          const importers = importersOf(item.item);
          for (const dependant of item.dependants ?? []) expect(importers, item.item).toContain(dependant);
        }
      }
      if (item.route === "shell-overlay") {
        const importers = importersOf(item.item);
        for (const host of item.importedBy ?? []) expect(importers, item.item).toContain(host);
      }
      if (item.route === "unwired") expect(importersOf(item.item)).toEqual([]);
      if (item.route === "catalogue") {
        expect(catalogueScenes.scenes.some((scene) => scene.id === item.sceneId)).toBe(true);
      }
      if (item.negative) {
        expect(readFileSync(path.join(root, "tests/negative", item.negative), "utf8").length).toBeGreaterThan(0);
      }
      if (item.finalState || item.inProgress) {
        for (const name of [...(item.finalState ?? []), ...(item.inProgress ?? [])]) expect(source).toContain(`function ${name}`);
        expect(item.finalState).toEqual(["EditedLabel"]);
        expect(item.inProgress).toEqual(["EditableBubble", "UndoSendPoof"]);
      }
    }
  });

  it("does not treat polls or mini apps as coverage", () => {
    expect(messageKindSchema.options).not.toContain("poll");
    expect(messageKindSchema.options).not.toContain("system");
    expect(coverage.items.some((item) => item.item === "polls" || item.item === "mini-apps")).toBe(false);
    const capabilities = readFileSync(path.join(root, "src/contracts/capabilities.json"), "utf8");
    expect(capabilities).toContain('"id": "polls"');
    expect(capabilities).toContain('"id": "mini-apps"');
  });
});

describe("catalogue expectations", () => {
  it("covers every frozen scene and leaves fixture copy to the adapters", () => {
    expect(expectations.scenes.map((scene) => scene.id).sort()).toEqual(catalogueScenes.scenes.map((scene) => scene.id).sort());
    const facetime = expectations.scenes.find((scene) => scene.id === "facetime");
    const system = expectations.scenes.find((scene) => scene.id === "system");
    expect(facetime?.standalone).toBe(true);
    expect(facetime?.requiredSlots).toContain("facetime-card");
    expect(system?.standalone).toBe(true);
    expect(system?.notMessageKind).toBe(true);
    expect(formatSystemMessage({ type: "unknownSender" }).map((part) => part.text).join("")).toBe(unknownSenderText);
  });

  it("finds catalogue scenes still unimplemented", () => {
    const scene = catalogueScenes.scenes.find((item) => item.id === "ios-text");
    const mac = catalogueScenes.scenes.find((item) => item.id === "macos-text");
    expect(scene).toBeDefined();
    expect(mac).toBeDefined();
    const props = { scene: scene as CatalogueSceneDefinition, theme: "light" } satisfies CatalogueSceneProps;
    expect(IosCatalogueScene(props)).toMatchObject({ props: expect.anything() });
    expect(MacCatalogueScene({ scene: mac as CatalogueSceneDefinition, theme: "dark" })).toMatchObject({ props: expect.anything() });
  });
});
