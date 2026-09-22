import { expect, test, type Page } from "@playwright/test";

/** macTransitions.conversation.duration from the pin. */
const conversationDuration = 140;

const nowMs = Date.parse("2026-09-21T16:41:00.000Z");

function compiled(theme: "light" | "dark" = "light") {
  return {
    id: "mac-fixture",
    platform: "macos" as const,
    theme,
    durationMs: 2000,
    contact: { name: "Jordan Lee", initials: "JL" },
    nowMs,
    screen: "conversation" as const,
    events: [],
  };
}

function frame(theme: "light" | "dark" = "light", draft = "On my way over.") {
  return {
    timeMs: 1000,
    platform: "macos" as const,
    theme,
    screen: "conversation" as const,
    contact: { name: "Jordan Lee", initials: "JL" },
    nowMs,
    typing: false,
    draft,
    messages: [
      { id: "in-1", text: "Are you close?", direction: "incoming" as const, atMs: Date.parse("2026-09-21T16:39:00.000Z"), status: "read" as const },
      { id: "out-1", text: "See you there.", direction: "outgoing" as const, atMs: Date.parse("2026-09-21T16:40:00.000Z"), status: "delivered" as const },
    ],
  };
}

const alexMessages = [
  { id: "a-in", text: "Lunch?", direction: "incoming" as const, atMs: Date.parse("2026-09-21T16:30:00.000Z"), status: "read" as const },
  { id: "a-out", text: "Noon works.", direction: "outgoing" as const, atMs: Date.parse("2026-09-21T16:31:00.000Z"), status: "delivered" as const },
];

function switchScene(progress: number) {
  return {
    conversations: [
      { id: "alex", contact: { name: "Alex Morgan", initials: "AM" }, messages: alexMessages, draft: "" },
      { id: "jordan", contact: { name: "Jordan Lee", initials: "JL" } },
    ],
    selectedId: "jordan",
    switchFromId: "alex",
    conversationProgress: progress,
  };
}

async function mount(page: Page, payload: unknown) {
  await page.goto("/?foundation=macos&theme=light");
  await page.evaluate(async (next) => {
    const specifier = "/src/renderers/macos/harness.ts";
    const harness = await import(/* @vite-ignore */ specifier) as { mountMacHarness: (payload: unknown) => void };
    harness.mountMacHarness(next);
  }, payload);
  await page.locator('[data-slot="mac-demo-frame"]').waitFor();
}

async function update(page: Page, payload: unknown) {
  await page.evaluate(async (next) => {
    const win = window as Window & { __macUpdate?: (value: unknown) => void };
    win.__macUpdate?.(next);
  }, payload);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)))));
}

async function ready(page: Page) {
  return page.evaluate(async () => {
    const win = window as Window & { __mac?: { revision: number; whenReady: (revision: number) => Promise<Record<string, unknown>> } };
    const handle = win.__mac;
    if (!handle) throw new Error("missing handle");
    return handle.whenReady(handle.revision);
  });
}

async function switchSnapshot(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-slot='mac-demo-frame']");
    if (!root) return null;
    const live = [...root.querySelectorAll("[data-slot='header-contact']")].find((node) => !node.closest("[data-slot='header-outgoing']"));
    const outgoing = root.querySelector("[data-slot='header-outgoing'] [data-slot='name']");
    const selected = root.querySelector("[data-slot='sidebar-row'][data-selected='true'] [data-slot='row-name']");
    const content = root.querySelector("[data-slot='pane-content']");
    const contentTime = content?.getAnimations().find((animation) => animation.playState === "paused")?.currentTime ?? null;
    const travel = root.querySelector("[data-slot='sidebar-selection-travel']");
    return {
      selected: selected?.textContent ?? null,
      header: live?.querySelector("[data-slot='name']")?.textContent ?? null,
      outgoing: outgoing?.textContent ?? null,
      contentTime: typeof contentTime === "number" ? Math.round(contentTime) : null,
      travelTop: travel ? Math.round(Number.parseFloat(getComputedStyle(travel).top)) : null,
      width: Math.round(root.getBoundingClientRect().width),
      height: Math.round(root.getBoundingClientRect().height),
    };
  });
}

test("full window renders both themes", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await mount(page, { compiled: compiled(theme), frame: frame(theme) });
    const receipt = await ready(page);
    expect(receipt.width).toBe(960);
    expect(receipt.height).toBe(640);
    const frameBox = await page.locator("[data-slot='mac-demo-frame']").boundingBox();
    expect(frameBox?.width).toBe(960);
    expect(frameBox?.height).toBe(640);
    await expect(page.locator("[data-slot='traffic-lights']")).toBeVisible();
    await expect(page.locator("[data-slot='mac-sidebar']")).toBeVisible();
    await expect(page.locator("[data-slot='mac-header']")).toBeVisible();
    await expect(page.locator("[data-slot='message-list']")).toBeVisible();
    await expect(page.locator("[data-slot='mac-composer']")).toBeVisible();
    await expect(page.locator("[data-slot='field'] textarea")).toHaveValue("On my way over.");
    await expect(page.locator("[data-slot='name']").first()).toHaveText("Jordan Lee");
    const pane = await page.locator("[data-slot='pane']").boundingBox();
    expect(pane?.width).toBe(630);
    const background = await page.locator("[data-slot='macos-messages-app']").evaluate((element) => getComputedStyle(element).getPropertyValue("--im-bg").trim());
    expect(background).toBe(theme === "dark" ? "#1e1e1e" : "#ffffff");
    await expect(page.locator("[data-slot='mac-demo-frame'].dark")).toHaveCount(theme === "dark" ? 1 : 0);
    await expect(page.locator("[data-developer-metadata]")).toHaveCount(1);
    const metadataInside = await page.locator("[data-slot='mac-demo-frame'] [data-developer-metadata]").count();
    expect(metadataInside).toBe(0);
  }
});

test("fresh, sequential, backward and repeated switch captures agree", async ({ page }) => {
  const payload = { compiled: compiled(), frame: frame(), scene: switchScene(0.5) };
  await mount(page, payload);
  await ready(page);
  const fresh = await switchSnapshot(page);

  await mount(page, {
    compiled: compiled(),
    frame: { ...frame(), contact: { name: "Alex Morgan", initials: "AM" }, draft: "", messages: alexMessages },
    scene: { conversations: switchScene(0).conversations, selectedId: "alex" },
  });
  await update(page, payload);
  await ready(page);
  const sequential = await switchSnapshot(page);

  await mount(page, { compiled: compiled(), frame: frame(), scene: switchScene(1) });
  await update(page, payload);
  await ready(page);
  const backward = await switchSnapshot(page);

  await update(page, { compiled: compiled(), frame: frame(), scene: switchScene(0.2) });
  await update(page, payload);
  await ready(page);
  const repeated = await switchSnapshot(page);

  expect(sequential).toEqual(fresh);
  expect(backward).toEqual(fresh);
  expect(repeated).toEqual(fresh);
  expect(fresh?.selected).toBe("Jordan Lee");
  expect(fresh?.header).toBe("Jordan Lee");
  expect(fresh?.outgoing).toBe("Alex Morgan");
  expect(fresh?.width).toBe(960);
  expect(fresh?.contentTime).toBe(Math.round(conversationDuration * 0.5));
});

test("context menu uses pane coordinates and the message, not the reply stub", async ({ page }) => {
  const replyFrame = {
    ...frame(),
    messages: [
      { id: "root", text: "Where are you?", direction: "incoming" as const, atMs: nowMs - 120_000, status: "read" as const },
      Object.assign(
        { id: "reply", text: "On my way", direction: "outgoing" as const, atMs: nowMs - 60_000, status: "delivered" as const },
        { replyTo: { id: "root", text: "Where are you?", direction: "incoming" } },
      ),
    ],
  };
  await mount(page, {
    compiled: compiled(),
    frame: replyFrame,
    scene: { contextMenu: { id: "reply", x: 48, y: 120 }, selectedMessageIds: ["reply"] },
  });
  await ready(page);
  await expect(page.locator("[data-slot='message-actions']")).toHaveCount(0);
  await expect(page.locator("[data-slot='lifted-bubble']")).toHaveCount(0);
  await expect(page.locator("[data-slot='reply-stub']")).toHaveCount(1);
  await expect(page.locator("[data-slot='context-menu']")).toBeVisible();
  await expect(page.locator("[data-slot='mac-demo-frame']")).toHaveAttribute("data-context-message-id", "reply");
  const delta = await page.evaluate(() => {
    const pane = document.querySelector("[data-slot='pane']")!.getBoundingClientRect();
    const menu = document.querySelector("[data-slot='context-menu']")!.getBoundingClientRect();
    return { x: menu.left - pane.left, y: menu.top - pane.top };
  });
  expect(delta.x).toBeCloseTo(48, 0);
  expect(delta.y).toBeCloseTo(120, 0);
});

test("send flight midpoint keeps helpers and the endpoint removes them", async ({ page }) => {
  const sendFrame = {
    ...frame(),
    draft: "",
    messages: [
      ...frame().messages,
      { id: "sent", text: "Leaving now", direction: "outgoing" as const, atMs: nowMs, status: "sending" as const },
    ],
  };
  await mount(page, {
    compiled: compiled(),
    frame: sendFrame,
    scene: { arrival: { id: "sent", kind: "send", progress: 0.5 } },
  });
  await ready(page);
  const midpoint = await page.evaluate(() => ({
    ghosts: document.querySelectorAll("[data-slot='send-ghost']").length,
    clones: document.querySelectorAll("[data-slot='send-clone']").length,
    time: [...document.querySelectorAll("[data-slot='send-clone'], [data-slot='send-ghost']")].flatMap((node) => [...node.getAnimations(), ...(node.parentElement?.getAnimations() ?? [])]).map((animation) => animation.currentTime),
  }));
  expect(midpoint.ghosts + midpoint.clones).toBeGreaterThan(0);

  await update(page, { compiled: compiled(), frame: sendFrame, scene: { arrival: { id: "sent", kind: "send", progress: 1 } } });
  const ended = await ready(page);
  expect(ended.clones).toBe(0);
  expect(ended.ghosts).toBe(0);
  await expect(page.locator("[data-message-id='sent']")).toContainText("Leaving now");

  await update(page, { compiled: compiled(), frame: sendFrame, scene: { arrival: { id: "sent", kind: "send", progress: 0.5 } } });
  await update(page, { compiled: compiled(), frame: sendFrame, scene: { arrival: null } });
  const reversed = await ready(page);
  expect(reversed.ghosts).toBe(0);
  expect(reversed.clones).toBe(0);
});

test("readiness rejects a stale revision and an iOS screen", async ({ page }) => {
  await mount(page, { compiled: compiled(), frame: frame() });
  const stale = await page.evaluate(async () => {
    const win = window as Window & { __mac?: { revision: number; whenReady: (revision: number) => Promise<unknown> }; __macUpdate?: (value: unknown) => void };
    const old = win.__mac!.revision;
    win.__macUpdate?.({
      compiled: { id: "mac-fixture", platform: "macos", theme: "light", durationMs: 1, contact: { name: "Jordan Lee" }, nowMs: 1, screen: "conversation", events: [] },
      frame: {
        timeMs: 2,
        platform: "macos",
        theme: "light",
        screen: "conversation",
        contact: { name: "Jordan Lee", initials: "JL" },
        nowMs: 1,
        typing: true,
        draft: "Changed",
        messages: [],
      },
    });
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    try {
      await win.__mac!.whenReady(old);
      return "resolved";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(stale).toMatch(/stale revision/);

  await update(page, { compiled: compiled(), frame: { ...frame(), screen: "list" } });
  const ios = await page.evaluate(async () => {
    const win = window as Window & { __mac?: { revision: number; whenReady: (revision: number) => Promise<unknown> } };
    try {
      await win.__mac!.whenReady(win.__mac!.revision);
      return "resolved";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });
  expect(ios).toMatch(/iOS screen/);
  await expect(page.locator("[data-slot='mac-sidebar']")).toHaveCount(0);
});

test("group labels, typing, thread overlay and inspect reset", async ({ page }) => {
  const groupFrame = {
    ...frame(),
    typing: true,
    messages: [
      Object.assign(
        { id: "in-1", text: "Are you close?", direction: "incoming" as const, atMs: nowMs - 60_000, status: "read" as const },
        { sender: "Alex Morgan", senderInitials: "AM", replyCount: 1 },
      ),
      Object.assign(
        { id: "reply", text: "Almost", direction: "outgoing" as const, atMs: nowMs, status: "delivered" as const },
        { replyTo: { id: "in-1", text: "Are you close?", direction: "incoming", sender: "Alex Morgan" } },
      ),
    ],
  };
  await mount(page, {
    compiled: compiled(),
    frame: groupFrame,
    scene: {
      group: true,
      thread: { rootId: "in-1", progress: 1 },
      inspect: { confidence: "unverified", note: "switch timing is unverified" },
    },
  });
  await ready(page);
  await expect(page.locator("[data-slot='sender']")).toHaveText("Alex Morgan");
  await expect(page.locator("[data-slot='typing-indicator']")).toBeVisible();
  await expect(page.locator("[data-slot='reply-thread']")).toBeVisible();
  await expect(page.locator("[data-thread-root='in-1']")).toBeVisible();
  await expect(page.locator("[data-inspect-note]")).toHaveText("switch timing is unverified");
  const outside = await page.locator("[data-slot='mac-demo-frame'] [data-inspect-note]").count();
  expect(outside).toBe(0);
  await page.evaluate(() => {
    const win = window as Window & { __mac?: { reset: () => void } };
    win.__mac?.reset();
  });
  await page.locator("[data-inspect-note]").waitFor({ state: "detached" });
});

test("plus menu and bubble effect use source progress", async ({ page }) => {
  await mount(page, {
    compiled: compiled(),
    frame: {
      ...frame(),
      messages: [
        { id: "out-1", text: "Wow", direction: "outgoing" as const, atMs: nowMs, status: "delivered" as const, effect: "slam" as const },
      ],
    },
    scene: { plusMenu: true, menuProgress: 0.5, bubbleEffect: { id: "out-1", kind: "slam", progress: 0.5 } },
  });
  await ready(page);
  await expect(page.locator("[data-slot='plus-menu']")).toBeVisible();
  const effect = await page.evaluate(() => {
    const row = document.querySelector("[data-message-id='out-1'] [data-slot='bubble-frame']");
    const animations = row?.getAnimations() ?? [];
    return animations.map((animation) => (typeof animation.currentTime === "number" ? Math.round(animation.currentTime) : null));
  });
  expect(effect.some((time) => time !== null && time > 0)).toBe(true);
});

test("catalogue renders pinned Mac scenes and rejects iOS-only ones", async ({ page }) => {
  await page.goto("/?foundation=macos&theme=light");
  const report = await page.evaluate(async () => {
    const specifier = "/src/renderers/macos/harness.ts";
    const scenesSpecifier = "/src/contracts/catalogue-scenes.json";
    const harness = await import(/* @vite-ignore */ specifier) as { mountMacCatalogue: (scene: { id: string; title: string; platform: string; tier: string; sourceAnchors: string[]; summary: string }, theme?: "light" | "dark") => void };
    const catalogueModule = await import(/* @vite-ignore */ scenesSpecifier) as { scenes?: Array<{ id: string; title: string; platform: string; tier: string; sourceAnchors: string[]; summary: string }>; default?: { scenes: Array<{ id: string; title: string; platform: string; tier: string; sourceAnchors: string[]; summary: string }> } };
    const catalogue = catalogueModule.scenes ? catalogueModule : catalogueModule.default;
    if (!catalogue?.scenes) throw new Error("catalogue scenes missing");
    const results: Array<{ id: string; error: string | null; facetime: boolean; system: boolean; messageKind: boolean }> = [];
    for (const scene of catalogue.scenes) {
      harness.mountMacCatalogue(scene, "light");
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined))));
      results.push({
        id: scene.id,
        error: document.querySelector("[data-catalogue-error]")?.getAttribute("data-catalogue-error") ?? null,
        facetime: Boolean(document.querySelector("[data-slot='facetime-card']")),
        system: Boolean(document.querySelector("[data-slot='system-message']")),
        messageKind: Boolean(document.querySelector("[data-kind='system'], [data-kind='facetime']")),
      });
    }
    return results;
  });
  const byId = Object.fromEntries(report.map((item) => [item.id, item]));
  expect(byId["effects-picker"]?.error).toMatch(/iOS-only/);
  expect(byId["ios-text"]?.error).toMatch(/iOS-only/);
  expect(byId["macos-text"]?.error).toBeNull();
  expect(byId["facetime"]?.facetime).toBe(true);
  expect(byId["facetime"]?.messageKind).toBe(false);
  expect(byId["system"]?.system).toBe(true);
  expect(byId["system"]?.messageKind).toBe(false);
  expect(byId["screen-effect"]?.error).toBeNull();
});
