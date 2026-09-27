import { expect, it } from "vitest";
import { createRuntimeSession } from "@/player/controller";
import { createPlayerDouble } from "../contracts/doubles";
import { compiledFixture } from "../contracts/compiled.fixture";

it("does not report ready until React commits the seek and video finishes decoding that frame", async () => {
  let renderedTime = 0;
  let assetReads = 0;
  const media = { isConnected: true, error: null, readyState: 2, paused: true, seeking: false,
    currentTime: 0, duration: 10, dataset: { targetTime: "0" } };
  const element = {
    ownerDocument: { fonts: undefined },
    closest: () => ({ getAttribute: () => String(renderedTime) }),
    querySelectorAll: (selector: string) => {
      if (selector.startsWith("video")) { assetReads += 1; return [media]; }
      return [];
    },
    getBoundingClientRect: () => ({ width: 402, height: 874 }),
  } as unknown as HTMLElement;
  const session = createRuntimeSession({ compiled: compiledFixture, player: createPlayerDouble(compiledFixture),
    getRenderer: () => ({ seek() {}, element }), getFrameElement: () => element });
  const result = await session.seek(1000);
  let done = false;
  const ready = session.ready(result.revision).then(receipt => { done = true; return receipt; });
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(done).toBe(false);
  expect(assetReads).toBe(0);
  renderedTime = 1000;
  media.dataset.targetTime = "1";
  media.currentTime = 1;
  media.seeking = true;
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(done).toBe(false);
  media.seeking = false;
  expect((await ready).timeMs).toBe(1000);
  expect(assetReads).toBeGreaterThan(0);
});
