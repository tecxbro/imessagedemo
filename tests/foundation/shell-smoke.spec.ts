import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const profiles = JSON.parse(readFileSync(new URL("../../src/contracts/render-profiles.json", import.meta.url), "utf8")) as {
  ios: { width: number; height: number };
  macos: { width: number; height: number };
};

test("stock shell mounts", async ({ page }, testInfo) => {
  const [, platformName, theme] = testInfo.project.name.split("-") as ["chromium" | "webkit", "ios" | "macos", "light" | "dark"];
  const profile = profiles[platformName];
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ""}`));

  await page.goto(`/?foundation=${platformName}&theme=${theme}`);
  const slot = platformName === "ios" ? "ios-messages-app" : "macos-messages-app";
  const shell = page.locator(`[data-slot="${slot}"]`);
  await expect(shell).toBeVisible();
  const box = await shell.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBe(profile.width);
  expect(box!.height).toBe(profile.height);
  await expect(page.locator('[data-direction="incoming"] [data-slot="message-bubble"]')).toBeVisible();
  await expect(page.locator('[data-direction="outgoing"] [data-slot="message-bubble"]')).toBeVisible();
  await expect(page.locator('[data-slot="field"] textarea')).toHaveValue("On my way over.");
  if (platformName === "ios") {
    await expect(page.locator('[data-slot="ios-status-bar"]')).toBeVisible();
    await expect(page.locator('[data-slot="ios-composer"]')).toBeVisible();
    await expect(page.locator('[data-slot="time"]')).toHaveText("9:41");
  } else {
    await expect(page.locator('[data-slot="mac-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-slot="mac-composer"]')).toBeVisible();
    await expect(page.locator('[data-slot="traffic-lights"]')).toBeVisible();
  }
  const background = await shell.evaluate((element) => getComputedStyle(element).getPropertyValue("--im-bg").trim());
  const expectedBackground = theme === "dark" ? (platformName === "ios" ? "#000000" : "#1e1e1e") : "#ffffff";
  expect(background).toBe(expectedBackground);
  await expect(page.locator("[data-foundation].dark")).toHaveCount(theme === "dark" ? 1 : 0);

  const directory = path.join("artifacts", "foundation", testInfo.project.name);
  await mkdir(directory, { recursive: true });
  await shell.screenshot({ path: path.join(directory, "shell.png") });
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
