import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { installObservers, openFlow, projectAxes, seek } from "./harness";
import type { Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function load(theme: "light" | "dark"): Scenario {
  return JSON.parse(readFileSync(path.join(root, `scenarios/ios-surface-ios-${theme}.json`), "utf8")) as Scenario;
}

test("the authored iOS surface renders in light and dark", async ({ page }, testInfo) => {
  const axes = projectAxes(testInfo);
  test.skip(!axes || axes.platform !== "ios", "iOS projects only");
  if (!axes) return;
  const scenario = load(axes.theme);
  const observers = await installObservers(page);
  const shell = await openFlow(page, scenario, scenario.messages[0]?.atMs ?? 0);
  const messageId = (name: string) => `${scenario.id}-${name}`;
  await expect(page.locator(`[data-message-id="${messageId("m1")}"]`).getByText("Are you close?")).toBeVisible();
  await seek(page, 1790008885000);
  await expect(page.locator(`[data-message-id="${messageId("m8")}"]`)).toBeVisible();
  await expect(page.locator(`[data-message-id="${messageId("m4")}"] [data-slot="link-preview"]`)).toBeVisible();
  await expect(shell).toBeVisible();
  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
});
