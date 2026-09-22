import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateDemo } from "@/compiler";
import motionTokens from "@/contracts/motion-tokens.json";
import profiles from "@/contracts/render-profiles.json";
import { compileDemo } from "@/compiler";
import { createPlayer, frameAt, stateAt } from "@/runtime";
import { compiledFixture } from "./compiled.fixture";
import { compileDemoDouble, createPlayerDouble, frameAtDouble, validateDemoDouble } from "./doubles";
import { renderFrameFixture } from "./render-frame.fixture";

describe("production boundaries", () => {
  it("rejects calls instead of returning an empty success", () => {
    expect(() => validateDemo({})).toThrow(/NOT_IMPLEMENTED: validateDemo/);
    expect(() => compileDemo(renderFrameToFlow())).toThrow(/NOT_IMPLEMENTED: compileDemo/);
    expect(() => stateAt(compiledFixture, 0)).toThrow(/NOT_IMPLEMENTED: stateAt/);
    expect(() => frameAt(compiledFixture, 0)).toThrow(/NOT_IMPLEMENTED: frameAt/);
    expect(() => createPlayer(compiledFixture)).toThrow(/NOT_IMPLEMENTED: createPlayer/);
  });
});

describe("test doubles", () => {
  it("validates and projects the fixture", () => {
    const validated = validateDemoDouble(renderFrameToFlow());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const compiled = compileDemoDouble(validated.demo);
    const frame = frameAtDouble(compiled, compiled.durationMs);
    expect(frame.messages.map((message) => message.id)).toEqual(["in-1", "out-1"]);
    expect(frame.draft).toBe(renderFrameFixture.draft);
    const player = createPlayerDouble(compiled);
    player.seek(compiled.durationMs);
    expect(player.frame().messages).toHaveLength(2);
  });
});

describe("pinned profiles", () => {
  it("matches the extracted screen tokens", () => {
    const ios = motionTokens.tokens.find((token) => token.symbol === "iosScreen");
    const mac = motionTokens.tokens.find((token) => token.symbol === "macScreen");
    expect(ios?.value).toMatchObject({ width: profiles.ios.width, height: profiles.ios.height });
    expect(mac?.value).toMatchObject({ width: profiles.macos.width, height: profiles.macos.height });
    expect(motionTokens.tokens.find((token) => token.symbol === "messageMotion")?.value).toMatchObject({
      send: { duration: 690 },
      receive: { duration: 300 },
    });
  });
});

describe("foundation shell boundary", () => {
  it("does not import unfinished lanes", () => {
    const app = readFileSync(new URL("../../src/App.tsx", import.meta.url), "utf8");
    const preview = readFileSync(new URL("../../src/foundation/ShellPreview.tsx", import.meta.url), "utf8");
    const combined = `${app}\n${preview}`;
    expect(combined).not.toMatch(/@\/compiler|@\/runtime|@\/renderers|@\/player|@\/cli/);
  });
});

function renderFrameToFlow() {
  return {
    id: compiledFixture.id,
    title: "Foundation text",
    platform: "ios" as const,
    theme: "light" as const,
    contact: compiledFixture.contact,
    nowMs: compiledFixture.nowMs,
    draft: renderFrameFixture.draft,
    typing: false,
    screen: "conversation" as const,
    messages: renderFrameFixture.messages,
  };
}
