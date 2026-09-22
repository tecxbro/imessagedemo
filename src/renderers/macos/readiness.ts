import type { ReadinessReceipt } from "@/renderers/macos/types";

const nextFrame = () => new Promise<void>((resolve) => {
  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    resolve();
  };
  requestAnimationFrame(() => finish());
  setTimeout(finish, 50);
});

export async function waitForMacReady(
  root: HTMLElement,
  requested: number,
  current: () => number,
  options: { arrivalInFlight: boolean; switchInFlight: boolean; rejection: { code: string; message: string } | null },
): Promise<ReadinessReceipt> {
  const failIfStale = () => {
    const live = current();
    if (requested !== live) {
      throw new Error(`stale revision ${requested}; current is ${live}`);
    }
  };

  failIfStale();
  if (options.rejection) throw new Error(options.rejection.message);
  if (document.fonts?.ready) await document.fonts.ready;
  failIfStale();

  const decodeDeadline = performance.now() + 2500;
  while (performance.now() < decodeDeadline) {
    failIfStale();
    const pending = [...root.querySelectorAll("img")].filter((img) => img.isConnected && (!img.complete || img.naturalWidth === 0));
    if (pending.length === 0) break;
    await Promise.race([
      Promise.all(pending.map((img) => img.decode().catch(() => undefined))),
      new Promise((resolve) => setTimeout(resolve, 50)),
    ]);
    await nextFrame();
  }
  const stuck = [...root.querySelectorAll("img")].filter((img) => img.isConnected && (!img.complete || img.naturalWidth === 0));
  if (stuck.length > 0) {
    const src = stuck[0]?.currentSrc || stuck[0]?.getAttribute("src") || "image";
    throw new Error(`asset decode failed: ${src}`);
  }
  failIfStale();

  await nextFrame();
  await nextFrame();
  failIfStale();

  const list = root.querySelector<HTMLElement>('[data-slot="message-list"]');
  if (list) {
    const gap = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (gap > 1) {
      list.scrollTo({ top: list.scrollHeight, behavior: "auto" });
      await nextFrame();
      await nextFrame();
    }
    const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (remaining > 1) throw new Error("message log scroll is not final");
  }
  failIfStale();

  const bubbles = [...root.querySelectorAll<HTMLElement>('[data-slot="message-bubble"], [data-slot="typing-indicator"]')];
  for (let attempt = 0; attempt < 8 && bubbles.some((bubble) => bubble.isConnected && !bubble.style.getPropertyValue("--bubble-bottom")); attempt += 1) {
    await nextFrame();
    failIfStale();
  }
  const unfilled = bubbles.filter((bubble) => bubble.isConnected && !bubble.style.getPropertyValue("--bubble-bottom"));
  if (unfilled.length) throw new Error("screen-space fills are not final");

  if (!options.arrivalInFlight) {
    const helpers = root.querySelectorAll('[data-slot="send-clone"], [data-slot="send-ghost"]').length;
    if (helpers > 0) throw new Error("stale arrival helpers remain");
  }
  if (!options.switchInFlight) {
    const travel = root.querySelector('[data-slot="sidebar-selection-travel"]');
    const outgoing = root.querySelector('[data-slot="pane-outgoing"]');
    if (travel || outgoing) throw new Error("stale conversation-switch overlay remains");
  }
  failIfStale();

  const box = root.getBoundingClientRect();
  const helpers = root.querySelectorAll('[data-slot="send-clone"], [data-slot="send-ghost"]').length;
  return {
    revision: requested,
    ready: true,
    width: box.width,
    height: box.height,
    fontsReady: true,
    assetsDecoded: true,
    scrollSettled: true,
    fillsReady: true,
    animationsSettled: true,
    clones: root.querySelectorAll('[data-slot="send-clone"]').length,
    ghosts: helpers,
  };
}
