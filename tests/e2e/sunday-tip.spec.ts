import { expect, test, type Page } from "@playwright/test";
import { playbackBarHeightPx } from "../../src/player/playback";

const origin = "http://127.0.0.1:4173";
const checkoutUrl = `${origin}/checkouts/sunday-tip.html`;
const firstAt = 1790008740000;
const flow = {
  id: "sunday-tip-e2e",
  title: "Sunday tip",
  platform: "ios",
  theme: "light",
  contact: { name: "Memo", initials: "M" },
  nowMs: firstAt + 2000,
  draft: "",
  typing: false,
  screen: "conversation",
  messages: [
    { id: "thanks", text: "Thanks, Memo. Here's a $5 tip.", direction: "outgoing", atMs: firstAt },
    {
      id: "tip",
      text: "Tip for Memo",
      direction: "incoming",
      atMs: firstAt + 1000,
      kind: "app-card",
      appCard: { url: checkoutUrl, live: true, app: "checkout", height: 240 },
    },
  ],
};

async function observePayments(page: Page) {
  const popups: string[] = [];
  const external: string[] = [];
  page.on("popup", (popup) => popups.push(popup.url()));
  await page.route("**/*", async (route) => {
    if (route.request().url().startsWith(`${origin}/`)) return route.continue();
    external.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, "__nativeCalls", { value: calls });
    window.open = (() => {
      calls.push("window.open");
      return null;
    }) as typeof window.open;
    class NativePaymentTrap {
      constructor() { calls.push("new ApplePaySession"); }
      static canMakePayments() { calls.push("canMakePayments"); return true; }
      begin() { calls.push("begin"); }
    }
    (window as unknown as { ApplePaySession: unknown }).ApplePaySession = NativePaymentTrap;
  });
  return { popups, external };
}

test.describe("Sunday $5 tip checkout", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-ios-light-e2e", "the local checkout is exercised once");
  });

  test("uses the tip amount throughout the sheet and reopens after cancellation without reloading", async ({ page }, testInfo) => {
    const observed = await observePayments(page);
    await page.addInitScript((payload) => sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload)), flow);
    await page.setViewportSize({ width: 402, height: 874 + playbackBarHeightPx });
    await page.goto(`/?flow=${flow.id}&t=1500`);
    const dock = page.locator('[data-app-card-id="tip"]');
    const checkout = dock.frameLocator("iframe");
    const button = checkout.getByRole("button", { name: "Apple Pay", exact: true });
    await expect(dock).toHaveAttribute("data-load-count", "1");
    await expect(checkout.locator("#price")).toHaveText("$5.00");
    await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "ready");
    await checkout.locator("html").evaluate((html) => { html.dataset.testMountToken = "kept-mounted"; });
    const phone = page.locator('[data-slot="ios-messages-app"]');
    await phone.screenshot({ path: testInfo.outputPath("sunday-tip-card.png") });

    const overlay = page.locator("[data-photon-pay-overlay]");
    for (const close of ["escape", "button"]) {
      await button.click();
      await expect(overlay).toHaveAttribute("data-visible", "true");
      await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "opened");
      await expect(overlay.locator('[data-amount="primary"]')).toHaveText("$5.00");
      await expect(overlay.locator('[data-amount="pay-line"]')).toHaveText("Pay $5.00");
      await expect(overlay.locator('[data-amount="total"]')).toHaveText("$5.00");
      await expect(overlay.locator('[data-slot="apple-pay-merchant"]')).toHaveText("Pay Sunday — Tip for Memo");
      await expect(overlay.locator('[data-slot="apple-pay-domain"]')).toHaveText("127.0.0.1");
      await page.waitForFunction(() => Boolean(document.activeElement?.closest(".pp-sheet")));
      if (close === "escape") {
        await page.waitForFunction(() => Number(document.querySelector("[data-photon-pay-overlay]")?.getAttribute("data-source-frame")) >= 125);
        expect(await overlay.boundingBox()).toEqual(await phone.boundingBox());
        await phone.screenshot({ path: testInfo.outputPath("sunday-tip-apple-pay.png") });
      }
      if (close === "escape") await page.keyboard.press("Escape");
      else await overlay.getByRole("button", { name: "Close Apple Pay" }).click();
      await expect(overlay).toHaveAttribute("data-visible", "false");
      await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");
      await expect(button).toBeEnabled();
      await expect(dock).toHaveAttribute("data-load-count", "1");
      await expect(checkout.locator("html")).toHaveAttribute("data-test-mount-token", "kept-mounted");
    }
    for (const frame of page.frames()) {
      expect(await frame.evaluate(() => (window as unknown as { __nativeCalls: string[] }).__nativeCalls)).toEqual([]);
    }
    expect(observed.popups).toEqual([]);
    expect(observed.external).toEqual([]);
  });

  test("does not enable payment in a top-level checkout", async ({ page }) => {
    await observePayments(page);
    await page.goto(`${checkoutUrl}?presentation=visual&parentOrigin=${encodeURIComponent(origin)}`);
    await expect(page.locator("#applepay")).toBeDisabled();
    await expect(page.locator("html")).toHaveAttribute("data-photon-pay-state", "unavailable");
  });

  for (const parameters of [
    { title: "an unlisted parent origin", query: "presentation=visual&parentOrigin=http%3A%2F%2F127.0.0.1%3A4174" },
    { title: "a missing visual mode", query: `parentOrigin=${encodeURIComponent(origin)}` },
  ]) {
    test(`rejects ${parameters.title}`, async ({ page }) => {
      await page.route(`${origin}/tip-test-parent`, (route) => route.fulfill({
        contentType: "text/html",
        body: `<iframe src="${checkoutUrl}?${parameters.query}"></iframe>`,
      }));
      await page.goto(`${origin}/tip-test-parent`);
      const checkout = page.frameLocator("iframe");
      await expect(checkout.locator("#applepay")).toBeDisabled();
      await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "unavailable");
    });
  }
});
