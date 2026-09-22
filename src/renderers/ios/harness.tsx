import { useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CatalogueSceneDefinition, CompiledDemo, RenderFrame } from "@/contracts";
import { iosScreen } from "@/components/imessage/ios-messages-app";
import "@/styles.css";
import { IosCatalogueScene } from "./catalogue";
import { viewportRectToFrame } from "./geometry";
import { IosDemoRenderer, IosInspectSession, type IosRendererHandle, type IosSettleReceipt } from "./scene";

type View =
  | { kind: "frame"; compiled: CompiledDemo; frame: RenderFrame }
  | { kind: "catalogue"; scene: CatalogueSceneDefinition; theme: "light" | "dark" }
  | { kind: "inspect"; compiled: CompiledDemo; frame: RenderFrame }
  | { kind: "scaled" };

type IosHarness = {
  show(view: View): void;
  seek(timeMs: number): void;
  revision(): number;
  settle(revision: number): Promise<IosSettleReceipt>;
};

declare global {
  interface Window {
    __ios?: IosHarness;
  }
}

function ScaledProbe() {
  const hostRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  useLayoutEffect(() => {
    const host = hostRef.current;
    const tile = tileRef.current;
    if (!host || !tile) return;
    const converted = viewportRectToFrame(host.getBoundingClientRect(), tile.getBoundingClientRect(), iosScreen);
    setText(`${converted.x.toFixed(2)} ${converted.y.toFixed(2)} ${converted.width.toFixed(2)} ${converted.height.toFixed(2)}`);
  }, []);
  return (
    <div>
      <div data-slot="scaled-label">{text}</div>
      <div style={{ width: iosScreen.width, height: iosScreen.height, transform: "scale(2)", transformOrigin: "top left" }}>
        <div ref={hostRef} data-slot="scaled-host" style={{ width: iosScreen.width, height: iosScreen.height, position: "relative" }}>
          <div ref={tileRef} data-slot="scaled-tile" style={{ position: "absolute", left: 40, top: 80, width: 100, height: 60, background: "#0088ff" }} />
        </div>
      </div>
    </div>
  );
}

function Harness() {
  const ref = useRef<IosRendererHandle>(null);
  const [view, setView] = useState<View | null>(null);
  useLayoutEffect(() => {
    window.__ios = {
      show(next) {
        setView(next);
      },
      seek(timeMs) {
        ref.current?.seek(timeMs);
      },
      revision() {
        return ref.current?.revision ?? 0;
      },
      settle(revision) {
        if (!ref.current) return Promise.reject(new Error("missing node: renderer"));
        return ref.current.settle(revision);
      },
    };
  }, []);
  return (
    <main>
      {view?.kind === "frame" ? <IosDemoRenderer ref={ref} compiled={view.compiled} frame={view.frame} /> : null}
      {view?.kind === "catalogue" ? <IosCatalogueScene scene={view.scene} theme={view.theme} /> : null}
      {view?.kind === "inspect" ? <IosInspectSession compiled={view.compiled} frame={view.frame} /> : null}
      {view?.kind === "scaled" ? <ScaledProbe /> : null}
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing node: root");
createRoot(root).render(<Harness />);
