import { expect, test } from "@playwright/test";
import { freshShot, installObservers, loadCheckpoints, loadScenarios, openFlow, projectAxes, seek } from "./harness";

const matrixSlugs = ["basic", "long-thread", "sms", "media", "typing-status", "bubble-effects", "emoji", "macos-jordan", "ios-list", "ios-new-message"];

test.describe("replay determinism", () => {
  for (const scenario of loadScenarios()) {
    test(`${scenario.id} fresh, sequential, reverse, repeat, and reset land on the same frame`, async ({ page, browser }, testInfo) => {
      const axes = projectAxes(testInfo);
      test.skip(Boolean(axes) && (axes?.platform !== scenario.platform || axes?.theme !== scenario.theme), "other source-size project");
      test.skip(!matrixSlugs.some((slug) => scenario.id.startsWith(`${slug}-`)), "outside the matrix");
      const checkpoints = loadCheckpoints(scenario.id);
      expect(checkpoints.length).toBeGreaterThan(0);
      const target = checkpoints[Math.min(1, checkpoints.length - 1)];
      const last = checkpoints[checkpoints.length - 1];
      const observers = await installObservers(page);

      const fresh = await freshShot(browser, scenario, target.atMs);
      const shell = await openFlow(page, scenario, checkpoints[0].atMs);
      for (const checkpoint of checkpoints) {
        if (checkpoint.atMs < target.atMs) await seek(page, checkpoint.atMs);
      }
      await seek(page, target.atMs);
      const sequential = await shell.screenshot();
      await seek(page, last.atMs);
      await seek(page, target.atMs);
      const reverse = await shell.screenshot();
      await seek(page, target.atMs);
      const repeated = await shell.screenshot();
      await page.reload();
      await openFlow(page, scenario, checkpoints[0].atMs);
      await seek(page, target.atMs);
      const reset = await shell.screenshot();

      expect(Buffer.compare(sequential, fresh)).toBe(0);
      expect(Buffer.compare(reverse, fresh)).toBe(0);
      expect(Buffer.compare(repeated, fresh)).toBe(0);
      expect(Buffer.compare(reset, fresh)).toBe(0);

      const row = page.locator(`[data-slot="message-row"][data-message-id="${target.messageIds.at(-1) ?? ""}"]`);
      if (target.messageIds.length > 0) await expect(row).toBeVisible();
      if (scenario.id.startsWith("long-thread-")) {
        const tail = checkpoints[checkpoints.length - 1];
        await seek(page, tail.atMs);
        await expect(page.locator(`[data-slot="message-row"][data-message-id="${tail.messageIds.at(-1)}"]`)).toBeInViewport();
      }
      if (scenario.id.startsWith("bubble-effects-")) {
        await expect(page.locator('[data-slot="message-row"][data-effect="slam"]')).toBeVisible();
        await expect(page.locator('[data-slot="message-row"][data-effect="invisible-ink"]')).toBeVisible();
      }
      if (scenario.id.startsWith("typing-status-")) {
        await seek(page, last.atMs);
        await expect(page.locator('[data-slot="typing-indicator"]')).toBeVisible();
        await expect(page.locator('[data-slot="failed-send-badge"]')).toBeVisible();
      }
      if (scenario.id.startsWith("media-")) {
        const image = page.locator('[data-slot="message-images"] img').first();
        await expect(image).toHaveAttribute("src", /\/demo-assets\/.+\.png$/);
      }
      if (scenario.id.startsWith("macos-jordan-")) {
        await expect(page.locator('[data-slot="mac-sidebar"]')).toBeVisible();
        await expect(page.getByText("Jordan, the export finished.")).toBeVisible();
      }
      expect(observers.pageErrors).toEqual([]);
      expect(observers.consoleErrors).toEqual([]);
      expect(observers.external).toEqual([]);
      expect(observers.downloads).toEqual([]);
    });
  }
});
