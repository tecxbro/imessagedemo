import type { ReadinessReceipt } from "@/renderers/macos/types";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

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

  const images = [...root.querySelectorAll("img")];
  try {
    await Promise.all(images.map((img) => (img.complete && img.naturalWidth > 0 ? Promise.resolve() : img.decode())));
  } catch (error) {
    throw new Error(`asset decode failed: ${error instanceof Error ? error.message : String(error)}`);
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
