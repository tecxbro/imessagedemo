import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const source = JSON.parse(readFileSync(path.join(root, "scenarios/sunday-morning-espresso.json"), "utf8"));
delete source.targets;
delete source.checkpoints;
// Use the actual Sunday conversation, with its checkout on the test server's allowlisted origin.
source.messages = source.messages.map((message: Record<string, unknown>) => message.kind === "app-card"
  ? { ...message, appCard: { ...(message.appCard as object), url: "http://127.0.0.1:4173/checkouts/sunday-tip.html" } }
  : message);
const flow = source as Scenario;
const resultText = "Your espresso is ready by the machine. ☕";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-ios-light-e2e", "Sunday local interactions run once");
});

async function openSunday(page: Page) {
  const observed = await installObservers(page);
  await openFlow(page, flow, 28_000);
  await expect(page.locator('[data-message-id="m7"]')).toContainText(resultText);
  await expect(page.locator('[data-app-card-id="tip-checkout"]')).toHaveCount(0);
  return observed;
}

async function holdMessage(page: Page, id = "m7") {
  await expect(page.getByRole("dialog", { name: "Message options", exact: true })).toHaveCount(0);
  const bubble = page.locator(`[data-slot="message-list"] [data-message-id="${id}"] [data-slot="bubble"]`).last();
  await expect(bubble).toBeVisible();
  await bubble.scrollIntoViewIfNeeded();
  const bounds = await bubble.boundingBox();
  if (!bounds) throw new Error(`Message ${id} has no visible bubble`);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  try {
    // Exercise the pin's actual pointer-hold timer, rather than calling a callback or using a scripted overlay.
    await expect(page.getByRole("dialog", { name: "Message options", exact: true })).toBeVisible();
  } finally {
    await page.mouse.up();
  }
  return page.getByRole("dialog", { name: "Message options", exact: true });
}

test("holding a message pauses playback and Copy writes the selected text", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { (window as unknown as { __copiedText: string }).__copiedText = text; },
    } });
  });
  const observed = await openSunday(page);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  const actions = await holdMessage(page);
  const paused = await page.evaluate(() => window.IMESSAGE_DEMO!.state());
  expect(paused.playing).toBe(false);
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("message-options.png") });
  await actions.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(actions).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __copiedText: string }).__copiedText)).toBe(resultText);
  expect(await page.evaluate(() => window.IMESSAGE_DEMO!.state())).toMatchObject({ timeMs: paused.timeMs, playing: false });
  expect(observed.pageErrors).toEqual([]);
});

test("Select toggles the held message and Done selecting restores the conversation", async ({ page }, testInfo) => {
  const observed = await openSunday(page);
  const actions = await holdMessage(page);
  await actions.getByRole("menuitem", { name: "Select", exact: true }).click();
  await expect(actions).toHaveCount(0);
  const selection = page.getByRole("checkbox", { name: resultText, exact: true });
  await expect(selection).toBeChecked();
  await selection.click();
  await expect(selection).not.toBeChecked();
  await selection.click();
  await expect(selection).toBeChecked();
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("message-selection.png") });
  await page.getByRole("button", { name: "Done selecting", exact: true }).click();
  await expect(page.locator('[data-slot="ios-select-mode"]')).not.toHaveAttribute("data-active", "true");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeEnabled();
  expect(observed.pageErrors).toEqual([]);
});

test("Reply sends a local quoted message, opens its thread, and Replay demo clears it", async ({ page }, testInfo) => {
  const observed = await openSunday(page);
  const actions = await holdMessage(page);
  await actions.getByRole("menuitem", { name: "Reply", exact: true }).click();
  await expect(actions).toHaveCount(0);
  await expect(page.locator('[data-slot="preview-reply-context"]')).toContainText(resultText);
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(composer).toHaveAttribute("placeholder", "Reply to Sunday");
  const replyText = "Perfect. I'll grab it now.";
  await composer.fill(replyText);
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("reply-composer.png") });
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const reply = page.locator('[data-slot="message-list"] [data-message-id]').filter({ hasText: replyText });
  await expect(reply).toHaveCount(1);
  await expect(reply).toHaveAttribute("data-direction", "outgoing");
  await expect(reply.locator('[data-slot="message-bubble"][data-direction="outgoing"]')).toContainText(replyText);
  await expect(reply.locator('[data-slot="reply-jump"]')).toHaveAttribute("data-target-id", "m7");
  await expect(reply.locator('[data-slot="reply-stub"]')).toContainText(resultText);
  await expect(composer).toHaveValue("");
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("sent-reply.png") });

  await page.locator('[data-message-id="m7"]').getByRole("button", { name: "Show 1 reply", exact: true }).click();
  const thread = page.getByRole("dialog", { name: "Replies", exact: true });
  await expect(thread.locator('[data-slot="thread-root"]')).toContainText(resultText);
  await expect(thread.locator('[data-slot="thread-row"][data-direction="outgoing"]')).toContainText(replyText);
  await thread.getByRole("button", { name: "Back to the conversation", exact: true }).click();
  await expect(thread).toHaveCount(0);

  await page.getByRole("button", { name: "Replay demo", exact: true }).click();
  await expect(page.locator('[data-message-id="m1"]')).toBeVisible();
  await expect(reply).toHaveCount(0);
  await expect(page.locator('[data-slot="preview-reply-context"]')).toHaveCount(0);
  await seek(page, 28_000);
  await expect(page.locator('[data-message-id="m7"] [data-slot="reply-count"]')).toHaveCount(0);
  await expect(reply).toHaveCount(0);
  expect(observed.pageErrors).toEqual([]);
});

test("classic and custom emoji reactions persist when message options reopen", async ({ page }) => {
  const observed = await openSunday(page);
  let actions = await holdMessage(page);
  await actions.getByRole("menuitemradio", { name: "Love", exact: true }).click();
  const reactions = page.locator('[data-message-id="m7"] [data-slot="tapback"]');
  await expect(reactions).toHaveCount(1);
  await expect(reactions).toHaveAttribute("data-reaction", "love");
  await expect(reactions).toHaveAttribute("data-own", "true");
  actions = await holdMessage(page);
  await expect(actions.getByRole("menuitemradio", { name: "Love", exact: true })).toBeChecked();
  await actions.getByRole("menuitem", { name: "Choose an emoji", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose a reaction", exact: true });
  await picker.getByRole("textbox", { name: "Emoji", exact: true }).fill("🥳");
  await picker.getByRole("button", { name: "React", exact: true }).click();
  await expect(picker).toHaveCount(0);
  await expect(reactions).toHaveCount(1);
  await expect(reactions).toHaveAttribute("data-reaction", "emoji");
  await expect(reactions).toContainText("🥳");
  actions = await holdMessage(page);
  await expect(actions.getByRole("menuitemradio", { name: "Love", exact: true })).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(actions).toHaveCount(0);
  await expect(reactions).toContainText("🥳");
  await page.getByRole("button", { name: "Replay demo", exact: true }).click();
  await seek(page, 28_000);
  await expect(reactions).toHaveCount(0);
  expect(observed.pageErrors).toEqual([]);
});

test("API reset removes local messages and dialogs while seek restores authored overlays", async ({ page }, testInfo) => {
  const observed = await openSunday(page);
  const localText = "This message belongs only to my local session.";
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(localText);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const localMessage = page.locator('[data-slot="message-list"] [data-message-id]').filter({ hasText: localText });
  await expect(localMessage).toHaveCount(1);
  let actions = await holdMessage(page);
  await actions.getByRole("menuitem", { name: "Choose an emoji", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose a reaction", exact: true });
  await expect(picker).toBeVisible();
  await expect(actions).toHaveCount(0);
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("emoji-before-api-reset.png") });

  await page.evaluate(async () => {
    const reset = await window.IMESSAGE_DEMO!.reset();
    await window.IMESSAGE_DEMO!.ready(reset.revision);
  });
  await expect(picker).toHaveCount(0);
  await expect(localMessage).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[data-message-id="m1"]')).toBeVisible();
  expect(await page.evaluate(() => window.IMESSAGE_DEMO!.state())).toMatchObject({ timeMs: 0, playing: false });
  await seek(page, 28_000);
  await expect(localMessage).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Seeking from another local dialog must release transient state so the scripted menu can appear.
  actions = await holdMessage(page);
  await actions.getByRole("menuitem", { name: "Choose an emoji", exact: true }).click();
  await expect(picker).toBeVisible();
  await seek(page, 31_000);
  await expect(picker).toHaveCount(0);
  const scripted = page.getByRole("dialog", { name: "Message options", exact: true });
  await expect(scripted).toBeVisible();
  await expect(scripted).toHaveAttribute("data-phase", "open");
  await expect(scripted.locator('[data-slot="lifted-bubble"]')).toContainText(resultText);
  await expect(localMessage).toHaveCount(0);
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("authored-menu-after-api-seek.png") });
  expect(observed.pageErrors).toEqual([]);
});

test("the later Sunday checkout retains its $5 amount after a local interaction and replay", async ({ page }) => {
  const observed = await openSunday(page);
  const actions = await holdMessage(page);
  await actions.getByRole("menuitemradio", { name: "Love", exact: true }).click();
  await expect(page.locator('[data-message-id="m7"] [data-reaction="love"]')).toBeVisible();
  await page.getByRole("button", { name: "Replay demo", exact: true }).click();
  await expect(page.locator('[data-message-id="m7"]')).toHaveCount(0);
  await seek(page, 45_690);
  const checkout = page.locator('[data-app-card-id="tip-checkout"]').frameLocator("iframe");
  await expect(checkout.locator("#price")).toHaveText("$5.00");
  await checkout.getByRole("button", { name: "Apple Pay", exact: true }).click();
  const sheet = page.locator("[data-photon-pay-overlay]");
  await expect(sheet).toHaveAttribute("data-visible", "true");
  await expect(sheet.locator('[data-amount="primary"]')).toHaveText("$5.00");
  await expect(sheet.locator('[data-amount="total"]')).toHaveText("$5.00");
  await sheet.getByRole("button", { name: "Close Apple Pay", exact: true }).click();
  await expect(sheet).toHaveAttribute("data-visible", "false");
  expect(observed.pageErrors).toEqual([]);
  expect(observed.external).toEqual([]);
});
