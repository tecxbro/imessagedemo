import type { CompiledDemo, DemoPlatform, DemoTheme, RenderFrame } from "@/contracts";

export type NamedCheckpoint = {
  id: string;
  atMs: number;
};

export type InspectState = {
  messageId: string | null;
};

export type RendererReceipt = {
  timeMs: number;
  platform: DemoPlatform;
  theme: DemoTheme;
  width: number;
  height: number;
};

export type ReadyReceipt = {
  revision: number;
  timeMs: number;
  platform: DemoPlatform;
  theme: DemoTheme;
  digest: string;
  renderer: RendererReceipt;
};

export type SeekResult = {
  revision: number;
  timeMs: number;
};

export type DemoRunMode = "preview" | "capture" | "catalogue";

export type DemoRunManifest = {
  runId: string;
  mode: DemoRunMode;
  approvedScenarioId: string;
  compiled: CompiledDemo | null;
  checkpoints: NamedCheckpoint[];
  clean: boolean;
  theme: DemoTheme;
  platform: DemoPlatform;
};

export type IMessageDemoApi = {
  seek(timeMs: number): Promise<SeekResult>;
  reset(): Promise<SeekResult>;
  ready(revision?: number): Promise<ReadyReceipt>;
  play(): Promise<void>;
  pause(): Promise<void>;
  state(): { timeMs: number; playing: boolean; durationMs: number };
  frame(): RenderFrame;
};

declare global {
  interface Window {
    IMESSAGE_DEMO?: IMessageDemoApi;
    __demoPlayer?: IMessageDemoApi;
  }
}
