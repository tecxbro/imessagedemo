import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { decodePng, pixelDelta } from "./png";

const profiles = JSON.parse(readFileSync(new URL("../../../src/contracts/render-profiles.json", import.meta.url), "utf8")) as {
  ios: { width: number; height: number };
};
const motion = JSON.parse(readFileSync(new URL("../../../src/contracts/motion-tokens.json", import.meta.url), "utf8")) as {
  tokens: Array<{ symbol: string; value: { send?: { duration: number }; slam?: number } }>;
};
const scenes = JSON.parse(readFileSync(new URL("../../../src/contracts/catalogue-scenes.json", import.meta.url), "utf8")).scenes as Array<{
  id: string;
  title: string;
  platform: "ios" | "macos" | "both";
  tier: "supported" | "catalogue-only";
  sourceAnchors: string[];
  summary: string;
}>;
const iosScreen = profiles.ios;
const sendDuration = motion.tokens.find((token) => token.symbol === "messageMotion")?.value.send?.duration ?? 690;
const slamDuration = motion.tokens.find((token) => token.symbol === "bubbleEffectDuration")?.value.slam ?? 640;
const statusText = "4:41";

function sceneById(id: string): Scene {
  const scene = scenes.find((entry) => entry.id === id);
  if (!scene) throw new Error(`missing scene ${id}`);
  return scene;
}

type Scene = (typeof scenes)[number];

async function openHarness(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") external.push(request.url());
  });
  await page.goto("/src/renderers/ios/harness.html");
  await page.waitForFunction(() => Boolean(window.__ios));
  return {
    pageErrors,
    consoleErrors,
    external,
    expectQuiet() {
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
      expect(external).toEqual([]);
    },
  };
}

async function showFrame(page: Page, name: string, args: unknown[] = []) {
  const time = await page.evaluate(async ({ specifier, name, args }) => {
    const fixtures = await import(specifier) as Record<string, (...values: unknown[]) => { compiled: object; frame: { timeMs: number } }>;
    const fixture = fixtures[name]?.(...args);
    if (!fixture) throw new Error(`missing fixture ${name}`);
    window.__ios?.show({ kind: "frame", compiled: fixture.compiled, frame: fixture.frame } as never);
    return fixture.frame.timeMs;
  }, { specifier: "/src/renderers/ios/fixtures.ts", name, args });
  await page.waitForFunction((time) => {
    const host = document.querySelector<HTMLElement>('[data-slot="ios-demo-renderer"]');
    return host?.dataset.time === String(time) && host.dataset.posed === "true";
  }, time);
}

async function seek(page: Page, timeMs: number) {
  const revision = await page.evaluate(() => window.__ios?.revision() ?? 0);
  await page.evaluate((time) => window.__ios?.seek(time), timeMs);
  await page.waitForFunction((previous) => {
    const host = document.querySelector<HTMLElement>('[data-slot="ios-demo-renderer"]');
    return Number(host?.dataset.revision ?? 0) > previous && host?.dataset.posed === "true";
  }, revision);
}

async function settle(page: Page) {
  return page.evaluate(async () => {
    const revision = window.__ios?.revision() ?? 0;
    return window.__ios?.settle(revision);
  });
}

async function shot(page: Page) {
  const buffer = await page.locator('[data-slot="ios-messages-app"]').screenshot();
  return decodePng(buffer);
}

test("renders both bubble directions, the composer, and both themes at source size", async ({ page }) => {
  const monitor = await openHarness(page);
  for (const theme of ["light", "dark"] as const) {
    await showFrame(page, "textFixture", [theme]);
    const receipt = await settle(page);
    expect(receipt).toMatchObject({
      width: iosScreen.width,
      height: iosScreen.height,
      timeMs: 5000,
      theme,
    });
    const shell = page.locator('[data-slot="ios-messages-app"]');
    const box = await shell.boundingBox();
    expect(box?.width).toBe(iosScreen.width);
    expect(box?.height).toBe(iosScreen.height);
    await expect(page.locator('[data-direction="incoming"] [data-slot="message-bubble"]')).toBeVisible();
    await expect(page.locator('[data-direction="outgoing"] [data-slot="message-bubble"]')).toBeVisible();
    await expect(page.locator('[data-slot="field"] textarea')).toHaveValue("On my way over.");
    await expect(page.locator('[data-slot="time"]')).toHaveText(statusText);
    const background = await shell.evaluate((element) => getComputedStyle(element).getPropertyValue("--im-bg").trim());
    expect(background).toBe(theme === "dark" ? "#000000" : "#ffffff");
    expect(await page.locator('[data-message-id][data-kind="typing"]').count()).toBe(0);
  }
  monitor.expectQuiet();
});

test("exercises timeline capabilities from direct frames", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "linkFixture");
  await settle(page);
  await expect(page.locator('[data-slot="link-preview"]')).toBeVisible();
  await page.locator('[data-slot="link-preview"]').click({ force: true });
  expect(page.url()).not.toContain("example.com");

  await showFrame(page, "imageFixture");
  await settle(page);
  await expect(page.locator('[data-slot="image-grid"]')).toBeVisible();

  await showFrame(page, "audioFixture");
  await settle(page);
  await expect(page.locator('[data-slot="waveform"]')).toBeVisible();

  await showFrame(page, "attachmentFixture");
  await settle(page);
  await expect(page.locator('[data-slot="message-attachment"]')).toBeVisible();
  expect(await page.locator('[data-slot="message-attachment"] a').count()).toBe(0);

  await showFrame(page, "typingFixture", [360]);
  await settle(page);
  await expect(page.locator('[data-slot="typing-indicator"]')).toBeVisible();
  expect(await page.locator('[data-typing="true"][data-message-id]').count()).toBe(0);

  await showFrame(page, "emojiFixture", [5000]);
  await settle(page);
  await expect(page.locator('[data-slot="emoji"]')).toHaveCount(2);

  await showFrame(page, "statusFixture");
  await settle(page);
  await expect(page.locator('[data-slot="ios-messages-app"]')).toContainText("Delivered");

  await showFrame(page, "smsFixture");
  await settle(page);
  await expect(page.locator('[data-service="sms"]')).toBeVisible();

  await showFrame(page, "listFixture");
  await settle(page);
  await expect(page.locator('[data-slot="ios-conversation-list"]')).toBeVisible();

  await showFrame(page, "newMessageFixture");
  await settle(page);
  await expect(page.locator('[data-slot="ios-new-message-sheet"]')).toBeVisible();
  await expect(page.locator('[data-slot="field"] textarea').last()).toHaveValue("Hello");
  monitor.expectQuiet();
});

test("mid-send differs from the settled endpoint and progress 1 leaves no ghost", async ({ page }) => {
  const monitor = await openHarness(page);
  const midTime = 1000 + sendDuration / 2;
  const endTime = 1000 + sendDuration;
  await showFrame(page, "arrivalFixture", [midTime]);
  await settle(page);
  expect(await page.locator('[data-slot="send-ghost"], [data-slot="send-clone"]').count()).toBeGreaterThan(0);
  const mid = await shot(page);
  await seek(page, endTime);
  await settle(page);
  expect(await page.locator('[data-slot="send-ghost"], [data-slot="send-clone"]').count()).toBe(0);
  const ended = await shot(page);
  await seek(page, endTime + 2000);
  await settle(page);
  const later = await shot(page);
  expect(pixelDelta(ended.data, later.data)).toBe(0);
  expect(pixelDelta(mid.data, ended.data)).toBeGreaterThan(0);
  monitor.expectQuiet();
});

test("checkpoint screenshots match across reverse and cold seeks", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "textFixture", ["light", 5000]);
  await settle(page);
  const cold = await shot(page);
  await seek(page, 200);
  await settle(page);
  await seek(page, 5000);
  await settle(page);
  const reversed = await shot(page);
  expect(pixelDelta(cold.data, reversed.data)).toBe(0);

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__ios));
  await showFrame(page, "textFixture", ["light", 5000]);
  await settle(page);
  const remounted = await shot(page);
  expect(pixelDelta(cold.data, remounted.data)).toBe(0);
  monitor.expectQuiet();
});

test("freezes typing-dot and invisible-ink intermediate frames", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "typingFixture", [0]);
  await settle(page);
  const typingStart = await shot(page);
  const startDelay = await page.locator('[data-dot="1"]').evaluate((element) => getComputedStyle(element).animationDelay);
  await seek(page, 400);
  await settle(page);
  const typingMid = await shot(page);
  const midDelay = await page.locator('[data-dot="1"]').evaluate((element) => getComputedStyle(element).animationDelay);
  expect(midDelay).not.toBe(startDelay);
  expect(await page.locator('[data-dot="1"]').evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("paused");
  await seek(page, 0);
  await settle(page);
  await seek(page, 400);
  await settle(page);
  const typingReturn = await shot(page);
  expect(pixelDelta(typingMid.data, typingReturn.data)).toBe(0);
  expect(pixelDelta(typingStart.data, typingMid.data)).toBeGreaterThan(0);

  await showFrame(page, "inkFixture", [0]);
  await settle(page);
  const inkStart = await shot(page);
  await seek(page, 1800);
  await settle(page);
  const inkMid = await shot(page);
  await seek(page, 0);
  await settle(page);
  await seek(page, 1800);
  await settle(page);
  const inkReturn = await shot(page);
  expect(pixelDelta(inkMid.data, inkReturn.data)).toBe(0);
  expect(pixelDelta(inkStart.data, inkMid.data)).toBeGreaterThan(0);
  monitor.expectQuiet();
});

test("explicit scroll survives a reverse seek with the same message count", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "scrollFixture", [5000]);
  const first = await settle(page);
  const before = await page.locator('[data-slot="message-list"]').evaluate((element) => ({
    top: element.scrollTop,
    max: element.scrollHeight - element.clientHeight,
  }));
  expect(before.max).toBeGreaterThan(0);
  expect(before.top).toBe(before.max);
  await page.locator('[data-slot="message-list"]').evaluate((element) => {
    element.scrollTop = 0;
  });
  await seek(page, 4000);
  await settle(page);
  const after = await page.locator('[data-slot="message-list"]').evaluate((element) => element.scrollTop);
  expect(after).toBeGreaterThan(0);
  const again = await settle(page);
  expect(again?.digest).toBe((await settle(page))?.digest);
  const bubble = page.locator('[data-slot="message-list"] [data-slot="message-bubble"]').first();
  const gradient = await bubble.evaluate((element) => {
    const body = element.querySelector('[data-slot="bubble"], [data-slot="emoji"]') ?? element;
    const screen = element.closest('[data-slot="ios-messages-app"]')?.getBoundingClientRect();
    const actual = Number.parseFloat((element as HTMLElement).style.getPropertyValue("--bubble-bottom"));
    const expected = body.getBoundingClientRect().bottom - (screen?.top ?? 0);
    return Math.abs(actual - expected);
  });
  expect(gradient).toBeLessThan(1.5);
  expect(first?.timeMs).toBe(5000);
  monitor.expectQuiet();
});

test("settle rejects a stale revision and a missing image", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "textFixture");
  const revision = await page.evaluate(() => window.__ios?.revision() ?? 0);
  await seek(page, 250);
  const stale = await page.evaluate(async (previous) => {
    try {
      await window.__ios?.settle(previous);
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, revision);
  expect(stale).toMatch(/stale revision/);
  monitor.expectQuiet();

  await showFrame(page, "imageFixture", ["data:image/png;base64,aaaa"]);
  const missing = await page.evaluate(async () => {
    try {
      await window.__ios?.settle(window.__ios.revision());
      return "";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(missing).toMatch(/missing asset/);
});

test("long press on a reply measures the message body", async ({ page }) => {
  const monitor = await openHarness(page);
  await page.evaluate(() => window.__ios?.show({
    kind: "catalogue",
    theme: "light",
    scene: {
      id: "reply-long-press",
      title: "Reply long press",
      platform: "ios",
      tier: "supported",
      sourceAnchors: ["ReplyStub", "MessageActions"],
      summary: "Long press measures the message, not its quoted stub.",
    },
  }));
  await page.waitForSelector('[data-slot="lifted-bubble"]');
  const delta = await page.evaluate(() => {
    const frame = document.querySelector('[data-slot="ios-messages-app"]')?.getBoundingClientRect();
    const row = document.querySelector('[data-message-id="reply"]');
    const stub = row?.querySelector('[data-stub]');
    const body = Array.from(row?.querySelectorAll<HTMLElement>('[data-slot="bubble"]') ?? []).find((element) => !element.closest("[data-stub]"));
    const lifted = document.querySelector<HTMLElement>('[data-slot="lifted-bubble"]');
    if (!frame || !stub || !body || !lifted) return null;
    const liftedTop = Number.parseFloat(lifted.style.top);
    const bodyTop = body.getBoundingClientRect().top - frame.top;
    const stubTop = stub.getBoundingClientRect().top - frame.top;
    return { liftedTop, bodyTop, stubTop, text: lifted.textContent };
  });
  expect(delta).not.toBeNull();
  expect(Math.abs((delta?.liftedTop ?? 0) - (delta?.bodyTop ?? 0))).toBeLessThan(2);
  expect(Math.abs((delta?.liftedTop ?? 0) - (delta?.stubTop ?? 0))).toBeGreaterThan(8);
  expect(delta?.text).toContain("This reply");
  expect(delta?.text).not.toContain("Earlier note");
  monitor.expectQuiet();
});

test("converts a scaled image rect into unscaled frame coordinates", async ({ page }) => {
  const monitor = await openHarness(page);
  await page.evaluate(() => window.__ios?.show({ kind: "scaled" }));
  await expect(page.locator('[data-slot="scaled-label"]')).toHaveText("40.00 80.00 100.00 60.00");
  const hostWidth = await page.locator('[data-slot="scaled-host"]').evaluate((element) => element.getBoundingClientRect().width);
  expect(hostWidth).toBeGreaterThan(iosScreen.width);
  monitor.expectQuiet();
});

test("catalogue scenes keep source labels and standalone components", async ({ page }) => {
  const monitor = await openHarness(page);
  const extras: Scene[] = [
    { id: "editable-bubble", title: "Editable bubble", platform: "ios", tier: "catalogue-only", sourceAnchors: ["EditableBubble"], summary: "Controlled edit field." },
    { id: "undo-send", title: "Undo send", platform: "ios", tier: "catalogue-only", sourceAnchors: ["UndoSendPoof"], summary: "Seekable undo poof." },
    { id: "controlled-audio", title: "Controlled audio", platform: "ios", tier: "catalogue-only", sourceAnchors: ["MessageAudio"], summary: "Paused waveform." },
    { id: "selection", title: "Selection", platform: "ios", tier: "catalogue-only", sourceAnchors: ["IosSelectMode"], summary: "Select mode." },
    { id: "swipe-times", title: "Swipe times", platform: "ios", tier: "catalogue-only", sourceAnchors: ["SwipeTimes"], summary: "Revealed times." },
    { id: "plus-menu", title: "Plus menu", platform: "ios", tier: "catalogue-only", sourceAnchors: ["IosPlusMenu"], summary: "Attachments sheet." },
    { id: "details", title: "Details", platform: "ios", tier: "catalogue-only", sourceAnchors: ["IosDetails"], summary: "Contact details." },
    { id: "photo-picker", title: "Photo picker", platform: "ios", tier: "catalogue-only", sourceAnchors: ["PhotoPicker"], summary: "Photo picker." },
    { id: "thread", title: "Thread", platform: "ios", tier: "supported", sourceAnchors: ["ReplyThread"], summary: "Reply thread." },
    { id: "edited", title: "Edited", platform: "ios", tier: "supported", sourceAnchors: ["EditedLabel"], summary: "Edited label." },
    { id: "status", title: "Status", platform: "ios", tier: "supported", sourceAnchors: ["MessageStatus"], summary: "Delivery status." },
    { id: "service-color", title: "Service color", platform: "ios", tier: "supported", sourceAnchors: ["Service"], summary: "SMS green." },
    { id: "ios-list", title: "Conversation list", platform: "ios", tier: "catalogue-only", sourceAnchors: ["IosConversationList"], summary: "List screen." },
    { id: "new-message", title: "New message", platform: "ios", tier: "supported", sourceAnchors: ["IosNewMessageSheet"], summary: "New message sheet." },
  ];
  const iosScenes = [...scenes.filter((scene) => scene.platform !== "macos"), ...extras];
  for (const scene of iosScenes) {
    await page.evaluate((next) => window.__ios?.show({ kind: "catalogue", scene: next, theme: "light" }), scene);
    await expect(page.locator('[data-slot="catalogue-label"]')).toContainText(scene.tier);
    await expect(page.locator('[data-slot="ios-messages-app"] [data-slot="catalogue-label"], [data-slot="ios-capture"] [data-slot="catalogue-label"]')).toHaveCount(0);
    expect(await page.locator('[data-slot="message-row"][data-kind="system"]').count()).toBe(0);
    expect(await page.locator('[data-slot="message-row"][data-kind="typing"]').count()).toBe(0);
  }
  await page.evaluate((scene) => window.__ios?.show({ kind: "catalogue", scene, theme: "dark" }), sceneById("system"));
  await expect(page.locator('[data-slot="system-message"]')).toBeVisible();
  await expect(page.locator('[data-slot="catalogue-confidence"]')).toContainText("not a MessageKind");
  await page.evaluate((scene) => window.__ios?.show({ kind: "catalogue", scene, theme: "light" }), sceneById("facetime"));
  await expect(page.locator('[data-slot="catalogue-confidence"]')).toContainText("unverified");
  await page.evaluate((scene) => window.__ios?.show({ kind: "catalogue", scene, theme: "light" }), sceneById("macos-text"));
  await expect(page.locator('[data-slot="catalogue-skip"]')).toBeVisible();
  await page.evaluate((scene) => window.__ios?.show({ kind: "catalogue", scene, theme: "light" }), sceneById("image-viewer"));
  await expect(page.locator('[data-slot="image-viewer"]')).toBeVisible();
  await expect(page.locator('[data-slot="scripted-source-rect"]')).toHaveAttribute("data-source-rect", "40 80 100 60");
  await page.evaluate((scene) => window.__ios?.show({ kind: "catalogue", scene, theme: "light" }), sceneById("screen-effect"));
  await expect(page.locator('[data-slot="catalogue-confidence"]')).toContainText("unverified");
  monitor.expectQuiet();
});

test("inspect controls stay outside the device and reset", async ({ page }) => {
  const monitor = await openHarness(page);
  await page.evaluate(async (specifier) => {
    const fixtures = await import(specifier) as { textFixture: () => { compiled: object; frame: object } };
    const fixture = fixtures.textFixture();
    window.__ios?.show({ kind: "inspect", compiled: fixture.compiled, frame: fixture.frame } as never);
  }, "/src/renderers/ios/fixtures.ts");
  await page.waitForSelector('[data-slot="inspect-labels"]');
  expect(await page.locator('[data-slot="ios-messages-app"] [data-slot="inspect-labels"]').count()).toBe(0);
  await page.getByRole("button", { name: "Mark" }).click();
  await expect(page.locator('[data-slot="inspect-mark"]')).toHaveText("1");
  await page.locator('[data-slot="field"] textarea').fill("Changed in inspect");
  await expect(page.locator('[data-slot="field"] textarea')).toHaveValue("Changed in inspect");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.locator('[data-slot="inspect-mark"]')).toHaveText("0");
  await expect(page.locator('[data-slot="field"] textarea')).toHaveValue("On my way over.");
  monitor.expectQuiet();
});

test("emoji arrival uses the send flight", async ({ page }) => {
  const monitor = await openHarness(page);
  await showFrame(page, "emojiFixture", [1000 + 100]);
  await settle(page);
  expect(await page.locator('[data-slot="send-ghost"], [data-slot="send-clone"]').count()).toBeGreaterThan(0);
  await seek(page, 1000 + sendDuration);
  await settle(page);
  expect(await page.locator('[data-slot="send-ghost"], [data-slot="send-clone"]').count()).toBe(0);
  await showFrame(page, "slamFixture", [slamDuration / 2]);
  await settle(page);
  expect(await page.locator('[data-slot="send-ghost"]').count()).toBe(0);
  const effect = await page.locator('[data-message-id="slam-1"] [data-slot="bubble-frame"]').evaluate((element) => element.getAnimations().length);
  expect(effect).toBeGreaterThan(0);
  monitor.expectQuiet();
});
