import { expect, test } from "@playwright/test";
import { installObservers, openFlow, seek, type Scenario } from "./harness";

const flow = {
  id: "video-playback", title: "Video playback", platform: "ios", theme: "light",
  contact: { name: "Sunday" }, nowMs: 10000, draft: "", typing: false, screen: "conversation",
  messages: [
    { id: "intro", text: "Here is the clip.", direction: "incoming", atMs: 1000 },
    { id: "clip", kind: "video", text: "Memo doing the dishes", direction: "incoming", atMs: 2000,
      video: { src: "/demo-assets/sunday/memo-dishes.mp4", poster: "/demo-assets/sunday/avatar.png", width: 1280, height: 720 } },
    { id: "end", text: "Looks good!", direction: "outgoing", atMs: 10000 },
  ],
} as Scenario;

test("video autoplays on arrival and follows conversation pause, seek and replay without browser controls or a text footer", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-ios-light-e2e", "Playable video runs once");
  const observed = await installObservers(page);
  await openFlow(page, flow, 0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  const video = page.locator('[data-slot="message-video"]');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.4);
  expect(await video.evaluate((node: HTMLVideoElement) => ({ muted: node.muted, inline: node.playsInline, paused: node.paused, controls: node.controls }))).toEqual({ muted: true, inline: true, paused: false, controls: false });
  await expect(page.getByText("Play video", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Pause video", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);
  const heldTime = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
  await page.waitForTimeout(200);
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeCloseTo(heldTime, 1);
  await seek(page, 3500);
  expect(await video.evaluate((node: HTMLVideoElement) => ({ paused: node.paused, seeking: node.seeking, time: node.currentTime }))).toEqual({ paused: true, seeking: false, time: 1.5 });
  await page.locator('[data-demo-frame]').screenshot({ path: testInfo.outputPath("video-authored-frame.png") });
  await seek(page, 2500);
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeCloseTo(0.5, 2);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeGreaterThan(0.8);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await seek(page, 11000);
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(video).toHaveCount(0);
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  expect(await video.evaluate((node: HTMLVideoElement) => node.currentTime)).toBeLessThan(1);
  expect(observed.pageErrors).toEqual([]);
});
