import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { tapbackMotion, tapbackVisualAt } from "../../src/contracts/tapback-motion";
import { installObservers, openFlow, seek } from "./harness";
import type { Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const flow = JSON.parse(readFileSync(path.join(root, "examples/ios-tapback-interaction.flow.json"), "utf8")) as Scenario;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-ios-dark-e2e", "tapback playback is observed once");
});

async function openAt(page: Page, atMs: number) {
  await installObservers(page);
  return openFlow(page, flow, atMs);
}

async function partScale(page: Page, name: string) {
  const part = page.locator(`[data-glyph-part="${name}"]`).first();
  await expect(part).toHaveCount(1);
  return Number(await part.getAttribute("data-scale-y"));
}

test("play performs the tapback without a message click", async ({ page }) => {
  test.setTimeout(30_000);
  await openAt(page, 0);
  await expect(page.locator('[data-slot="message-actions"]')).toHaveCount(0);
  await expect(page.locator('[data-message-id="target"] [data-slot="tapback"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.locator('[data-slot="message-actions"]')).toBeVisible();
  await expect(page.locator('[data-glyph-part="emphasize-second"]')).toBeVisible();
  await expect(page.locator('[data-message-id="target"] [data-slot="tapback"][data-reaction="love"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-slot="message-actions"]')).toHaveCount(0);
  await expect(page.locator('[data-slot="tapback"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
});

test("cold exit, reordered seeks, and pause agree", async ({ page }) => {
  test.setTimeout(30_000);
  const shell = await openAt(page, 3567);
  const actions = page.locator('[data-slot="message-actions"]');
  await expect(actions).toHaveAttribute("data-phase", "exit");
  await expect(actions).toHaveAttribute("data-glyph-row", "0");
  expect(Number(await actions.getAttribute("data-pill-remain"))).toBeGreaterThan(0.4);
  expect(Number(await actions.getAttribute("data-lift"))).toBe(0);
  await expect(page.locator('[data-slot="tapback-pill"]')).toBeVisible();
  await expect(page.locator('[data-slot="tapback"]')).toHaveCount(0);
  const coldLift = await actions.getAttribute("data-lift");
  await seek(page, 1200);
  const early = tapbackVisualAt({ phase: "enter", elapsedMs: 1200 - 933, entranceElapsedMs: 1200 - 933 });
  expect(await partScale(page, "emphasize-first")).toBeGreaterThan(0.85);
  expect(await partScale(page, "emphasize-second")).toBeCloseTo(early.glyphs.emphasizeSecond.scaleY, 4);
  expect(Number(await page.locator('[data-glyph-part="question"]').first().getAttribute("data-scale-x"))).toBeLessThan(0.25);

  const order = [3567, 1200, 3867, 1467, 0, 3367, 3733, 5333, 1400];
  for (const atMs of order) await seek(page, atMs);

  await expect(actions).toHaveAttribute("data-phase", "enter");
  const entered = tapbackVisualAt({ phase: "enter", elapsedMs: 1400 - 933, entranceElapsedMs: 1400 - 933 });
  expect(await partScale(page, "emphasize-second")).toBeCloseTo(entered.glyphs.emphasizeSecond.scaleY, 4);
  expect(await partScale(page, "ha-bottom")).toBeLessThan(await partScale(page, "ha-top"));
  const question = Number(await page.locator('[data-glyph-part="question"]').first().getAttribute("data-scale-x"));
  expect(question).toBeLessThan(0.7);
  expect(question).toBeCloseTo(entered.glyphs.question.scaleX, 4);

  await seek(page, 1467);
  const late = await partScale(page, "emphasize-second");
  await page.waitForTimeout(500);
  expect(await partScale(page, "emphasize-second")).toBe(late);
  expect(await actions.getAttribute("data-phase")).toBe("enter");

  await seek(page, 3367);
  await expect(actions).toHaveAttribute("data-phase", "select");
  await expect(page.locator('[data-slot="tapback-selected-ring"]')).toBeVisible();
  await expect(page.locator('[data-slot="tapback"]')).toHaveCount(0);
  expect(Number(await actions.getAttribute("data-menu-opacity"))).toBeLessThan(0.9);

  await seek(page, 3500);
  await expect(actions).toHaveAttribute("data-glyph-row", "0");
  await expect(page.locator('[data-slot="tapback-pill"]')).toBeVisible();
  expect(Number(await actions.getAttribute("data-pill-remain"))).toBe(1);

  await seek(page, 3733);
  await expect(actions).toHaveCount(0);
  await expect(page.locator('[data-slot="tapback-pill"]')).toHaveCount(0);
  await expect(page.locator('[data-glyph-part="ha-top"]')).toHaveCount(0);

  await seek(page, 3867);
  await expect(page.locator('[data-message-id="target"] [data-reaction="love"]')).toHaveCount(1);
  await seek(page, 5333);
  await expect(page.locator('[data-slot="tapback"]')).toHaveCount(1);
  await expect(page.locator('[data-slot="message-actions"]')).toHaveCount(0);

  await seek(page, 3567);
  expect(await actions.getAttribute("data-lift")).toBe(coldLift);
  await expect(shell.locator('[data-message-id="target"]')).toBeVisible();
  expect(tapbackMotion.exitMs).toBe(333);
});

test("a remote reaction does not open the local picker", async ({ page }) => {
  const remote = {
    ...flow,
    id: "remote-only-reaction",
    messages: [{ id: "target", text: "Where’d u go?", direction: "incoming", atMs: 0 }],
    events: [
      { type: "reaction", atMs: 400, messageId: "target", reactionId: "company", reaction: { type: "love", byMe: false } },
    ],
  } as Scenario;
  await installObservers(page);
  await openFlow(page, remote, 400);
  await expect(page.locator('[data-slot="message-actions"]')).toHaveCount(0);
  await expect(page.locator('[data-message-id="target"] [data-slot="tapback"][data-own="false"]')).toBeVisible();
});
