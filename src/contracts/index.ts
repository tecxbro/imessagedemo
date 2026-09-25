import type { ReactNode, Ref } from "react";
import { z } from "zod";

/**
 * Canonical authoring and timeline contract.
 * Upstream prop types stay in src/components/imessage. Agents author a
 * DemoFlow. The compiler emits one CompiledEvent stream. The runtime
 * projects that stream. Renderers do not invent a second timeline.
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

export const reactionSchema = z.object({
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  byMe: z.boolean().optional(),
  emoji: z.string().optional(),
  messageId: z.string().min(1).optional(),
  targetId: z.string().min(1).optional(),
});

export const replySnapshotSchema = z.object({
  id: z.string().min(1),
  text: z.string().optional(),
  direction: directionSchema.optional(),
  service: serviceSchema.optional(),
  sender: z.string().optional(),
});

export const linkPayloadSchema = z.object({
  url: z.string().min(1),
  title: z.string().optional(),
  host: z.string().optional(),
  image: z.string().min(1).optional(),
});

export const attachmentPayloadSchema = z.object({
  name: z.string().min(1),
  size: z.string().optional(),
  href: z.string().min(1).optional(),
});

export const demoMessageSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  direction: directionSchema,
  atMs: z.number().int(),
  kind: messageKindSchema.optional(),
  service: serviceSchema.optional(),
  status: statusSchema.optional(),
  effect: bubbleEffectSchema.optional(),
  link: linkPayloadSchema.optional(),
  attachments: z.array(attachmentPayloadSchema).optional(),
  images: z.array(z.object({ src: z.string().min(1), alt: z.string(), width: z.number().optional(), height: z.number().optional() })).optional(),
  audio: z.object({ duration: z.number().nonnegative(), peaks: z.array(z.number()).optional() }).optional(),
  reactions: z.array(reactionSchema).optional(),
  replyTo: z.union([z.string().min(1), replySnapshotSchema]).optional(),
  edited: z.boolean().optional(),
  readAt: z.number().int().nonnegative().optional(),
  revealed: z.boolean().optional(),
  removed: z.boolean().optional(),
});

export const overlayStateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("closed") }),
  z.object({ kind: z.literal("thread"), rootId: z.string().min(1) }),
  z.object({ kind: z.literal("long-press"), messageId: z.string().min(1) }),
  z.object({ kind: z.literal("context-menu"), messageId: z.string().min(1), x: z.number(), y: z.number() }),
  z.object({ kind: z.literal("plus-menu") }),
  z.object({
    kind: z.literal("effects-picker"),
    tab: z.enum(["bubble", "screen"]),
    draft: z.string(),
    effect: z.string().min(1).optional(),
  }),
  z.object({ kind: z.literal("image-viewer"), messageId: z.string().min(1), index: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("details") }),
  z.object({ kind: z.literal("photo-picker"), selectedId: z.string().min(1).optional() }),
  z.object({ kind: z.literal("selection"), messageIds: z.array(z.string().min(1)) }),
]);

export const systemNoticeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("unknown-sender") }),
  z.object({ kind: z.literal("not-delivered"), messageId: z.string().min(1) }),
  z.object({ kind: z.literal("missed-call"), call: z.enum(["audio", "video"]) }),
]);

export const compiledEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    conversationId: z.string().min(1).optional(),
    message: demoMessageSchema,
  }),
  z.object({
    type: z.literal("typing"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    conversationId: z.string().min(1).optional(),
    typing: z.boolean(),
  }),
  z.object({
    type: z.literal("draft"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    conversationId: z.string().min(1).optional(),
    value: z.string(),
  }),
  z.object({
    type: z.literal("status"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
    status: statusSchema,
  }),
  z.object({
    type: z.literal("reaction"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
    reactionId: z.string().min(1),
    reaction: z.union([
      z.object({ type: z.string().min(1), byMe: z.boolean().optional(), emoji: z.string().optional() }),
      z.null(),
    ]),
  }),
  z.object({
    type: z.literal("edit"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
    text: z.string(),
  }),
  z.object({
    type: z.literal("remove"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
  }),
  z.object({
    type: z.literal("reveal"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
    revealed: z.boolean(),
  }),
  z.object({
    type: z.literal("screen"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    screen: iosScreenSchema,
  }),
  z.object({
    type: z.literal("select-conversation"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    conversationId: z.string().min(1),
    contact: z.object({ name: z.string().min(1), initials: z.string().optional() }).optional(),
  }),
  z.object({
    type: z.literal("scroll"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    conversationId: z.string().min(1).optional(),
    offset: z.number(),
  }),
  z.object({
    type: z.literal("window-active"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    active: z.boolean(),
  }),
  z.object({
    type: z.literal("overlay"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    overlay: overlayStateSchema,
  }),
  z.object({
    type: z.literal("screen-effect"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    effect: screenEffectSchema,
    messageId: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal("audio-control"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    messageId: z.string().min(1),
    position: z.number().nonnegative(),
    playing: z.boolean(),
    seeking: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("time-reveal"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    progress: z.number().min(0).max(1),
  }),
  z.object({
    type: z.literal("notice"),
    atMs: z.number().int(),
    sourceIndex: z.number().int().optional(),
    notice: systemNoticeSchema,
  }),
]);

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
  events: z.array(compiledEventSchema).optional(),
});

export type Reaction = {
  id: string;
  type: string;
  byMe?: boolean;
  emoji?: string;
};

export type ReplySnapshot = {
  id: string;
  text: string;
  direction: Direction;
  service?: Service;
  sender?: string;
};

export type DemoMessage = {
  id: string;
  text: string;
  direction: Direction;
  atMs: number;
  kind?: MessageKind;
  service?: Service;
  status?: MessageStatus;
  effect?: BubbleEffectName;
  link?: { url: string; title?: string; host?: string; image?: string };
  attachments?: Array<{ name: string; size?: string; href?: string }>;
  images?: Array<{ src: string; alt: string; width?: number; height?: number }>;
  audio?: { duration: number; peaks?: number[] };
  reactions?: Reaction[];
  replyTo?: ReplySnapshot;
  edited?: boolean;
  readAt?: number;
  revealed?: boolean;
  removed?: boolean;
};

export type OverlayState =
  | { kind: "closed" }
  | { kind: "thread"; rootId: string }
  | { kind: "long-press"; messageId: string }
  | { kind: "context-menu"; messageId: string; x: number; y: number }
  | { kind: "plus-menu" }
  | { kind: "effects-picker"; tab: "bubble" | "screen"; draft: string; effect?: string }
  | { kind: "image-viewer"; messageId: string; index: number }
  | { kind: "details" }
  | { kind: "photo-picker"; selectedId?: string }
  | { kind: "selection"; messageIds: string[] };

export type SystemNotice =
  | { kind: "unknown-sender" }
  | { kind: "not-delivered"; messageId: string }
  | { kind: "missed-call"; call: "audio" | "video" };

export type AudioControlState = {
  messageId: string;
  position: number;
  playing: boolean;
  seeking?: boolean;
};

export type CompiledEvent =
  | { type: "message"; atMs: number; sourceIndex?: number; conversationId?: string; message: DemoMessage }
  | { type: "typing"; atMs: number; sourceIndex?: number; conversationId?: string; typing: boolean }
  | { type: "draft"; atMs: number; sourceIndex?: number; conversationId?: string; value: string }
  | { type: "status"; atMs: number; sourceIndex?: number; messageId: string; status: MessageStatus }
  | { type: "reaction"; atMs: number; sourceIndex?: number; messageId: string; reactionId: string; reaction: { type: string; byMe?: boolean; emoji?: string } | null }
  | { type: "edit"; atMs: number; sourceIndex?: number; messageId: string; text: string }
  | { type: "remove"; atMs: number; sourceIndex?: number; messageId: string }
  | { type: "reveal"; atMs: number; sourceIndex?: number; messageId: string; revealed: boolean }
  | { type: "screen"; atMs: number; sourceIndex?: number; screen: IosScreenName }
  | { type: "select-conversation"; atMs: number; sourceIndex?: number; conversationId: string; contact?: { name: string; initials?: string } }
  | { type: "scroll"; atMs: number; sourceIndex?: number; conversationId?: string; offset: number }
  | { type: "window-active"; atMs: number; sourceIndex?: number; active: boolean }
  | { type: "overlay"; atMs: number; sourceIndex?: number; overlay: OverlayState }
  | { type: "screen-effect"; atMs: number; sourceIndex?: number; effect: ScreenEffectName; messageId?: string }
  | { type: "audio-control"; atMs: number; sourceIndex?: number; messageId: string; position: number; playing: boolean; seeking?: boolean }
  | { type: "time-reveal"; atMs: number; sourceIndex?: number; progress: number }
  | { type: "notice"; atMs: number; sourceIndex?: number; notice: SystemNotice };

export type InitialConversation = {
  id: string;
  contact?: { name: string; initials?: string };
  messages?: readonly DemoMessage[];
  draft?: string;
  typing?: boolean;
  scroll?: number;
};

export type InitialState = {
  conversations?: readonly InitialConversation[];
  selectedConversationId?: string;
  screen?: IosScreenName;
  windowActive?: boolean;
  overlay?: OverlayState;
};

export type DemoFlow = {
  id: string;
  title: string;
  platform: DemoPlatform;
  theme: DemoTheme;
  contact: { name: string; initials?: string };
  nowMs: number;
  draft: string;
  typing: boolean;
  screen: IosScreenName;
  messages: DemoMessage[];
  events?: CompiledEvent[];
};

export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { ok: true; demo: DemoFlow } | { ok: false; issues: ValidationIssue[] };

export type CompiledDemo = {
  id: string;
  platform: DemoPlatform;
  theme: DemoTheme;
  durationMs: number;
  contact: DemoFlow["contact"];
  nowMs: number;
  screen: IosScreenName;
  events: CompiledEvent[];
  initialState?: InitialState;
  reducedMotion?: boolean;
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
