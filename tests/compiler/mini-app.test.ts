import { describe, expect, it } from "vitest";
import { validateDemo, compileDemo } from "@/compiler";
import { frameAt } from "@/runtime";
import { authoringDocumentSchema } from "@/cli/authoring";
import { preflightAssets } from "@/cli/preflight";
import { resolveMiniApp } from "@/renderers/ios/mini-app/config";
import local from "../../examples/miniapp-local.flow.json";

const mutated = (appCard: Record<string, unknown>) => ({ ...local, messages: [local.messages[0], { ...local.messages[1], appCard }] });
const card = local.messages[1].appCard!;

describe("Photon mini app cards", () => {
  it("keeps the reference metadata intact through authoring, compile and projection", () => {
    expect(authoringDocumentSchema.safeParse(local).success).toBe(true);
    const result = validateDemo(local);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const compiled = compileDemo(result.demo);
    expect(frameAt(compiled, compiled.durationMs).messages.at(-1)?.appCard).toEqual(card);
    expect(preflightAssets(authoringDocumentSchema.parse(local), process.cwd())).toEqual([]);
  });
  it("rejects missing metadata, unknown fields and mismatched image/alt pairs", () => {
    for (const layout of [undefined, {}, {...card.layout, caption:" "}, {...card.layout, image:"/demo-assets/photon-miniapp/jump.jpeg"}, {...card.layout, imageTitle:"art"}, {...card.layout, image:"https://evil.test/art.png", imageTitle:"art"}, {...card.layout, extra:true}]) {
      expect(validateDemo(mutated({...card, layout})).ok, JSON.stringify(layout)).toBe(false);
      expect(authoringDocumentSchema.safeParse(mutated({...card, layout})).success).toBe(false);
    }
  });
  it("rejects local traversal, unsafe URLs and macOS", () => {
    for (const url of ["javascript:alert(1)","/demo-apps/../private.html","//evil.test/app","/demo-apps/%2e%2e/app.html","http://user:pw@evil.test/"]) {
      expect(validateDemo(mutated({...card,url})).ok).toBe(false);
      expect(resolveMiniApp(url,"http://localhost:5173").ok).toBe(false);
    }
    expect(validateDemo({...local,platform:"macos"}).ok).toBe(false);
  });
  it("requires an exact configured origin for external apps, independent from checkout permissions", () => {
    expect(resolveMiniApp("https://game.example/app?level=2", "http://localhost:5173").ok).toBe(false);
    expect(resolveMiniApp("https://game.example/app?level=2", "http://localhost:5173", "https://game.example")).toEqual({ok:true,src:"https://game.example/app?level=2"});
    expect(resolveMiniApp("https://game.example.evil.test/", "http://localhost:5173", "https://game.example").ok).toBe(false);
    expect(resolveMiniApp(card.url,"http://localhost:5173")).toEqual({ok:true,src:"http://localhost:5173/demo-apps/counter.html"});
  });
});
