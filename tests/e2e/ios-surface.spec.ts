import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator } from "@playwright/test";
import { installObservers, openFlow, projectAxes, seek } from "./harness";
import type { Scenario } from "./harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Same durations the compiler acceptance test seeks through. */
const cue = {
  threadEnter: 260,
  threadExit: 200,
  imageViewer: 300,
  longPressEnter: 600,
  longPressExit: 220,
  effectsPickerEnter: 260,
  confetti: 4200,
  undo: 420,
  plusMenuEnter: 160,
  photoPickerEnter: 260,
  selectionEnter: 220,
  pop: 320,
  present: 400,
  push: 350,
} as const;

function load(theme: "light" | "dark"): Scenario {
  return JSON.parse(readFileSync(path.join(root, `scenarios/ios-surface-ios-${theme}.json`), "utf8")) as Scenario;
}

async function expectAnchorClickable(locator: Locator, href: string) {
  await expect(locator).toBeVisible();
  await expect(locator).toHaveAttribute("href", href);
  const swallowed = await locator.evaluate((element) => {
    const anchor = element as HTMLAnchorElement;
    let prevented = false;
    const stop = (event: MouseEvent) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
      event.stopPropagation();
    };
    anchor.addEventListener("click", stop, true);
    anchor.click();
    anchor.removeEventListener("click", stop, true);
    return prevented;
  });
  expect(swallowed).toBe(false);
}

test("the authored iOS surface renders in light and dark", async ({ page }, testInfo) => {
  const axes = projectAxes(testInfo);
  test.skip(!axes || axes.platform !== "ios", "iOS projects only");
  if (!axes) return;
  const scenario = load(axes.theme);
  const observers = await installObservers(page);
  const shell = await openFlow(page, scenario, scenario.messages[0]?.atMs ?? 0);
  const messageId = (name: string) => `${scenario.id}-${name}`;
  const row = (name: string) => page.locator(`[data-message-id="${messageId(name)}"]`);

  await expect(row("m1").getByText("Are you close?")).toBeVisible();

  await seek(page, 1790008862000);
  await expect(row("m2")).toBeVisible();
  await expect(row("m2").getByText(/^Read /)).toBeVisible();

  await seek(page, 1790008864500);
  await expect(row("m2").locator('[data-slot="tapback"][data-reaction="love"]')).toBeVisible();

  await seek(page, 1790008867000);
  await expect(row("m3").locator('[data-slot="reply-stub"]')).toBeVisible();
  await expect(row("m2").locator('[data-slot="reply-count"]')).toBeVisible();

  await seek(page, 1790008869000 + cue.threadEnter / 2);
  await expect(page.locator('[data-slot="reply-thread"]')).toBeVisible();
  await seek(page, 1790008869000 + cue.threadEnter);
  await expect(page.locator('[data-slot="reply-thread"]')).toBeVisible();
  await seek(page, 1790008870500 + cue.threadExit);
  await expect(page.locator('[data-slot="reply-thread"]')).toHaveCount(0);

  await seek(page, 1790008873000);
  await expect(row("m4").locator('[data-slot="link-preview"]')).toBeVisible();
  await expectAnchorClickable(row("m4").locator('[data-slot="link-preview"]'), "https://example.com/notes");

  await seek(page, 1790008875000);
  await expectAnchorClickable(row("m5").locator('[data-slot="message-attachment"] a'), "/demo-assets/park-64x48.png");

  await seek(page, 1790008877000);
  await expect(row("m7").locator("img")).toHaveCount(2);

  await seek(page, 1790008879000 + cue.imageViewer / 2);
  await expect(page.locator('[data-slot="image-viewer"]')).toBeVisible();
  await seek(page, 1790008879000 + cue.imageViewer);
  await expect(page.locator('[data-slot="image-viewer"]')).toBeVisible();
  await seek(page, 1790008881000 + cue.imageViewer);
  await expect(page.locator('[data-slot="image-viewer"]')).toHaveCount(0);

  await seek(page, 1790008885000);
  await expect(row("m8").locator('[data-slot="message-audio"]')).toBeVisible();
  const audioButton = row("m8").getByRole("button", { name: "Pause audio message" });
  await expect(audioButton).toBeVisible();
  await expect(page.locator("[data-demo-frame]").getByRole("button", { name: "Pause audio message" })).toBeVisible();
  await expect(page.locator("[data-demo-frame] [data-playback-control], [data-demo-frame] input[type='range']")).toHaveCount(0);
  await audioButton.click();
  await expect(row("m8").getByRole("button", { name: "Pause audio message" })).toBeVisible();
  await expect(row("m8").locator('[data-slot="waveform"]')).toBeVisible();

  await seek(page, 1790008887000 + cue.longPressEnter / 2);
  await expect(page.locator('[data-slot="message-actions"]')).toBeVisible();
  await seek(page, 1790008889500 + cue.longPressExit);
  await expect(page.locator('[data-slot="message-actions"]')).toHaveCount(0);

  await seek(page, 1790008891000 + cue.effectsPickerEnter / 2);
  await expect(page.locator('[data-slot="ios-effects-picker"]')).toBeVisible();
  await expect(page.locator('[data-slot="ios-effects-picker"] [data-tab="screen"]')).toHaveAttribute("aria-selected", "true");
  await seek(page, 1790008891000 + cue.effectsPickerEnter);
  await expect(page.locator('[data-slot="ios-effects-picker"]')).toContainText("See you there");

  await seek(page, 1790008894000 + cue.confetti / 2);
  await expect(page.locator('[data-slot="screen-effect"][data-effect="confetti"]')).toBeVisible();
  await seek(page, 1790008894000 + cue.confetti);
  await expect(row("m9").getByText("See you there")).toBeVisible();
  await expect(page.locator('[data-slot="screen-effect"]')).toHaveCount(0);

  await seek(page, 1790008898500);
  await expect(row("m2").getByText("On my way over")).toBeVisible();
  await expect(row("m2").locator('[data-slot="edited"]')).toBeVisible();

  await seek(page, 1790008900500 + cue.undo / 2);
  await expect(page.locator(`[data-slot="message-row"][data-message-id="${messageId("m2")}"]`)).toHaveCount(0);
  await expect(page.locator('[data-slot="undo-send"]')).toBeVisible();
  await seek(page, 1790008900500 + cue.undo);
  await expect(page.locator(`[data-slot="message-row"][data-message-id="${messageId("m2")}"]`)).toHaveCount(0);
  await expect(page.locator('[data-slot="undo-send"]')).toHaveCount(0);

  await seek(page, 1790008902500 + cue.plusMenuEnter);
  await expect(page.locator('[data-slot="ios-plus-menu"]')).toBeVisible();

  await seek(page, 1790008904500 + cue.photoPickerEnter);
  await expect(page.locator('[data-slot="photo-picker"]')).toBeVisible();
  await expect(page.locator('[data-slot="photo-picker-tile"][data-index="0"]')).toHaveAttribute("data-selected", "true");

  await seek(page, 1790008906500 + cue.selectionEnter);
  const selected = page.locator(`[data-slot="message-selection-row"][data-selected] [data-message-id="${messageId("m1")}"]`);
  await expect(selected).toBeVisible();
  await expect(selected.locator('[data-slot="bubble"]')).toBeVisible();
  await expect(selected.getByText("Are you close?")).toBeVisible();
  await expect(page.locator('[data-slot="ios-select-mode"]')).toBeVisible();
  await expect(page.locator('[data-slot="ios-selection-toolbar"]')).toBeVisible();
  await expect(page.locator('[data-slot="selection-message-id"]')).toHaveCount(0);

  await seek(page, 1790008909000);
  await expect(page.locator('[data-slot="swipe-times"]').first()).toBeVisible();
  await seek(page, 1790008910500);
  await expect(page.locator('[data-slot="swipe-times"]').first()).toHaveAttribute("data-progress", "1.000");

  await seek(page, 1790008912000 + cue.pop / 2);
  await expect(shell).toHaveAttribute("data-screen", "list");
  await expect(shell).toHaveAttribute("data-transition", "pop");
  await seek(page, 1790008912000 + cue.pop);
  await expect(shell).toHaveAttribute("data-screen", "list");
  await expect(page.locator('[data-slot="ios-conversation-list"]')).toBeVisible();

  await seek(page, 1790008914000 + cue.present / 2);
  await expect(shell).toHaveAttribute("data-screen", "new-message");
  await expect(shell).toHaveAttribute("data-transition", "present");
  await seek(page, 1790008914000 + cue.present);
  await expect(page.locator('[data-slot="ios-new-message-sheet"]')).toBeVisible();

  await seek(page, 1790008916000 + cue.push / 2);
  await expect(shell).toHaveAttribute("data-screen", "conversation");
  await expect(shell).toHaveAttribute("data-transition", "push");
  await seek(page, 1790008916000 + cue.push);
  await expect(shell).toHaveAttribute("data-screen", "conversation");
  await expect(row("m1").getByText("Are you close?")).toBeVisible();

  await expect(shell).toBeVisible();
  expect(observers.pageErrors).toEqual([]);
  expect(observers.consoleErrors).toEqual([]);
});
