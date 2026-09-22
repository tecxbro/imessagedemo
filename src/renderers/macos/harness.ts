import { Component, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CatalogueSceneDefinition, CompiledDemo, DemoTheme, RenderFrame } from "@/contracts";
import { MacCatalogueScene, MacDemoRenderer, type MacRendererHandle, type MacSceneInput } from "@/renderers/macos/index";

export type MacHarnessPayload = {
  compiled: CompiledDemo;
  frame: RenderFrame;
  scene?: MacSceneInput;
};

type HarnessWindow = Window & {
  __mac?: MacRendererHandle | null;
  __macUpdate?: (payload: MacHarnessPayload) => void;
};

let root: Root | null = null;
let payload: MacHarnessPayload | null = null;

function render() {
  if (!payload) return;
  ensureHost();
  if (!root) return;
  root.render(createElement(MacDemoRenderer, {
    compiled: payload.compiled,
    frame: payload.frame,
    scene: payload.scene,
    ref: (handle: MacRendererHandle | null) => {
      (window as HarnessWindow).__mac = handle;
    },
  }));
}

class CatalogueBoundary extends Component<{ scene: CatalogueSceneDefinition; theme: DemoTheme }, { error: string | null }> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render(): ReactNode {
    if (this.state.error) return createElement("div", { "data-catalogue-error": this.state.error }, this.state.error);
    return createElement(MacCatalogueScene, { scene: this.props.scene, theme: this.props.theme });
  }
}

export function mountMacCatalogue(scene: CatalogueSceneDefinition, theme: DemoTheme = "light") {
  ensureHost();
  root?.render(createElement(CatalogueBoundary, { scene, theme, key: scene.id }));
}

function ensureHost() {
  const appRoot = document.getElementById("root") ?? document.body;
  let host = document.getElementById("mac-harness");
  if (!host) {
    appRoot.replaceChildren();
    host = document.createElement("div");
    host.id = "mac-harness";
    appRoot.appendChild(host);
    root = createRoot(host);
  }
  return host;
}

export function mountMacHarness(next: MacHarnessPayload) {
  payload = next;
  ensureHost();
  render();
  (window as HarnessWindow).__macUpdate = (update: MacHarnessPayload) => {
    payload = update;
    render();
  };
}
