import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

type DraftEvent = { type: string; atMs: number; value?: string };
type ComposerFlow = Scenario & { events: DraftEvent[] };
const ids = [
  "sunday-coffee-poll", "sunday-dinner-poll", "sunday-laundry-poll",
  "sunday-morning-espresso", "sunday-dinner-cleanup", "sunday-sock-pile",
];

function load(id: string): ComposerFlow {
  const { targets, checkpoints, ...flow } = JSON.parse(readFileSync(`scenarios/${id}.json`, "utf8"));
  for (const message of flow.messages) {
    if (message.appCard) message.appCard.url = "http://127.0.0.1:4173/checkouts/sunday-tip.html";
  }
  return flow;
}

function beforeSend(flow: ComposerFlow, message: Scenario["messages"][number]) {
  const earlier = flow.messages.filter(item => item.atMs < message.atMs).at(-1)?.atMs ?? flow.startAtMs!;
  const drafts = flow.events.filter(event => event.type === "draft" && event.atMs >= earlier && event.atMs < message.atMs && event.value);
  const partial = drafts.find(event => event.value!.length >= Math.floor(message.text.length / 2) && event.value !== message.text);
  expect(partial, `partial draft for ${message.id}`).toBeTruthy();
  expect(drafts.at(-1)?.value).toBe(message.text);
  return partial!;
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium-ios-light-e2e", "Sunday composer synchronization runs once");
});

for (const id of ids) {
  test(`${id} types each blue text message and clears it exactly when sent`, async ({ page }, info) => {
    const flow = load(id);
    const observed = await installObservers(page);
    const phone = await openFlow(page, flow, 0);
    const composer = page.getByRole("textbox", { name: "Message", exact: true });
    await expect(composer).toHaveValue("");
    await expect(page.locator(`[data-message-id="${flow.messages[0].id}"]`)).toHaveCount(0);
    for (const message of flow.messages) {
      if (message.direction === "incoming") {
        // Contact typing belongs in the incoming indicator, never in the blue-side composer.
        expect(flow.events.filter(event => event.type === "draft").some(event => event.value === message.text)).toBe(false);
        await seek(page, message.atMs);
        await expect(composer).toHaveValue("");
        continue;
      }
      if (message.kind && message.kind !== "text") continue;
      const partial = beforeSend(flow, message);
      await seek(page, partial.atMs);
      await expect(composer).toHaveValue(partial.value!);
      await expect(page.locator(`[data-message-id="${message.id}"]`)).toHaveCount(0);
      if (id === "sunday-coffee-poll" && message.id === "m3") {
        await phone.screenshot({ path: info.outputPath("outgoing-composer-partial.png") });
      }
      await seek(page, message.atMs - 1);
      await expect(composer).toHaveValue(message.text);
      await expect(page.locator(`[data-message-id="${message.id}"]`)).toHaveCount(0);
      await seek(page, message.atMs);
      await expect(composer).toHaveValue("");
      await expect(page.locator(`[data-message-id="${message.id}"]`).first()).toHaveAttribute("data-direction", "outgoing");
    }
    expect(observed.pageErrors).toEqual([]);
    expect(observed.external).toEqual([]);
  });
}

test("real Play types, Pause holds the draft, send clears it, and Replay starts the same typing again", async ({ page }, info) => {
  const flow = load("sunday-coffee-poll");
  const observed = await installObservers(page);
  const phone = await openFlow(page, flow, 0);
  const first = flow.messages[0];
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(() => composer.inputValue()).not.toBe("");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const held = await composer.inputValue();
  expect(first.text.startsWith(held)).toBe(true);
  expect(held.length).toBeLessThan(first.text.length);
  await page.waitForTimeout(200);
  await expect(composer).toHaveValue(held);
  await expect(page.locator(`[data-message-id="${first.id}"]`)).toHaveCount(0);
  await phone.screenshot({ path: info.outputPath("outgoing-composer-playing.png") });
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => composer.inputValue(), { intervals: [20] }).toBe(first.text);
  await expect(page.locator(`[data-message-id="${first.id}"]`)).toBeVisible();
  await expect(composer).toHaveValue("");
  await page.getByRole("button", { name: "Pause", exact: true }).click();

  // A backwards seek restores the authored prefix instead of retaining the sent/empty input.
  const partial = beforeSend(flow, first);
  await seek(page, partial.atMs);
  await expect(composer).toHaveValue(partial.value!);
  await seek(page, 0);
  await expect(composer).toHaveValue("");
  await expect(page.locator(`[data-message-id="${first.id}"]`)).toHaveCount(0);

  const duration = await page.evaluate(() => window.IMESSAGE_DEMO!.state().durationMs);
  await seek(page, duration);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(composer).toHaveValue("");
  await expect(page.locator(`[data-message-id="${first.id}"]`)).toHaveCount(0);
  await expect.poll(() => composer.inputValue()).not.toBe("");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  expect(first.text.startsWith(await composer.inputValue())).toBe(true);
  expect(observed.pageErrors).toEqual([]);
});
