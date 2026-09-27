import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { playbackBarHeightPx } from "../../src/player/playback";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RENDERER = "http://127.0.0.1:4173";
const CHECKOUT = "http://127.0.0.1:4174";
const phone = { width: 402, height: 874 };
/** The overlay scales the 512 × 1112 recording into the phone and bottom-aligns it. */
const scale = Math.min(phone.width / 512, phone.height / 1112);
const offsetY = phone.height - 1112 * scale;
const firstAt = 1790008740000;

type Decision = { kind: string; reason?: string; requestId?: string; frameId?: string };
type FlowMessage = { id: string; text: string; direction: string; atMs: number; kind?: string; appCard?: { url: string; live: boolean; app: string } };

function checkoutFlow(routes: string[], id = "checkout-e2e"): { id: string; messages: FlowMessage[]; [key: string]: unknown } {
  return {
    id,
    title: "Checkout e2e",
    platform: "ios",
    theme: "light",
    contact: { name: "Airial Travel", initials: "AT" },
    nowMs: 1790008860000,
    draft: "",
    typing: false,
    screen: "conversation",
    messages: [
      { id: "in-1", text: "Here it is.", direction: "incoming", atMs: firstAt },
      ...routes.map((route, index) => ({
        id: `card-${route}`,
        text: `${route} checkout`,
        direction: "incoming",
        atMs: firstAt + 1000 * (index + 1),
        kind: "app-card",
        appCard: { url: route.startsWith("http") ? route : `${CHECKOUT}/${route}`, live: true, app: "checkout" },
      })),
    ],
  };
}

async function observe(page: Page) {
  const external: string[] = [];
  const popups: string[] = [];
  const errors: string[] = [];
  page.on("popup", (popup) => popups.push(popup.url()));
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(`${RENDERER}/`) || url.startsWith(`${CHECKOUT}/`)) return route.continue();
    external.push(url);
    return route.abort("blockedbyclient");
  });
  // Every frame, including the cross-origin checkout: record any native payment or popup attempt.
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, "__nativeCalls", { value: calls });
    window.open = ((url?: string | URL) => {
      calls.push(`open ${String(url)}`);
      return null;
    }) as typeof window.open;
    class RecordingSession {
      constructor() {
        calls.push("new ApplePaySession");
      }
      static canMakePayments() {
        calls.push("canMakePayments");
        return true;
      }
      begin() {
        calls.push("begin");
      }
    }
    (window as unknown as { ApplePaySession: unknown }).ApplePaySession = RecordingSession;
  });
  return { external, popups, errors };
}

async function openCheckoutFlow(page: Page, flow: ReturnType<typeof checkoutFlow>) {
  await page.addInitScript((payload) => {
    if (location.origin === "http://127.0.0.1:4173") sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload));
  }, flow);
  await page.setViewportSize({ width: phone.width, height: phone.height + playbackBarHeightPx });
  const lastAt = flow.messages[flow.messages.length - 1].atMs;
  await page.goto(`/?flow=${flow.id}&t=${lastAt - firstAt + 500}`);
  const shell = page.locator('[data-slot="ios-messages-app"]');
  await expect(shell).toBeVisible();
  for (const message of flow.messages.filter((item) => item.kind === "app-card")) {
    await expect(page.locator(`[data-slot="app-card"][data-app-card-id="${message.id}"]`)).toHaveAttribute("data-load-count", "1");
  }
  return shell;
}

const card = (page: Page, route: string): FrameLocator => page.frameLocator(`[data-slot="app-card"][data-app-card-id="card-${route}"] iframe`);

async function payState(page: Page) {
  return page.evaluate(() => window.__photonPay!.state()) as Promise<{
    mode: string;
    visible: boolean;
    presenting: boolean;
    request: Record<string, string> | null;
    active: { frameId: string; requestId: string } | null;
    decisions: Decision[];
  }>;
}

async function sourceFrame(page: Page): Promise<number> {
  const value = await page.locator("[data-photon-pay-overlay]").getAttribute("data-source-frame");
  return Number(value);
}

async function waitForSourceFrame(page: Page, atLeast: number) {
  await page.waitForFunction((frame) => Number(document.querySelector("[data-photon-pay-overlay]")?.getAttribute("data-source-frame")) >= frame, atLeast);
}

async function expectAmounts(page: Page, formatted: string, merchant: string, domain: string) {
  const overlay = page.locator("[data-photon-pay-overlay]");
  await expect(overlay.locator('[data-amount="primary"]')).toHaveText(formatted);
  await expect(overlay.locator('[data-amount="pay-line"]')).toHaveText(`Pay ${formatted}`);
  await expect(overlay.locator('[data-amount="total"]')).toHaveText(formatted);
  await expect(overlay.locator('[data-slot="apple-pay-merchant"]')).toHaveText(`Pay ${merchant}`);
  await expect(overlay.locator('[data-slot="apple-pay-domain"]')).toHaveText(domain);
}

async function expectClosed(page: Page) {
  const overlay = page.locator("[data-photon-pay-overlay]");
  await expect(overlay).toHaveAttribute("data-visible", "false");
  await expect(overlay.locator(".pp-scrim")).toBeHidden();
  await expect(overlay.locator(".pp-sheet")).toBeHidden();
}

/** Tap the checkout's Apple Pay button and wait until the sheet is drawn and owns keyboard focus. */
async function tapApplePay(page: Page, route: string) {
  await card(page, route).locator("#applepay").click();
  await expect(page.locator("[data-photon-pay-overlay]")).toHaveAttribute("data-visible", "true");
  await page.waitForFunction(() => Boolean(document.activeElement?.closest(".pp-sheet")));
}

async function nativeCalls(page: Page): Promise<string[]> {
  const calls: string[] = [];
  for (const frame of page.frames()) calls.push(...(await frame.evaluate(() => (window as unknown as { __nativeCalls?: string[] }).__nativeCalls ?? [])));
  return calls;
}

test.describe("checkout app card and the recreated Apple Pay presentation", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium-ios-light-e2e", "runs once on Chromium; a WebKit smoke runs below");
  });

  test("opens over the whole phone, keeps the checkout mounted, and returns it unchanged", async ({ page }) => {
    test.setTimeout(60_000);
    const observed = await observe(page);
    const shell = await openCheckoutFlow(page, checkoutFlow(["hotel", "pass"]));
    const hotel = card(page, "hotel");
    await expect(hotel.locator("#title")).toHaveText("Private retreat");
    await expect(hotel.locator("#price")).toHaveText("$2,040");
    await expect(card(page, "pass").locator("#price")).toHaveText("$24");
    const token = await hotel.locator("html").getAttribute("data-load-token");
    await hotel.locator("#note").fill("Ocean view, please");
    const iframe = page.locator('[data-message-id="card-hotel"] iframe');
    const iframeBox = await iframe.boundingBox();
    const shellBox = (await shell.boundingBox())!;

    await hotel.locator("#applepay").click();
    const overlay = page.locator("[data-photon-pay-overlay]");
    await expect(overlay).toHaveAttribute("data-visible", "true");
    await expect(hotel.locator("html")).toHaveAttribute("data-photon-pay-state", "opened");

    // Card fan: three visible regions, red card in front at its measured 202 px width.
    await waitForSourceFrame(page, 90);
    const fan = await page.evaluate(() => {
      const box = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
      const opacity = (selector: string) => getComputedStyle(document.querySelector(selector)!).opacity;
      return { front: box(".pp-front"), left: opacity(".pp-side-left"), right: opacity(".pp-side-right"), frame: Number(document.querySelector("[data-photon-pay-overlay]")!.getAttribute("data-source-frame")) };
    });
    if (fan.frame < 100) {
      expect(fan.front.width).toBeCloseTo(202 * scale, 0);
      expect([fan.left, fan.right]).toEqual(["1", "1"]);
    }
    // Growth: the red card enlarges to 248 px and the side strips go behind it.
    await waitForSourceFrame(page, 125);
    expect((await page.locator(".pp-front").boundingBox())!.width).toBeCloseTo(248 * scale, 0);
    await expect(page.locator(".pp-side-left")).toHaveCSS("opacity", "0");

    // The overlay and its dim cover the entire phone surface, not the 280 × 240 card.
    expect(await overlay.boundingBox()).toEqual(shellBox);
    expect(await overlay.locator(".pp-scrim").boundingBox()).toEqual(shellBox);
    expect(Number(await overlay.locator(".pp-scrim").evaluate((element) => getComputedStyle(element).opacity))).toBeGreaterThan(0.48);
    const sheet = (await overlay.locator(".pp-sheet").boundingBox())!;
    const tolerance = 3 * scale;
    expect(Math.abs(sheet.x - shellBox.x - 10 * scale)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(sheet.y - shellBox.y - (offsetY + 254 * scale))).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(sheet.width - 492 * scale)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(sheet.height - 848 * scale)).toBeLessThanOrEqual(tolerance);

    // The checkout stays mounted and visible under the dim, and the phone behind is inert.
    await expect(iframe).toBeVisible();
    expect(await iframe.boundingBox()).toEqual(iframeBox);
    expect(await iframe.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(true);
    await expectAmounts(page, "$2,040.00", "Orchid — Villa Amara", "127.0.0.1");

    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(hotel.locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");
    await expect(page.locator('[data-app-card-id="card-hotel"]')).toHaveAttribute("data-load-count", "1");
    await expect(hotel.locator("html")).toHaveAttribute("data-load-token", token!);
    await expect(hotel.locator("#note")).toHaveValue("Ocean view, please");
    expect(await iframe.evaluate((element) => Boolean(element.closest("[inert]")))).toBe(false);
    expect(await iframe.evaluate((element) => document.activeElement === element)).toBe(true);

    // A different checkout shows its own values in every location, then the first shows its own again.
    await tapApplePay(page, "pass");
    await expectAmounts(page, "$24.00", "Lark — Day pass", "127.0.0.1");
    await page.locator(".pp-close").click();
    await expectClosed(page);
    await tapApplePay(page, "hotel");
    await expectAmounts(page, "$2,040.00", "Orchid — Villa Amara", "127.0.0.1");
    await page.locator(".pp-close").click();
    await expectClosed(page);

    const decisions = (await payState(page)).decisions.map((decision) => decision.kind);
    expect(decisions).toEqual(["opened", "cancelled", "opened", "cancelled", "opened", "cancelled"]);
    for (const route of ["hotel", "pass"]) await expect(page.locator(`[data-app-card-id="card-${route}"]`)).toHaveAttribute("data-load-count", "1");
    expect(await nativeCalls(page)).toEqual([]);
    expect(observed.external).toEqual([]);
    expect(observed.popups).toEqual([]);
    expect(observed.errors).toEqual([]);
  });

  test("0-, 2-, and 3-decimal checkouts show their exact amounts", async ({ page }) => {
    await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["eur", "jpy"], "checkout-currencies"));
    const cases: Array<[string, string, string]> = [
      ["eur", "€79.95", "Maison Verte — Tasting menu"],
      ["jpy", "¥1,200", "Kissa Hoshi — Omakase"],
    ];
    for (const [route, formatted, merchant] of cases) {
      await tapApplePay(page, route);
      await expectAmounts(page, formatted, merchant, "127.0.0.1");
      await page.keyboard.press("Escape");
      await expectClosed(page);
    }
  });

  test("a three-decimal currency and the 280.00 flight fixture", async ({ page }) => {
    await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["kwd", "flight"], "checkout-kwd"));
    await tapApplePay(page, "kwd");
    await expectAmounts(page, "KWD 12.345", "Souq Lane — Oud sampler", "127.0.0.1");
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await tapApplePay(page, "flight");
    await expectAmounts(page, "$280.00", "Orchid — DPS to SIN", "127.0.0.1");
  });

  test("rapid taps and repeated messages create one sheet; stale IDs cannot reopen it", async ({ page }) => {
    await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["hotel"], "checkout-dedupe"));
    const hotel = card(page, "hotel");
    await hotel.locator("#applepay").click({ clickCount: 2 });
    await hotel.locator("#applepay").dispatchEvent("touchend");
    await expect(page.locator("[data-photon-pay-overlay]")).toHaveAttribute("data-visible", "true");
    await expect(page.locator(".pp-host")).toHaveCount(1);
    expect((await payState(page)).decisions.filter((decision) => decision.kind === "opened")).toHaveLength(1);

    const frame = page.frames().find((item) => item.url().startsWith(`${CHECKOUT}/hotel`))!;
    const post = (requestId: string, checkout?: unknown) =>
      frame.evaluate(
        ([id, payload]) => {
          const message = { type: "photon-pay:open", version: 1, requestId: id, checkout: payload ?? (window as unknown as { __checkout: { checkout: unknown } }).__checkout.checkout };
          parent.postMessage(message, "http://127.0.0.1:4173");
          parent.postMessage(message, "http://127.0.0.1:4173");
        },
        [requestId, checkout] as const,
      );
    await post("replayed-request-01");
    await expect.poll(async () => (await payState(page)).decisions.slice(-2).map((decision) => decision.kind)).toEqual(["busy", "busy"]);
    const openedId = (await payState(page)).active!.requestId;
    await frame.evaluate((id) => parent.postMessage({ type: "photon-pay:open", version: 1, requestId: id, checkout: (window as unknown as { __checkout: { checkout: unknown } }).__checkout.checkout }, "http://127.0.0.1:4173"), openedId);
    await expect.poll(async () => (await payState(page)).decisions.at(-1)?.kind).toBe("duplicate");
    expect((await payState(page)).decisions.filter((decision) => decision.kind === "opened")).toHaveLength(1);

    await page.waitForFunction(() => Boolean(document.activeElement?.closest(".pp-sheet")));
    await page.keyboard.press("Escape");
    await expectClosed(page);
    const results = await frame.evaluate((id) => {
      return new Promise<string[]>((resolve) => {
        const states: string[] = [];
        window.addEventListener("message", (event) => {
          if (event.data?.requestId === id) states.push(event.data.state);
        });
        parent.postMessage({ type: "photon-pay:open", version: 1, requestId: id, checkout: (window as unknown as { __checkout: { checkout: unknown } }).__checkout.checkout }, "http://127.0.0.1:4173");
        setTimeout(() => resolve(states), 300);
      });
    }, openedId);
    expect(results).toEqual(["cancelled"]);
    await expectClosed(page);

    // The same iframe opens again with a fresh tap.
    await hotel.locator("#applepay").click();
    await expect(page.locator("[data-photon-pay-overlay]")).toHaveAttribute("data-visible", "true");
    expect((await payState(page)).decisions.filter((decision) => decision.kind === "opened")).toHaveLength(2);
  });

  test("wrong origin, wrong source, malformed and invalid requests change nothing", async ({ page }) => {
    await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["hotel"], "checkout-reject"));
    const frame = page.frames().find((item) => item.url().startsWith(`${CHECKOUT}/hotel`))!;
    const valid = await frame.evaluate(() => (window as unknown as { __checkout: { checkout: Record<string, string> } }).__checkout.checkout);

    // Right window, spoofed origin (only a synthetic event can do this).
    await page.evaluate((checkout) => {
      const iframe = document.querySelector<HTMLIFrameElement>('[data-slot="app-card"] iframe')!;
      window.dispatchEvent(new MessageEvent("message", { origin: "http://127.0.0.1:4175", source: iframe.contentWindow, data: { type: "photon-pay:open", version: 1, requestId: "spoofed-origin-1", checkout } }));
    }, valid);
    // Right origin, wrong window: a nested same-origin frame inside the checkout.
    await frame.evaluate((checkout) => {
      const nested = document.createElement("iframe");
      document.body.append(nested);
      (nested.contentWindow as unknown as { eval(code: string): void }).eval(
        `parent.parent.postMessage(${JSON.stringify({ type: "photon-pay:open", version: 1, requestId: "nested-source-1", checkout })}, "http://127.0.0.1:4173")`,
      );
    }, valid);
    // The renderer's own window.
    await page.evaluate((checkout) => window.postMessage({ type: "photon-pay:open", version: 1, requestId: "self-post-0001", checkout }, "*"), valid);
    // Malformed envelopes from the real checkout.
    await frame.evaluate((checkout) => {
      for (const data of [
        { type: "photon-pay:open", version: 2, requestId: "version-two-01", checkout },
        { type: "photon-pay:open", version: 1, requestId: "bad id", checkout },
        { type: "photon-pay:open", version: 1, checkout },
        "photon-pay:open",
      ]) parent.postMessage(data, "http://127.0.0.1:4173");
    }, valid);
    await expect.poll(async () => (await payState(page)).decisions.length).toBe(7);
    expect((await payState(page)).decisions).toEqual([
      { kind: "ignored", reason: "wrong-origin" },
      { kind: "ignored", reason: "unknown-source" },
      { kind: "ignored", reason: "unknown-source" },
      { kind: "ignored", reason: "malformed" },
      { kind: "ignored", reason: "malformed" },
      { kind: "ignored", reason: "malformed" },
      { kind: "ignored", reason: "malformed" },
    ]);
    await expectClosed(page);

    // An invalid checkout is answered and does not replace the last valid one.
    await tapApplePay(page, "hotel");
    await page.keyboard.press("Escape");
    await expectClosed(page);
    const before = (await payState(page)).request;
    const answer = await frame.evaluate((checkout) => {
      return new Promise<string | undefined>((resolve) => {
        window.addEventListener("message", (event) => {
          if (event.data?.requestId === "invalid-amount-1") resolve(event.data.state);
        });
        parent.postMessage({ type: "photon-pay:open", version: 1, requestId: "invalid-amount-1", checkout: { ...checkout, amount: "$24.00" } }, "http://127.0.0.1:4173");
        setTimeout(() => resolve(undefined), 500);
      });
    }, valid);
    expect(answer).toBe("invalid");
    expect((await payState(page)).request).toEqual(before);
    await expectClosed(page);
  });

  test("card picker extension, keyboard focus, and closing during the entrance and card growth", async ({ page }) => {
    await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["hotel"], "checkout-interaction"));
    const hotel = card(page, "hotel");
    const overlay = page.locator("[data-photon-pay-overlay]");

    await tapApplePay(page, "hotel");
    await waitForSourceFrame(page, 84);
    await overlay.getByRole("button", { name: "Other Cards & Pay Later Options" }).click();
    await expect(overlay).toHaveAttribute("data-picker", "open");
    await expect(overlay.getByRole("button", { name: "Back" })).toBeFocused();
    await overlay.getByRole("button", { name: /^Rho/ }).click();
    await expect(overlay).toHaveAttribute("data-picker", "closed");
    await expect(overlay).toHaveAttribute("data-selected-card", "rho");
    await expect(overlay.locator(".pp-card-label")).toHaveText("Rho");
    await expect(overlay.locator('[data-amount="pay-line"]')).toHaveText("Pay $2,040.00");
    await overlay.getByRole("button", { name: "Other Cards & Pay Later Options" }).click();
    await page.keyboard.press("Escape");
    await expect(overlay).toHaveAttribute("data-picker", "closed");
    await expect(overlay).toHaveAttribute("data-visible", "true");

    // Focus stays inside the sheet.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".pp-sheet")))).toBe(true);
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".pp-sheet")))).toBe(true);
    await overlay.getByRole("button", { name: "Close Apple Pay" }).focus();
    await page.keyboard.press("Enter");
    await expectClosed(page);
    await expect(hotel.locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");

    // Close while the sheet is still rising.
    await hotel.locator("#applepay").click();
    await page.waitForFunction(() => {
      const frame = Number(document.querySelector("[data-photon-pay-overlay]")?.getAttribute("data-source-frame"));
      return frame >= 67 && frame < 80;
    });
    await page.keyboard.press("Escape");
    await expectClosed(page);
    expect(await overlay.getAttribute("data-selected-card")).toBe("bofa");

    // Close while the red card is growing.
    await hotel.locator("#applepay").click();
    await waitForSourceFrame(page, 103);
    const growing = await sourceFrame(page);
    expect(growing).toBeLessThan(121);
    await page.locator(".pp-close").click();
    await expectClosed(page);
    await expect(page.locator('[data-app-card-id="card-hotel"]')).toHaveAttribute("data-load-count", "1");
  });

  test("Replay while the sheet is open removes it with the card; the returning card opens it again", async ({ page }) => {
    const observed = await observe(page);
    await openCheckoutFlow(page, checkoutFlow(["pass"], "checkout-replay"));
    const overlay = page.locator("[data-photon-pay-overlay]");
    await tapApplePay(page, "pass");
    await expectAmounts(page, "$24.00", "Lark — Day pass", "127.0.0.1");
    await expect(page.locator('[data-slot="ios-messages-app"] > [inert]').first()).toBeAttached();

    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await expect(overlay).toHaveAttribute("data-visible", "false");
    await expect(overlay.locator(".pp-scrim")).toBeHidden();
    await expect(page.locator('[data-slot="app-card"]')).toHaveCount(0);
    await expect(page.locator('[data-slot="ios-messages-app"] > [inert]')).toHaveCount(0);
    let state = await payState(page);
    expect(state.active).toBeNull();
    expect(state.request).toBeNull();
    expect(state.decisions.map((decision) => decision.kind)).toEqual(["opened", "withdrawn"]);

    // Playback brings the card back as a fresh iframe; a new tap opens the sheet normally.
    await expect(page.locator('[data-slot="app-card"][data-app-card-id="card-pass"]')).toHaveAttribute("data-load-count", "1");
    await tapApplePay(page, "pass");
    await expectAmounts(page, "$24.00", "Lark — Day pass", "127.0.0.1");
    await expect(card(page, "pass").locator("html")).toHaveAttribute("data-photon-pay-state", "opened");
    state = await payState(page);
    expect(state.decisions.map((decision) => decision.kind)).toEqual(["opened", "withdrawn", "opened"]);
    await page.keyboard.press("Escape");
    await expectClosed(page);
    await expect(card(page, "pass").locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");
    expect(await nativeCalls(page)).toEqual([]);
    expect(observed.errors).toEqual([]);
  });

  test("deterministic capture hook seeks the recorded sequence", async ({ page }) => {
    await observe(page);
    const shell = await openCheckoutFlow(page, checkoutFlow(["hotel"], "checkout-seek"));
    await page.evaluate(() => window.__photonPay!.setTime(3));
    const overlay = page.locator("[data-photon-pay-overlay]");
    await expect(overlay).toHaveAttribute("data-source-frame", "90");
    await expect(overlay).toHaveAttribute("data-visible", "true");
    const shellBox = (await shell.boundingBox())!;
    const front = (await overlay.locator(".pp-front").boundingBox())!;
    expect(Math.abs(front.x - shellBox.x - 156 * scale)).toBeLessThanOrEqual(3 * scale);
    expect(Math.abs(front.y - shellBox.y - (offsetY + 477 * scale))).toBeLessThanOrEqual(3 * scale);
    await page.evaluate(() => window.__photonPay!.setTime(4.5));
    await expect(overlay).toHaveAttribute("data-source-frame", "135");
    await page.evaluate(() => window.__photonPay!.setTime(0));
    await expectClosed(page);
  });

  test("reduced motion presents the settled sheet without the entrance", async ({ page }) => {
    await observe(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCheckoutFlow(page, checkoutFlow(["hotel"], "checkout-reduced"));
    await tapApplePay(page, "hotel");
    await expect(page.locator("[data-photon-pay-overlay]")).toHaveAttribute("data-source-frame", "135");
    await page.keyboard.press("Escape");
    await expectClosed(page);
  });

  test("an origin missing from the renderer configuration is never embedded", async ({ page }) => {
    const observed = await observe(page);
    await page.addInitScript((payload) => {
      if (location.origin === "http://127.0.0.1:4173") sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload));
    }, checkoutFlow(["http://127.0.0.1:4175/hotel"], "checkout-unlisted"));
    await page.setViewportSize({ width: phone.width, height: phone.height + playbackBarHeightPx });
    await page.goto(`/?flow=checkout-unlisted&t=1500`);
    const dock = page.locator('[data-slot="app-card"]');
    await expect(dock).toHaveAttribute("data-embed", "origin-not-allowed");
    await expect(dock.locator("iframe")).toHaveCount(0);
    await expect(dock.locator('[data-slot="app-card-error"]')).toContainText("VITE_PHOTON_CHECKOUT_ORIGINS");
    expect(observed.external).toEqual([]);
  });

  test("a flow without an app card renders no card layer or overlay", async ({ page }) => {
    await observe(page);
    const scenario = JSON.parse(readFileSync(path.join(root, "scenarios/basic-ios-light.json"), "utf8")) as { id: string };
    await page.addInitScript((payload) => sessionStorage.setItem("imessage-demo-inline", JSON.stringify(payload)), scenario);
    await page.goto(`/?flow=${scenario.id}&t=0`);
    await expect(page.locator('[data-slot="ios-messages-app"]')).toBeVisible();
    await expect(page.locator("[data-photon-pay-overlay]")).toHaveCount(0);
    await expect(page.locator('[data-slot="app-card"], [data-slot="app-card-style"]')).toHaveCount(0);
    expect(await page.evaluate(() => "__photonPay" in window)).toBe(false);
  });
});

test("WebKit: the checkout opens the sheet and returns unchanged", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-ios-dark-e2e", "WebKit smoke runs once");
  await observe(page);
  const flow = { ...checkoutFlow(["hotel"], "checkout-webkit"), theme: "dark" };
  await openCheckoutFlow(page, flow);
  const hotel = card(page, "hotel");
  const token = await hotel.locator("html").getAttribute("data-load-token");
  await tapApplePay(page, "hotel");
  await expectAmounts(page, "$2,040.00", "Orchid — Villa Amara", "127.0.0.1");
  await page.keyboard.press("Escape");
  await expectClosed(page);
  await expect(hotel.locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");
  await expect(hotel.locator("html")).toHaveAttribute("data-load-token", token!);
  await expect(page.locator('[data-app-card-id="card-hotel"]')).toHaveAttribute("data-load-count", "1");
  expect(await nativeCalls(page)).toEqual([]);
});
