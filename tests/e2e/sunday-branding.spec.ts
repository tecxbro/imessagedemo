import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import type { DemoFlow } from "../../src/contracts";
import { playbackBarHeightPx } from "../../src/player/playback";
import { seek } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const origin = "http://127.0.0.1:4173";
const avatarSrc = "/demo-assets/sunday/avatar.png";

function load(id: string): DemoFlow {
  const { targets: _targets, checkpoints: _checkpoints, ...flow } = JSON.parse(readFileSync(path.join(root, "scenarios", `${id}.json`), "utf8"));
  for (const message of flow.messages) {
    if (message.appCard) message.appCard.url = `${origin}/checkouts/sunday-tip.html`;
  }
  return flow;
}

async function expectAvatar(page: Page) {
  const avatar = page.locator('[data-slot="ios-nav-bar"] [data-slot="avatar"] img');
  await expect(avatar).toBeVisible();
  await expect(avatar).toHaveAttribute("src", avatarSrc);
  await expect.poll(() => avatar.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(256);
}

test.describe("Sunday artwork and quoted replies", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium-ios-light-e2e", "Sunday local flows use the iOS light presentation");
  });

  for (const id of ["sunday-dinner-cleanup", "sunday-morning-espresso", "sunday-sock-pile"]) {
    test(`${id} retains its avatar, quoted reply, and $5 tip through replay`, async ({ page }, info) => {
      const flow = load(id);
      await page.addInitScript((payload) => sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload)), flow);
      await page.setViewportSize({ width: 402, height: 874 + playbackBarHeightPx });
      await page.goto(`/?flow=${id}&t=13690`);
      const phone = page.locator('[data-slot="ios-messages-app"]');
      await expectAvatar(page);
      const quote = page.locator('[data-message-id="m3"] [data-slot="reply-stub"]');
      await expect(quote).toBeVisible();
      await expect(quote).toContainText(flow.messages.find((message) => message.id === "m2")!.text);
      await phone.screenshot({ path: info.outputPath(`${id}-quoted-reply.png`) });

      await seek(page, 51690);
      await expectAvatar(page);
      const checkout = page.frameLocator('[data-app-card-id="tip-checkout"] iframe');
      await checkout.getByRole("button", { name: "Apple Pay", exact: true }).click();
      const overlay = page.locator("[data-photon-pay-overlay]");
      await expect(overlay).toHaveAttribute("data-visible", "true");
      await expect(overlay.locator('[data-amount="primary"]')).toHaveText("$5.00");
      await expect(overlay.locator('[data-amount="pay-line"]')).toHaveText("Pay $5.00");
      await expect(overlay.locator('[data-amount="total"]')).toHaveText("$5.00");
      await page.waitForFunction(() => Number(document.querySelector("[data-photon-pay-overlay]")?.getAttribute("data-source-frame")) >= 125);
      await phone.screenshot({ path: info.outputPath(`${id}-apple-pay.png`) });
      await page.keyboard.press("Escape");
      await expect(overlay).toHaveAttribute("data-visible", "false");

      await page.getByRole("button", { name: "Replay", exact: true }).click();
      await expect(page.locator('[data-app-card-id="tip-checkout"]')).toHaveCount(0);
      await expectAvatar(page);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
      await seek(page, 13690);
      await expectAvatar(page);
      await expect(quote).toContainText(flow.messages.find((message) => message.id === "m2")!.text);
    });
  }

  test("initials remain visible when no avatar was authored", async ({ page }) => {
    const flow = load("sunday-dinner-cleanup");
    delete flow.contact.photo;
    await page.addInitScript((payload) => sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload)), flow);
    await page.goto(`/?flow=${flow.id}&t=13690`);
    const avatar = page.locator('[data-slot="ios-nav-bar"] [data-slot="avatar"]');
    await expect(avatar).toHaveText("S");
    await expect(avatar.locator("img")).toHaveCount(0);
  });
});
