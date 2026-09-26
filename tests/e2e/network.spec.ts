import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { installObservers, loadScenarios, openFlow, projectAxes } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("displayed links do not unfurl, navigate, or download", async ({ page }, testInfo) => {
  const axes = projectAxes(testInfo);
  const scenario = loadScenarios().find((item) => item.id === `media-${axes?.platform ?? "ios"}-${axes?.theme ?? "light"}`);
  expect(scenario).toBeDefined();
  if (!scenario) return;
  const observers = await installObservers(page);
  await openFlow(page, scenario, scenario.messages[scenario.messages.length - 1].atMs);
  const link = page.locator('[data-slot="link-preview"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "https://example.com/notes");
  const swallowed = await link.evaluate((element) => {
    const anchor = element as HTMLAnchorElement;
    let prevented = false;
    const stop = (event: MouseEvent) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
      event.stopPropagation();
    };
    anchor.addEventListener("click", stop, true);
    anchor.click();
    anchor.removeEventListener("click", stop, true);
    return prevented;
  });
  expect(swallowed).toBe(false);
  expect(page.url()).toContain("127.0.0.1:4173");
  expect(observers.external).toEqual([]);
  expect(observers.downloads).toEqual([]);
  await expect(page.locator('[data-slot="message-attachment"] a')).toHaveCount(0);
  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
});

test("a path-escape asset is rejected instead of requested", async ({ page }) => {
  const observers = await installObservers(page);
  const escapeCase = JSON.parse(readFileSync(path.join(root, "tests/negative/path-escape.json"), "utf8")) as {
    issues: Array<{ path: string }>;
  };
  await page.goto("/?flow=negative&case=path-escape");
  const error = page.locator('[data-slot="scenario-error"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText(escapeCase.issues[0].path);
  await expect(page.locator('img[src*="passwd"]')).toHaveCount(0);
  expect(observers.external).toEqual([]);
  expect(observers.downloads).toEqual([]);
});
