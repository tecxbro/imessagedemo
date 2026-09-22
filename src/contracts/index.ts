import type { ReactNode, Ref } from "react";
import { z } from "zod";

/**
 * Frozen application contract for the pinned workers.dev registry.
 * Upstream prop types stay in src/components/imessage. This module is the
 * demo-maker boundary the six lanes share. Production lanes throw
 * NOT_IMPLEMENTED until their worktrees replace the stubs.
 */

export function notImplemented(symbol: string): never {
  throw new Error(`NOT_IMPLEMENTED: ${symbol}`);
}

export const messageKindSchema = z.enum(["text", "link", "attachment", "image", "audio"]);
export const directionSchema = z.enum(["incoming", "outgoing"]);
export const serviceSchema = z.enum(["imessage", "sms"]);
export const statusSchema = z.enum(["sending", "sent", "delivered", "read", "failed"]);
export const platformSchema = z.enum(["ios", "macos"]);
export const themeSchema = z.enum(["light", "dark"]);
export const iosScreenSchema = z.enum(["list", "conversation", "new-message"]);
export const bubbleEffectSchema = z.enum(["slam", "loud", "gentle", "invisible-ink"]);
export const screenEffectSchema = z.enum(["echo", "spotlight", "balloons", "confetti", "love", "lasers", "fireworks", "celebration"]);

export type MessageKind = z.infer<typeof messageKindSchema>;
export type Direction = z.infer<typeof directionSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type MessageStatus = z.infer<typeof statusSchema>;
export type DemoPlatform = z.infer<typeof platformSchema>;
export type DemoTheme = z.infer<typeof themeSchema>;
export type IosScreenName = z.infer<typeof iosScreenSchema>;
export type BubbleEffectName = z.infer<typeof bubbleEffectSchema>;
export type ScreenEffectName = z.infer<typeof screenEffectSchema>;

export const demoMessageSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  direction: directionSchema,
  atMs: z.number().int(),
  kind: messageKindSchema.optional(),
  service: serviceSchema.optional(),
  status: statusSchema.optional(),
  effect: bubbleEffectSchema.optional(),
  link: z.object({ url: z.string().min(1), title: z.string().optional(), host: z.string().optional() }).optional(),
  attachments: z.array(z.object({ name: z.string().min(1), size: z.string().optional() })).optional(),
  images: z.array(z.object({ src: z.string().min(1), alt: z.string(), width: z.number().optional(), height: z.number().optional() })).optional(),
  audio: z.object({ duration: z.number().nonnegative(), peaks: z.array(z.number()).optional() }).optional(),
});

export const demoFlowSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  platform: platformSchema,
  theme: themeSchema,
  contact: z.object({ name: z.string().min(1), initials: z.string().optional() }),
  nowMs: z.number().int(),
  draft: z.string(),
  typing: z.boolean(),
  screen: iosScreenSchema,
  messages: z.array(demoMessageSchema),
});

export type DemoMessage = z.infer<typeof demoMessageSchema>;
export type DemoFlow = z.infer<typeof demoFlowSchema>;

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { ok: true; demo: DemoFlow } | { ok: false; issues: ValidationIssue[] };

export type CompiledEvent =
  | { type: "message"; atMs: number; message: DemoMessage }
  | { type: "typing"; atMs: number; typing: boolean }
  | { type: "draft"; atMs: number; value: string };

export type CompiledDemo = {
  id: string;
  platform: DemoPlatform;
  theme: DemoTheme;
  durationMs: number;
  contact: DemoFlow["contact"];
  nowMs: number;
  screen: IosScreenName;
  events: CompiledEvent[];
};

export type PlaybackState = {
  timeMs: number;
  playing: boolean;
  durationMs: number;
};

export type RenderFrame = {
  timeMs: number;
  platform: DemoPlatform;
  theme: DemoTheme;
  screen: IosScreenName;
  contact: DemoFlow["contact"];
  nowMs: number;
  messages: DemoMessage[];
  typing: boolean;
  draft: string;
};

export type RendererProps = {
  compiled: CompiledDemo;
  frame: RenderFrame;
};

export type RendererHandle = {
  seek(timeMs: number): void;
  readonly element: HTMLElement | null;
};

export type CatalogueTier = "supported" | "catalogue-only";

export type CatalogueSceneDefinition = {
  id: string;
  title: string;
  platform: DemoPlatform | "both";
  tier: CatalogueTier;
  sourceAnchors: string[];
  summary: string;
};

export type CatalogueSceneProps = {
  scene: CatalogueSceneDefinition;
  theme: DemoTheme;
  children?: ReactNode;
};

export type DemoPlayerProps = {
  compiled: CompiledDemo;
  ref?: Ref<RendererHandle>;
};

export type Player = {
  play(): void;
  pause(): void;
  seek(timeMs: number): void;
  state(): PlaybackState;
  frame(): RenderFrame;
};
