import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { AppCardPayload } from "../../src/contracts";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

const cases = ["sunday-coffee-poll", "sunday-dinner-poll", "sunday-laundry-poll"];
for (const id of cases) {
  test(`${id} ends with one automatic visual checkout and an Apple Pay-only button`, async ({ page }, info) => {
    test.skip(info.project.name !== "chromium-ios-light-e2e", "Shared checkout behavior runs once");
    const { targets, checkpoints, ...flow } = JSON.parse(readFileSync(`scenarios/${id}.json`, "utf8"));
    const card = flow.messages.at(-1);
    expect(card.kind).toBe("app-card");
    expect(flow.contact.name).toBe("Sunday");
    card.appCard.url = "http://127.0.0.1:4173/checkouts/sunday-tip.html";
    const arrival = card.atMs - flow.messages[0].atMs;
    const observed = await installObservers(page);
    const phone = await openFlow(page, flow as Scenario, arrival - 700);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    const sheet = page.locator('[data-photon-pay-overlay]');
    await expect(sheet).toHaveAttribute("data-visible", "true");
    await expect(sheet.locator('[data-amount="primary"]')).toHaveText("$5.00");
    const dock = page.locator(`[data-app-card-id="${card.id}"]`);
    const checkout = dock.frameLocator("iframe");
    const button = checkout.getByRole("button", { name: "Apple Pay", exact: true });
    await expect(button).toHaveText("");
    await expect(button.locator("img")).toHaveAttribute("alt", "Apple Pay");
    await expect(dock).toHaveAttribute("data-load-count", "1");
    await page.waitForFunction(() => Number(document.querySelector('[data-photon-pay-overlay]')?.getAttribute('data-source-frame')) >= 125);
    await phone.screenshot({ path: info.outputPath(`${id}-automatic-apple-pay.png`) });
    await sheet.getByRole("button", { name: "Close Apple Pay" }).click();
    await expect(sheet).toHaveAttribute("data-visible", "false");
    await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
    await expect(sheet).toHaveAttribute("data-visible", "false");
    await expect(button).toBeEnabled();
    await phone.screenshot({ path: info.outputPath(`${id}-final-card.png`) });
    await button.click();
    await expect(sheet).toHaveAttribute("data-visible", "true");
    await sheet.getByRole("button", { name: "Close Apple Pay" }).click();
    await expect(sheet).toHaveAttribute("data-visible", "false");
    await expect(dock).toHaveAttribute("data-load-count", "1");
    // Rewind before the card, then Play through its arrival again: a fresh mount rearms it.
    await seek(page, arrival - 700);
    await expect(dock).toHaveCount(0);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(sheet).toHaveAttribute("data-visible", "true");
    expect(observed.pageErrors).toEqual([]);
    expect(observed.external).toEqual([]);
  });
}

test("a checkout at time zero also re-arms when Replay keeps the row at the opening", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-ios-light-e2e", "Shared checkout behavior runs once");
  const flow: Omit<Scenario, "messages"> & { messages: Array<Scenario["messages"][number] & { appCard: AppCardPayload }> } = {
    id: "checkout-only", title: "Checkout only", platform: "ios", theme: "light", contact: { name: "Shop" },
    nowMs: 10000, draft: "", typing: false, screen: "conversation",
    messages: [{ id: "checkout", text: "Checkout", kind: "app-card", direction: "incoming", atMs: 0,
      appCard: { url: "http://127.0.0.1:4173/checkouts/sunday-tip.html", live: true, app: "checkout", height: 240 } }],
  };
  await openFlow(page, flow, 0);
  const overlay = page.locator('[data-photon-pay-overlay]');
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(overlay).toHaveAttribute("data-visible", "true");
  await overlay.getByRole("button", { name: "Close Apple Pay" }).click();
  await expect(overlay).toHaveAttribute("data-visible", "false");
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(overlay).toHaveAttribute("data-visible", "true");
});
