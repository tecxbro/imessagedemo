import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { installObservers } from "./harness";
import { compiledFixture } from "../contracts/compiled.fixture";
import { playbackBarHeightPx } from "../../src/player/playback";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const profiles = JSON.parse(readFileSync(path.join(root, "src/contracts/render-profiles.json"), "utf8")) as {
  ios: { width: number; height: number };
};
const typingReactions = JSON.parse(readFileSync(path.join(root, "examples/typing-reactions.flow.json"), "utf8")) as Record<string, unknown>;
delete typingReactions.targets;
delete typingReactions.checkpoints;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-ios-light-e2e", "playback observation runs once");
});

test("one click plays the typing and reactions example", async ({ page }) => {
  test.setTimeout(90_000);
  const observers = await installObservers(page);
  await openInline(page, typingReactions, "");
  await expect(page.locator("[data-demo-player]")).toHaveAttribute("data-clean", "true");
  await expect(page.locator("[data-demo-player]")).toHaveAttribute("data-capture", "false");
  await expectCleanTransport(page);
  await expect(page.getByText("Can you hold a table for two tonight?")).toBeVisible();
  await expect(page.getByText(/7:30 is open/)).toHaveCount(0);
  expect(await playerState(page)).toMatchObject({ timeMs: 0, playing: false });

  await page.getByRole("button", { name: "Play", exact: true }).click();
  let sawRunningDots = false;
  await expect.poll(async () => {
    const dot = page.locator('[data-dot="1"]');
    if ((await dot.count()) > 0) {
      const playState = await dot.evaluate((element) => getComputedStyle(element).animationPlayState);
      if (playState === "running") sawRunningDots = true;
    }
    const reply = await page.getByText(/7:30 is open/).count();
    const typing = await page.locator('[data-slot="typing-indicator"]').count();
    return sawRunningDots && reply > 0 && typing === 0;
  }, { timeout: 10_000 }).toBe(true);

  await expect(page.locator('[data-message-id="company-1"] [data-slot="tapback"][data-reaction="love"]')).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await playerState(page);
  expect(paused.playing).toBe(false);
  expect(paused.timeMs).toBeGreaterThan(0);
  expect(paused.timeMs).toBeLessThan(paused.durationMs);
  await page.waitForTimeout(400);
  expect(await playerState(page)).toMatchObject({ timeMs: paused.timeMs, playing: false });
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="love"]')).toBeVisible();

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(page.locator('[data-message-id="customer-1"] [data-slot="tapback"][data-reaction="emoji"]')).toContainText("🎉");
  let sawLaterTyping = false;
  await expect.poll(async () => {
    if ((await page.locator('[data-slot="typing-indicator"]').count()) > 0) sawLaterTyping = true;
    const booked = await page.getByText("Booked under your name.").count();
    const typing = await page.locator('[data-slot="typing-indicator"]').count();
    return sawLaterTyping && booked > 0 && typing === 0;
  }, { timeout: 15_000 }).toBe(true);
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  const ended = await playerState(page);
  expect(ended.playing).toBe(false);
  expect(ended.timeMs).toBe(ended.durationMs);
  await page.waitForTimeout(400);
  expect(await playerState(page)).toMatchObject({ timeMs: ended.timeMs, playing: false });

  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect.poll(async () => {
    const state = await playerState(page);
    const booked = await page.getByText("Booked under your name.").count();
    const love = await page.locator('[data-reaction="love"]').count();
    return state.playing && state.timeMs < 1500 && booked === 0 && love === 0;
  }).toBe(true);
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="love"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-message-id="customer-1"] [data-reaction="emoji"]')).toContainText("🎉", { timeout: 10_000 });
  await expect(page.getByText("Booked under your name.")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-slot="typing-indicator"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  expect(observers.pageErrors).toEqual([]);
});

test("reaction replacement and removal advance during playback and clear on replay", async ({ page }) => {
  test.setTimeout(30_000);
  const baseline = 1_790_008_740_000;
  await openInline(page, {
    id: "playback-reaction-replace",
    title: "Reaction replace",
    platform: "ios",
    theme: "light",
    contact: { name: "Harbor", initials: "HA" },
    nowMs: baseline + 60_000,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [{ id: "company-1", text: "Window table is open.", direction: "incoming", atMs: baseline }],
    events: [
      { type: "reaction", atMs: baseline + 800, messageId: "company-1", reactionId: "tap", reaction: { type: "love", byMe: true } },
      { type: "reaction", atMs: baseline + 2200, messageId: "company-1", reactionId: "tap", reaction: { type: "emphasize", byMe: true } },
      { type: "reaction", atMs: baseline + 3600, messageId: "company-1", reactionId: "tap", reaction: null },
    ],
  }, "");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="love"]')).toBeVisible();
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="emphasize"]')).toBeVisible();
  await expect(page.locator('[data-message-id="company-1"] [data-slot="tapback"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect.poll(async () => {
    const state = await playerState(page);
    return state.playing && state.timeMs < 500 && (await page.locator("[data-slot='tapback']").count()) === 0;
  }).toBe(true);
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="love"]')).toBeVisible();
  await expect(page.locator('[data-message-id="company-1"] [data-reaction="emphasize"]')).toBeVisible();
  await expect(page.locator('[data-message-id="company-1"] [data-slot="tapback"]')).toHaveCount(0);
});

test("a timestamp link stays parked until playback starts", async ({ page }) => {
  await openInline(page, typingReactions, "&t=2200");
  await expect(page.getByText(/7:30 is open/)).toBeVisible();
  await expect(page.getByText("We'll take it.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  const parked = await playerState(page);
  expect(parked).toMatchObject({ timeMs: 2200, playing: false });
  await page.waitForTimeout(350);
  expect(await playerState(page)).toMatchObject({ timeMs: 2200, playing: false });
});

test("preview has one playback button and capture stays paused without controls", async ({ page }) => {
  const observers = await installObservers(page);
  await page.setViewportSize({ width: profiles.ios.width, height: profiles.ios.height + 160 });
  await showManifest(page, "preview");
  await expect(page.locator("[data-demo-player]")).toHaveAttribute("data-capture", "false");
  await expect(page.locator("[data-player-chrome] [data-playback-control]")).toBeVisible();
  await expect(page.locator("[data-playback-bar]")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Scenario" })).toBeVisible();
  await expect(page.locator('input[aria-label="Seek"]')).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Checkpoint" })).toHaveCount(0);
  await expect(page.locator("input[type='range']")).toHaveCount(0);
  await expectControlOutsideFrame(page);
  await expect(page.locator('[data-message-id="out-1"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator('[data-message-id="out-1"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();

  await showManifest(page, "capture");
  await expect(page.locator("[data-demo-player]")).toHaveAttribute("data-capture", "true");
  await expect(page.locator("[data-playback-control], [data-player-chrome], [data-playback-bar]")).toHaveCount(0);
  await expect(page.locator('input[aria-label="Seek"]')).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Checkpoint" })).toHaveCount(0);
  const captured = await playerState(page);
  expect(captured).toMatchObject({ timeMs: 0, playing: false });
  await page.waitForTimeout(400);
  expect(await playerState(page)).toMatchObject({ timeMs: 0, playing: false });
  await page.evaluate(async () => {
    const player = window.IMESSAGE_DEMO;
    if (!player) throw new Error("missing player");
    const seek = await player.seek(1000);
    await player.ready(seek.revision);
  });
  await expect(page.locator('[data-message-id="out-1"]')).toBeVisible();
  expect(await playerState(page)).toMatchObject({ timeMs: 1000, playing: false });
  expect(observers.pageErrors).toEqual([]);
});

async function openInline(page: Page, flow: object, search: string) {
  const id = "id" in flow && typeof flow.id === "string" ? flow.id : "";
  await page.addInitScript((payload) => {
    window.sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload));
  }, flow);
  await page.setViewportSize({ width: profiles.ios.width, height: profiles.ios.height + playbackBarHeightPx });
  await page.goto(`/?flow=${id}${search}`);
  await expect(page.locator('[data-slot="ios-messages-app"]')).toBeVisible();
}

async function showManifest(page: Page, mode: "preview" | "capture") {
  const manifest = {
    runId: `playback-${mode}`,
    mode,
    approvedScenarioId: compiledFixture.id,
    compiled: compiledFixture,
    checkpoints: [
      { id: "opening", atMs: 0 },
      { id: "reply", atMs: 1000 },
    ],
    clean: mode === "capture",
    theme: "light" as const,
    platform: "ios" as const,
  };
  await page.unroute("**/__demo/manifest.json").catch(() => undefined);
  await page.route("**/__demo/manifest.json", (route) => {
    void route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(manifest),
    });
  });
  await page.goto("/?playback=1");
  await page.waitForFunction(() => Boolean(window.IMESSAGE_DEMO));
  await expect(page.locator("[data-demo-frame]")).toBeVisible();
}

async function expectCleanTransport(page: Page) {
  await expect(page.locator("[data-playback-bar] [data-playback-control]")).toBeVisible();
  await expect(page.locator("[data-player-chrome]")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Scenario" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Light" })).toHaveCount(0);
  await expect(page.locator('input[aria-label="Seek"]')).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Checkpoint" })).toHaveCount(0);
  await expect(page.locator("input[type='range']")).toHaveCount(0);
  await expectControlOutsideFrame(page);
}

async function expectControlOutsideFrame(page: Page) {
  const button = page.locator("[data-playback-control]");
  const frame = page.locator("[data-demo-frame]");
  await expect(frame.locator("[data-playback-control]")).toHaveCount(0);
  const buttonBox = await button.boundingBox();
  const frameBox = await frame.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  if (!buttonBox || !frameBox) return;
  expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(frameBox.y + 1);
}

async function playerState(page: Page) {
  return page.evaluate(() => {
    const state = window.IMESSAGE_DEMO?.state();
    if (!state) throw new Error("missing player");
    return state;
  });
}
