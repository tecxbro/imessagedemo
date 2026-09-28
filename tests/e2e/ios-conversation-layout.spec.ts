import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { installObservers, openFlow, type Scenario } from "./harness";

const flow = {
  id: "ios-conversation-layout", title: "Conversation layout", platform: "ios", theme: "light",
  contact: { name: "Memo", initials: "M" }, nowMs: 6000, draft: "", typing: false, screen: "conversation",
  messages: [
    { id: "opening", text: "Can you help with coffee this morning?", direction: "outgoing", atMs: 0 },
    { id: "ordinary", text: "One shot. I'll get the machine going.", direction: "incoming", atMs: 1000 },
    { id: "reply", text: "One shot. I'll get the machine going.", direction: "outgoing", atMs: 2000, replyTo: "ordinary" },
    { id: "long", text: "A longer message should wrap within the normal conversation column without shrinking down again at every measurement.", direction: "incoming", atMs: 3000 },
    { id: "photo", text: "Coffee", direction: "incoming", atMs: 4000, kind: "image", images: [{ src: "/demo-assets/sunday/memo-espresso.webp", alt: "Coffee", width: 1920, height: 1080 }] },
  ],
} as Scenario;

test("iOS text fits the shared column and chrome frosts content behind it", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-ios-light-e2e", "shared iOS layout runs once");
  const observed = await installObservers(page);
  const phone = await openFlow(page, flow, 5000);
  for (const id of ["ordinary", "reply", "long"]) {
    const bubble = page.locator(`[data-message-id="${id}"] [data-slot="bubble"]`).last();
    const box = await bubble.boundingBox();
    expect(box!.width).toBeGreaterThan(220);
    expect(box!.width).toBeLessThanOrEqual(281);
    if (id !== "long") expect(box!.height).toBeLessThan(65);
  }
  await expect(page.locator('[data-message-id="reply"] [data-slot="reply-stub"]')).toContainText("One shot.");
  const glass = page.locator('[data-slot="conversation-header-glass"]');
  await expect(glass).toHaveCount(1);
  const layers = glass.locator('[data-slot="header-blur-layer"]');
  await expect(layers).toHaveCount(6);
  const material = await layers.evaluateAll(elements => elements.map(element => ({
    blur: getComputedStyle(element).backdropFilter, mask: getComputedStyle(element).maskImage,
  })));
  expect(material.map(layer => layer.blur)).toEqual(["blur(0.5px)", "blur(1px)", "blur(2px)", "blur(4px)", "blur(8px)", "blur(16px)"]);
  expect(material.every(layer => layer.mask.includes("to top"))).toBe(true);
  expect(material[0].mask).toContain("12%");
  expect(material[5].mask).toContain("98%");
  expect(await page.locator('[data-slot="ios-nav-bar"]').evaluate((element) => getComputedStyle(element).filter)).toBe("none");
  await phone.screenshot({ path: info.outputPath("conversation-layout.png") });
  expect(observed.pageErrors).toEqual([]);
});


test("actual coffee confirmation width", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-ios-light-e2e");
  const { targets, checkpoints, ...actual } = JSON.parse(readFileSync("scenarios/sunday-coffee-poll.json", "utf8"));
  const phone = await openFlow(page, actual, 25000);
  for (const id of ["m2", "m3", "m4"]) {
    const bubble = page.locator(`[data-message-id="${id}"] [data-slot="bubble"]`).last();
    expect((await bubble.boundingBox())!.width).toBeGreaterThan(220);
  }
  await phone.screenshot({path:info.outputPath("coffee-width.png")});
});

test("incoming text has the same line breaks after Play and direct seek", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium-ios-light-e2e");
  const phone = await openFlow(page, flow, 0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByRole("button", { name: "Replay", exact: true })).toBeVisible();
  const bubble = page.locator('[data-message-id="ordinary"] [data-slot="bubble"]').last();
  const played = await bubble.boundingBox();

  await phone.screenshot({ path: info.outputPath("played-layout.png") });
  await page.reload();
  await openFlow(page, flow, 5000);
  const direct = await bubble.boundingBox();

  expect(played!.width).toBeCloseTo(direct!.width, 0);
  expect(played!.height).toBe(direct!.height);
});
