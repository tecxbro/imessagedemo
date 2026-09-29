import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const local = JSON.parse(readFileSync(new URL("../../examples/miniapp-local.flow.json", import.meta.url), "utf8"));
import { playbackBarHeightPx } from "../../src/player/playback";

async function open(page: Page, flow = local) {
  await page.addInitScript(value => { if (window === window.top) sessionStorage.setItem("imessage-demo-inline", JSON.stringify(value)); }, flow);
  await page.setViewportSize({width:402,height:874+playbackBarHeightPx});
  await page.goto(`/?flow=${flow.id}&t=3000`);
  await expect(page.getByRole("button",{name:"Open Focus Sessions"})).toBeVisible();
}

test.beforeEach(({}, info) => { test.skip(!["chromium-ios-light-e2e","webkit-ios-light-e2e"].includes(info.project.name)); });

test("card opens an interactive app; close preserves it, reload and replay reset it", async ({page}, info) => {
  const errors: string[]=[];
  page.on("pageerror", error => errors.push(error.message));
  let requests = 0;
  page.on("request", request => { if(request.url().endsWith("/demo-apps/counter.html")) requests++; });
  await open(page);
  expect(requests).toBe(0);
  await page.locator('[data-demo-frame]').screenshot({path:info.outputPath("miniapp-card.png")});
  await page.getByRole("button",{name:"Open Focus Sessions"}).click();
  const app = page.frameLocator('[data-slot="mini-app-frame"]');
  await expect(page.getByRole("status")).toBeHidden();
  await expect.poll(() => page.locator("[data-slot=mini-app-sheet]").evaluate(el => getComputedStyle(el).transform)).toBe("none");
  await app.getByRole("button",{name:"Complete a session"}).click();
  await app.getByRole("textbox",{name:"Today's focus"}).fill("Ship the mini app");
  await expect(app.locator("#count")).toHaveText("1");
  await page.locator('[data-demo-frame]').screenshot({path:info.outputPath("miniapp-open.png")});
  await page.getByRole("button",{name:"Close mini app"}).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button",{name:"Open Focus Sessions"})).toBeFocused();
  await page.getByRole("button",{name:"Open Focus Sessions"}).click();
  await expect(app.locator("#count")).toHaveText("1");
  await expect(app.getByRole("textbox")).toHaveValue("Ship the mini app");
  expect(requests).toBe(1);
  await page.getByRole("button",{name:"Reload mini app"}).click();
  await expect(app.locator("#count")).toHaveText("0");
  await page.getByRole("button",{name:"Done",exact:true}).click();
  await page.evaluate(() => window.IMESSAGE_DEMO!.reset());
  await expect(page.locator('[data-slot="mini-app-frame"]')).toHaveCount(0);
  await page.getByRole("button",{name:"Play",exact:true}).click();
  await page.getByRole("button",{name:"Open Focus Sessions"}).click();
  await expect(app.locator("#count")).toHaveText("0");
  await expect(page.locator('[data-slot="mini-app-frame"]')).toHaveAttribute("sandbox","allow-scripts");
  expect(errors).toEqual([]);
});

test("unconfigured remote origins never load", async ({page}) => {
  let remote = 0;
  page.on("request", request => { if(request.url().includes("untrusted.example")) remote++; });
  const flow = structuredClone(local);
  flow.messages[1].appCard!.url="https://untrusted.example/game";
  await open(page,flow);
  await page.getByRole("button",{name:"Open Focus Sessions"}).click();
  await expect(page.getByRole("alert")).toContainText("VITE_PHOTON_MINIAPP_ORIGINS");
  expect(remote).toBe(0);
  await expect(page.locator('[data-slot="mini-app-frame"]')).toHaveCount(0);
  await page.getByRole("button",{name:"Close mini app"}).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("optional live Jump Jump integration", async ({page}, info) => {
  test.skip(!process.env.TEST_PHOTON_REMOTE || info.project.name !== "chromium-ios-light-e2e", "explicit live reference check only");
  const flow = JSON.parse(readFileSync(new URL("../../examples/photon-miniapp.flow.json", import.meta.url), "utf8"));
  await page.addInitScript(value => { if(window === window.top) sessionStorage.setItem("imessage-demo-inline",JSON.stringify(value)); }, flow);
  await page.setViewportSize({width:402,height:874+playbackBarHeightPx});
  await page.goto(`/?flow=${flow.id}&t=3000`);
  await page.getByRole("button",{name:"Open Jump Jump"}).click();
  const game = page.frameLocator('[data-slot="mini-app-frame"]');
  await game.getByRole("button",{name:/Start Game/}).click({timeout:45000});
  await expect(game.getByRole("button",{name:/Start Game/})).toBeHidden();
  await page.locator('[data-demo-frame]').screenshot({path:info.outputPath("jump-jump-playing.png")});
  await page.getByRole("button",{name:"Close mini app"}).click();
  await page.getByRole("button",{name:"Open Jump Jump"}).click();
  await expect(game.getByRole("button",{name:/Start Game/})).toBeHidden();
});
