import type { CompiledDemo, Player, RenderFrame, RendererHandle } from "@/contracts";
import { buildReadyReceipt, canonicalFrame, frameDigest } from "@/player/receipt";
import type { InspectState, IMessageDemoApi, NamedCheckpoint, ReadyReceipt, SeekResult } from "@/player/types";

export type RuntimeSession = IMessageDemoApi & {
  inspect(): InspectState;
  selectMessage(messageId: string | null): void;
  setView(platform: CompiledDemo["platform"], theme: CompiledDemo["theme"]): void;
  view(): { platform: CompiledDemo["platform"]; theme: CompiledDemo["theme"] };
  snapshot(): { frame: RenderFrame; digest: string };
};

export function createRuntimeSession(args: {
  compiled: CompiledDemo;
  player: Player;
  checkpoints?: NamedCheckpoint[];
  getRenderer: () => RendererHandle | null;
  getFrameElement: () => HTMLElement | null;
  now?: () => number;
}): RuntimeSession {
  let revision = 0;
  let inspect: InspectState = { messageId: null };
  let platform = args.compiled.platform;
  let theme = args.compiled.theme;
  const logicalFrames = new Map<number, RenderFrame>();
  logicalFrames.set(0, structuredClone({ ...args.player.frame(), platform, theme }));

  function currentFrame(): RenderFrame {
    const frame = args.player.frame();
    return { ...frame, platform, theme };
  }

  function bump(timeMs: number): SeekResult {
    revision += 1;
    const frame = currentFrame();
    logicalFrames.set(revision, structuredClone(frame));
    args.getRenderer()?.seek(timeMs);
    return { revision, timeMs };
  }

  async function waitForRevision(target: number): Promise<void> {
    const started = (args.now ?? Date.now)();
    while (revision < target) {
      if ((args.now ?? Date.now)() - started > 15_000) {
        throw new Error(`Timed out waiting for revision ${target}`);
      }
      await nextTick();
    }
  }

  async function waitForRenderer(): Promise<HTMLElement> {
    const started = (args.now ?? Date.now)();
    while (true) {
      const element = args.getRenderer()?.element ?? args.getFrameElement();
      if (element) {
        await waitForAssets(element);
        return element;
      }
      if ((args.now ?? Date.now)() - started > 15_000) {
        throw new Error("Timed out waiting for renderer element");
      }
      await nextTick();
    }
  }

  const api: RuntimeSession = {
    async seek(timeMs: number) {
      args.player.seek(timeMs);
      return bump(timeMs);
    },
    async reset() {
      inspect = { messageId: null };
      args.player.pause();
      args.player.seek(0);
      return bump(0);
    },
    async ready(requested?: number) {
      const target = requested ?? revision;
      await waitForRevision(target);
      const element = await waitForRenderer();
      const authored = logicalFrames.get(target);
      if (!authored) throw new Error(`No authored frame for revision ${target}`);
      const live = currentFrame();
      const frame = target === revision ? live : authored;
      if (target === revision && (await frameDigest(live)) !== (await frameDigest(authored))) {
        throw new Error("Renderer warm-up changed authored logical state");
      }
      const box = element.getBoundingClientRect();
      return buildReadyReceipt({
        revision: target,
        frame,
        renderer: {
          timeMs: frame.timeMs,
          platform: frame.platform,
          theme: frame.theme,
          width: Math.round(box.width),
          height: Math.round(box.height),
        },
      });
    },
    async play() {
      args.player.play();
    },
    async pause() {
      args.player.pause();
    },
    state() {
      return args.player.state();
    },
    frame: currentFrame,
    inspect() {
      return inspect;
    },
    selectMessage(messageId) {
      inspect = { messageId };
    },
    setView(nextPlatform, nextTheme) {
      platform = nextPlatform;
      theme = nextTheme;
    },
    view() {
      return { platform, theme };
    },
    snapshot() {
      const frame = currentFrame();
      return { frame, digest: canonicalFrame(frame) };
    },
  };

  void args.checkpoints;
  return api;
}

export function checkpointAt(checkpoints: NamedCheckpoint[], id: string): NamedCheckpoint {
  const found = checkpoints.find((item) => item.id === id);
  if (!found) throw new Error(`Unknown checkpoint: ${id}`);
  return found;
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

async function waitForAssets(element: HTMLElement): Promise<void> {
  const fonts = (element.ownerDocument as Document | undefined)?.fonts;
  if (fonts?.ready) await fonts.ready;
  const images = [...element.querySelectorAll("img")];
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => reject(new Error(`Image failed: ${image.src}`)), { once: true });
      });
    }),
  );
}

export function assertReceiptRevision(receipt: ReadyReceipt, revision: number): void {
  if (receipt.revision !== revision) {
    throw new Error(`Ready receipt revision ${receipt.revision} does not match seek revision ${revision}`);
  }
}
