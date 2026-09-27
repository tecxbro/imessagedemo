import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const reference = JSON.parse(readFileSync(path.join(root, "examples/ios-poll-vote.flow.json"), "utf8")) as Scenario;

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-ios-dark-e2e", "poll reference runs once on the dark iOS project");
});

test("a timed vote plays, seeks, pauses, and resets inside the conversation", async ({ page }) => {
  test.setTimeout(90_000);
  const observers = await installObservers(page);
  await openFlow(page, reference, 0);
  const heidi = page.locator('[data-option-id="heidis"]');
  const sushi = page.locator('[data-option-id="sushis"]');
  await expect(heidi).toHaveAttribute("data-selected", "false");
  await expect(sushi).toHaveAttribute("data-selected", "false");
  await expect(page.locator('[data-slot="poll-question"]')).toHaveCount(0);
  const idleWidth = await widthOf(heidi);
  const sushiWidth = await widthOf(sushi);

  await seek(page, 1533);
  expect(await widthOf(heidi)).toBe(idleWidth);
  await expect(heidi).toHaveAttribute("data-selected", "false");

  await seek(page, 1567);
  await expect(heidi).toHaveAttribute("data-selected", "true");
  await expect(heidi).toHaveAttribute("data-progress", "0.000000");
  await expect(heidi).toHaveAttribute("data-label", "255,250,243");
  expect(await widthOf(heidi)).toBe(idleWidth);
  await expect(heidi.locator('[data-slot="poll-avatar"]')).toHaveAttribute("data-opacity", "0.000");
  expect(await widthOf(sushi)).toBe(sushiWidth);

  await seek(page, 1600);
  expect(await widthOf(heidi)).toBeGreaterThan(idleWidth);
  expect(await widthOf(heidi)).toBeLessThan(idleWidth + 12);

  await seek(page, 1700);
  const mid = await widthOf(heidi);
  expect(mid).toBeGreaterThan(idleWidth + 20);
  await page.waitForTimeout(1100);
  expect(await widthOf(heidi)).toBe(mid);

  await seek(page, 1900);
  const peak = await widthOf(heidi);
  expect(Number(await heidi.getAttribute("data-progress"))).toBeGreaterThan(1);
  await expect(sushi).toHaveAttribute("data-selected", "false");
  expect(await widthOf(sushi)).toBe(sushiWidth);

  const beforeScroll = await heidi.boundingBox();
  const sushiBefore = await sushi.boundingBox();
  await seek(page, 3467);
  const afterScroll = await heidi.boundingBox();
  const sushiAfter = await sushi.boundingBox();
  expect(beforeScroll && afterScroll && sushiBefore && sushiAfter).toBeTruthy();
  if (beforeScroll && afterScroll && sushiBefore && sushiAfter) {
    expect(afterScroll.y).toBeGreaterThan(beforeScroll.y + 20);
    expect(Math.abs((afterScroll.y - beforeScroll.y) - (sushiAfter.y - sushiBefore.y))).toBeLessThan(3);
  }

  await seek(page, 2434);
  const rest = await widthOf(heidi);
  expect(rest).toBeLessThan(peak);
  expect(rest).toBeGreaterThan(idleWidth);
  await expect(heidi.locator("img")).toBeVisible();

  const directPeak = await page.locator('[data-slot="poll-host"]').screenshot();
  await seek(page, 0);
  for (const time of [400, 800, 1200, 1567, 1700, 1900]) await seek(page, time);
  const steppedPeak = await page.locator('[data-slot="poll-host"]').screenshot();
  await seek(page, 2434);
  const steppedRest = await page.locator('[data-slot="poll-host"]').screenshot();
  expect(Buffer.compare(directPeak, steppedRest)).toBe(0);
  expect(Buffer.compare(steppedPeak, steppedRest)).not.toBe(0);

  await seek(page, 0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => Number(await heidi.getAttribute("data-progress")) > 1, { timeout: 8_000 }).toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await playerTime(page);
  await page.waitForTimeout(1100);
  expect(await playerTime(page)).toBe(paused);

  const duration = (await playerState(page)).durationMs;
  await seek(page, duration);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect.poll(async () => {
    const state = await playerState(page);
    const selected = await heidi.getAttribute("data-selected");
    return state.playing && state.timeMs < 400 && selected === "false";
  }).toBe(true);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await sushi.click();
  await expect(sushi).toHaveAttribute("data-selected", "true");
  await sushi.click();
  await expect(sushi).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-option-id="sushis"][data-selected="true"]')).toHaveCount(1);

  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
});

test("another poll uses authored labels and does not mount on a conversation without one", async ({ page }) => {
  const custom = {
    ...reference,
    id: "ios-poll-custom",
    messages: [
      {
        id: "places",
        kind: "poll",
        direction: "incoming" as const,
        atMs: 0,
        text: "",
        poll: {
          question: "Where?",
          selectionMode: "single",
          options: [
            { id: "cedar", text: "Cedar" },
            { id: "maple", text: "Maple" },
          ],
          voters: [{ id: "me", avatar: "/demo-assets/ios-poll-reference-voter.png" }],
        },
      },
    ],
    events: [],
  };
  await openFlow(page, custom, 0);
  await expect(page.getByRole("button", { name: "Cedar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Maple" })).toBeVisible();
  await expect(page.locator('[data-slot="poll-question"]')).toHaveText("Where?");
  await expect(page.getByText("Heidi’s")).toHaveCount(0);

  const plain = {
    ...reference,
    id: "ios-poll-absent",
    messages: [{ id: "hi", text: "Hello", direction: "incoming" as const, atMs: 0 }],
    events: [],
  };
  await openFlow(page, plain, 0);
  await expect(page.locator('[data-slot="poll-host"]')).toHaveCount(0);
  await expect(page.getByText("Hello")).toBeVisible();
});

async function widthOf(option: ReturnType<Page["locator"]>): Promise<number> {
  return Number(await option.getAttribute("data-width"));
}

async function playerTime(page: Page): Promise<number> {
  return (await playerState(page)).timeMs;
}

async function playerState(page: Page): Promise<{ timeMs: number; playing: boolean; durationMs: number }> {
  return page.evaluate(() => window.IMESSAGE_DEMO!.state());
}
