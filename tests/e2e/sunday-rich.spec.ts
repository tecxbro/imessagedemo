import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const origin = "http://127.0.0.1:4173";

type RichMessage = Scenario["messages"][number] & {
  replyTo?: string;
  poll?: { question: string; options: Array<{ id: string; text: string }> };
  images?: Array<{ src: string }>;
  video?: { src: string };
  appCard?: { url: string };
};
type RichFlow = Omit<Scenario, "messages"> & {
  messages: RichMessage[];
  events: Array<{ type: string; messageId?: string; optionId?: string; voted?: boolean }>;
};

function load(id: string) {
  const { targets: _targets, checkpoints, ...source } = JSON.parse(readFileSync(path.join(root, "scenarios", `${id}.json`), "utf8"));
  const flow = source as RichFlow;
  for (const message of flow.messages) {
    if (message.appCard) message.appCard.url = `${origin}/checkouts/sunday-tip.html`;
  }
  function checkpoint(...ids: string[]): number {
    const found = (checkpoints as Array<{ id: string; atMs: number }>).find((item) => ids.includes(item.id));
    if (!found) throw new Error(`${id} is missing checkpoint ${ids.join(" / ")}`);
    return found.atMs;
  }
  return { flow, checkpoint };
}

async function trapNativePayments(page: Page) {
  const popups: string[] = [];
  page.on("popup", (popup) => popups.push(popup.url()));
  await page.addInitScript(() => {
    const calls: string[] = [];
    Object.defineProperty(window, "__nativeCalls", { value: calls });
    window.open = (() => { calls.push("window.open"); return null; }) as typeof window.open;
    class NativePaymentTrap {
      constructor() { calls.push("new ApplePaySession"); }
      static canMakePayments() { calls.push("canMakePayments"); return true; }
      begin() { calls.push("begin"); }
    }
    (window as unknown as { ApplePaySession: unknown }).ApplePaySession = NativePaymentTrap;
  });
  return popups;
}

test.describe("Sunday polls, media, replies, and visual tipping", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium-ios-light-e2e", "Sunday rich conversations use the iOS light presentation");
  });

  for (const id of ["sunday-coffee-poll", "sunday-dinner-poll", "sunday-laundry-poll"]) {
    test(`${id} renders its authored choices and media, then cancels and reopens the $5 sheet`, async ({ page }, info) => {
      test.setTimeout(60_000);
      const { flow, checkpoint } = load(id);
      const observed = await installObservers(page);
      const popups = await trapNativePayments(page);
      const phone = await openFlow(page, flow, checkpoint("poll-before"));
      const pollMessage = flow.messages.find((message) => message.kind === "poll")!;
      expect(pollMessage).toBeTruthy();
      const vote = flow.events.find((event) => event.type === "poll-vote" && event.messageId === pollMessage.id && event.voted !== false)!;
      expect(vote).toBeTruthy();
      const poll = page.locator(`[data-message-id="${pollMessage.id}"]`);
      if (pollMessage.poll!.question) {
        await expect(poll.locator('[data-slot="poll-question"]')).toHaveText(pollMessage.poll!.question);
      } else {
        await expect(poll.locator('[data-slot="poll-question"]')).toHaveCount(0);
      }
      for (const option of pollMessage.poll!.options) {
        await expect(poll.locator(`[data-option-id="${option.id}"]`)).toHaveAttribute("data-selected", "false");
      }
      await seek(page, checkpoint("poll-selected"));
      await expect(poll.locator(`[data-option-id="${vote.optionId}"]`)).toHaveAttribute("data-selected", "true");
      await phone.screenshot({ path: info.outputPath(`${id}-poll-selected.png`) });

      await seek(page, checkpoint("reply", "quoted-reply"));
      const reply = flow.messages.find((message) => message.replyTo)!;
      const quoted = flow.messages.find((message) => message.id === reply.replyTo)!;
      await expect(page.locator(`[data-message-id="${reply.id}"] [data-slot="reply-stub"]`)).toContainText(quoted.text);
      const imageMessage = flow.messages.find((message) => message.kind === "image")!;
      const imageTime = imageMessage.atMs - flow.messages[0].atMs + 1400;
      await seek(page, imageTime);
      const image = page.locator(`[data-message-id="${imageMessage.id}"] img`).first();
      await expect(image).toHaveAttribute("src", imageMessage.images![0].src);
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);

      await seek(page, checkpoint("video"));
      const videoMessage = flow.messages.find((message) => message.id === "proof-video")!;
      expect(videoMessage.kind).toBe("video");
      const video = page.locator('[data-message-id="proof-video"] video');
      await expect(video).toBeVisible();
      await expect(video).toHaveAttribute("src", videoMessage.video!.src);
      await expect.poll(() => video.evaluate((element) => (element as HTMLVideoElement).readyState)).toBeGreaterThanOrEqual(2);
      expect(await video.evaluate((element) => (element as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
      expect(await video.evaluate((element) => (element as HTMLVideoElement).duration)).toBeGreaterThan(0);
      expect(await video.evaluate((element) => (element as HTMLVideoElement).error)).toBeNull();
      await phone.screenshot({ path: info.outputPath(`${id}-video.png`) });

      await seek(page, checkpoint("reaction-landed"));
      await expect(page.locator('[data-message-id="m7"] [data-slot="tapback"][data-own="true"]')).toHaveCount(1);
      await seek(page, checkpoint("ready-to-tip"));
      const dock = page.locator('[data-app-card-id="tip-checkout"]');
      const checkout = dock.frameLocator("iframe");
      const button = checkout.getByRole("button", { name: "Apple Pay", exact: true });
      await expect(dock).toHaveAttribute("data-load-count", "1");
      await expect(checkout.locator("#price")).toHaveText("$5.00");
      await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "ready");
      await checkout.locator("html").evaluate((html) => { html.dataset.testMountToken = "kept-mounted"; });
      await phone.screenshot({ path: info.outputPath(`${id}-ready-to-tip.png`) });

      const overlay = page.locator("[data-photon-pay-overlay]");
      for (const close of ["escape", "button"]) {
        await button.click();
        await expect(overlay).toHaveAttribute("data-visible", "true");
        await expect(overlay.locator('[data-slot="apple-pay-merchant"]')).toHaveText("Pay Sunday — Tip for Memo");
        await expect(overlay.locator('[data-amount="primary"]')).toHaveText("$5.00");
        await expect(overlay.locator('[data-amount="pay-line"]')).toHaveText("Pay $5.00");
        await expect(overlay.locator('[data-amount="total"]')).toHaveText("$5.00");
        await page.waitForFunction(() => Boolean(document.activeElement?.closest(".pp-sheet")));
        if (close === "escape") {
          await page.waitForFunction(() => Number(document.querySelector("[data-photon-pay-overlay]")?.getAttribute("data-source-frame")) >= 125);
          expect(await overlay.boundingBox()).toEqual(await phone.boundingBox());
          await phone.screenshot({ path: info.outputPath(`${id}-apple-pay.png`) });
          await page.keyboard.press("Escape");
        } else {
          await overlay.getByRole("button", { name: "Close Apple Pay", exact: true }).click();
        }
        await expect(overlay).toHaveAttribute("data-visible", "false");
        await expect(checkout.locator("html")).toHaveAttribute("data-photon-pay-state", "cancelled");
        await expect(dock).toHaveAttribute("data-load-count", "1");
        await expect(checkout.locator("html")).toHaveAttribute("data-test-mount-token", "kept-mounted");
        await expect(button).toBeEnabled();
      }
      for (const frame of page.frames()) {
        expect(await frame.evaluate(() => (window as unknown as { __nativeCalls: string[] }).__nativeCalls)).toEqual([]);
      }
      expect(observed.pageErrors).toEqual([]);
      expect(observed.external).toEqual([]);
      expect(popups).toEqual([]);
    });
  }
});
