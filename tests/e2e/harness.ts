import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Browser, type Page, type TestInfo } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export type Scenario = {
  id: string;
  title: string;
  platform: "ios" | "macos";
  theme: "light" | "dark";
  nowMs: number;
  draft: string;
  typing: boolean;
  screen: "list" | "conversation" | "new-message";
  contact: { name: string };
  messages: Array<{
    id: string;
    text: string;
    direction: "incoming" | "outgoing";
    atMs: number;
    kind?: string;
    effect?: string;
  }>;
};

export type Checkpoint = { id: string; atMs: number; label: string; messageIds: string[] };

const profiles = JSON.parse(readFileSync(path.join(root, "src/contracts/render-profiles.json"), "utf8")) as {
  ios: { width: number; height: number };
  macos: { width: number; height: number };
};

export function loadScenarios(): Scenario[] {
  return readdirSync(path.join(root, "scenarios"))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(path.join(root, "scenarios", file), "utf8")) as Scenario);
}

export function loadCheckpoints(scenarioId: string): Checkpoint[] {
  const groups = JSON.parse(readFileSync(path.join(root, "tests/fixtures/checkpoints.json"), "utf8")) as Array<{
    scenarioId: string;
    checkpoints: Checkpoint[];
  }>;
  return groups.find((group) => group.scenarioId === scenarioId)?.checkpoints ?? [];
}

export function projectAxes(testInfo: TestInfo): { platform: "ios" | "macos"; theme: "light" | "dark" } | null {
  const [engine, platform, theme] = testInfo.project.name.split("-");
  if ((engine !== "chromium" && engine !== "webkit") || (platform !== "ios" && platform !== "macos") || (theme !== "light" && theme !== "dark")) {
    return null;
  }
  return { platform, theme };
}

export function shellSlot(platform: Scenario["platform"]): string {
  return platform === "ios" ? "ios-messages-app" : "macos-messages-app";
}

export async function installObservers(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const external: string[] = [];
  const downloads: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("download", (download) => downloads.push(download.url()));
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:4173/") || url === "http://127.0.0.1:4173") {
      await route.continue();
      return;
    }
    external.push(url);
    await route.abort("blockedbyclient");
  });
  return { pageErrors, consoleErrors, external, downloads };
}

export async function openFlow(page: Page, scenario: Scenario, atMs: number) {
  await page.setViewportSize({ width: profiles[scenario.platform].width, height: profiles[scenario.platform].height });
  await page.emulateMedia({ colorScheme: scenario.theme === "dark" ? "dark" : "light" });
  await page.goto(`/?flow=${scenario.id}&t=${atMs}`);
  const shell = page.locator(`[data-slot="${shellSlot(scenario.platform)}"]`);
  await expect(shell).toBeVisible();
  const box = await shell.boundingBox();
  expect(box?.width).toBe(profiles[scenario.platform].width);
  expect(box?.height).toBe(profiles[scenario.platform].height);
  await expect(page.locator('[data-slot="player-chrome"], [data-slot="preview-controls"]')).toHaveCount(0);
  return shell;
}

export async function seek(page: Page, atMs: number) {
  await page.evaluate((time) => {
    const player = (window as Window & { __demoPlayer?: { seek(ms: number): void } }).__demoPlayer;
    if (!player) throw new Error("demo player seek hook is missing");
    player.seek(time);
  }, atMs);
}

export async function freshShot(browser: Browser, scenario: Scenario, atMs: number) {
  const page = await browser.newPage({
    viewport: { width: profiles[scenario.platform].width, height: profiles[scenario.platform].height },
    deviceScaleFactor: 1,
    colorScheme: scenario.theme === "dark" ? "dark" : "light",
  });
  await installObservers(page);
  const shell = await openFlow(page, scenario, atMs);
  const shot = await shell.screenshot();
  await page.close();
  return shot;
}
