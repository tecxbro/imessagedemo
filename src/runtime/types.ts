import type {
  BubbleEffectName,
  CompiledDemo,
  CompiledEvent,
  DemoFlow,
  DemoMessage,
  DemoPlatform,
  DemoTheme,
  Direction,
  IosScreenName,
  MessageStatus,
  ScreenEffectName,
  Service,
} from "@/contracts";

/**
 * Scene model the frozen CompiledEvent union cannot name yet.
 * Message, typing, and draft stay assignable from CompiledEvent.
 */
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

export type SceneMessage = DemoMessage & {
  edited?: boolean;
  reactions?: readonly Reaction[];
  replyTo?: ReplySnapshot;
  revealed?: boolean;
};

export type LogicalMessage = DemoMessage & {
  edited: boolean;
  reactions: Reaction[];
  replyCount: number;
  replyTo?: ReplySnapshot;
  revealed?: boolean;
};

export type OverlayState =
  | { kind: "closed" }
  | { kind: "thread"; rootId: string }
  | { kind: "long-press"; messageId: string }
  | { kind: "context-menu"; messageId: string; x: number; y: number }
  | { kind: "plus-menu" }
  | { kind: "effects-picker"; tab: "bubble" | "screen"; draft: string }
  | { kind: "image-viewer"; messageId: string; index: number };

export type ConversationState = {
  id: string;
  contact: DemoFlow["contact"];
  messages: LogicalMessage[];
  draft: string;
  typing: boolean;
  scroll: number;
};

export type InitialConversation = {
  id: string;
  contact?: DemoFlow["contact"];
  messages?: readonly SceneMessage[];
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

export type SceneEvent =
  | (Extract<CompiledEvent, { type: "message" }> & {
      sourceIndex?: number;
      conversationId?: string;
      message: SceneMessage;
    })
  | (Extract<CompiledEvent, { type: "typing" }> & { sourceIndex?: number; conversationId?: string })
  | (Extract<CompiledEvent, { type: "draft" }> & { sourceIndex?: number; conversationId?: string })
  | { type: "status"; atMs: number; sourceIndex?: number; messageId: string; status: MessageStatus }
  | {
      type: "reaction";
      atMs: number;
      sourceIndex?: number;
      messageId: string;
      reactionId: string;
      reaction: { type: string; byMe?: boolean; emoji?: string } | null;
    }
  | { type: "edit"; atMs: number; sourceIndex?: number; messageId: string; text: string }
  | { type: "remove"; atMs: number; sourceIndex?: number; messageId: string }
  | { type: "reveal"; atMs: number; sourceIndex?: number; messageId: string; revealed: boolean }
  | { type: "screen"; atMs: number; sourceIndex?: number; screen: IosScreenName }
  | {
      type: "select-conversation";
      atMs: number;
      sourceIndex?: number;
      conversationId: string;
      contact?: DemoFlow["contact"];
    }
  | { type: "scroll"; atMs: number; sourceIndex?: number; conversationId?: string; offset: number }
  | { type: "window-active"; atMs: number; sourceIndex?: number; active: boolean }
  | { type: "overlay"; atMs: number; sourceIndex?: number; overlay: OverlayState }
  | { type: "screen-effect"; atMs: number; sourceIndex?: number; effect: ScreenEffectName; messageId?: string };

export type RuntimeDemo = {
  id: string;
  platform: DemoPlatform;
  theme: DemoTheme;
  durationMs: number;
  contact: DemoFlow["contact"];
  nowMs: number;
  screen: IosScreenName;
  events: readonly SceneEvent[];
  initialState?: InitialState;
  reducedMotion?: boolean;
};

export type DemoSource = CompiledDemo | RuntimeDemo;

export type LogicalState = {
  timeMs: number;
  playing: boolean;
  durationMs: number;
  platform: DemoPlatform;
  theme: DemoTheme;
  nowMs: number;
  screen: IosScreenName;
  contact: DemoFlow["contact"];
  messages: LogicalMessage[];
  typing: boolean;
  draft: string;
  scroll: number;
  windowActive: boolean;
  selectedConversationId: string;
  conversations: ConversationState[];
  overlay: OverlayState;
};

export type ScreenTransitionKind = "push" | "pop" | "present" | "dismiss";

export type CueKind =
  | "send"
  | "receive"
  | "bubble-effect"
  | "screen-effect"
  | "reaction"
  | "screen"
  | "conversation"
  | "selection-text"
  | "overlay-enter"
  | "overlay-exit";

export type CueDetail = {
  direction?: Direction;
  effect?: BubbleEffectName | ScreenEffectName;
  reactionId?: string;
  reaction?: Reaction | null;
  previousReaction?: Reaction | null;
  fromScreen?: IosScreenName;
  toScreen?: IosScreenName;
  fromConversationId?: string;
  toConversationId?: string;
  overlay?: OverlayState;
};

export type Cue = {
  id: string;
  kind: CueKind;
  startedAtMs: number;
  elapsedMs: number;
  durationMs: number;
  progress: number;
  sourceIndex: number;
  subjectId?: string;
  transition?: ScreenTransitionKind;
  beforeState?: LogicalState;
  detail?: CueDetail;
};

export type VisualFrame = LogicalState & {
  cues: Cue[];
  beforeState: LogicalState | null;
};

export type LogicalClock = {
  now(): number;
  requestFrame(callback: (timestamp: number) => void): number;
  cancelFrame(handle: number): void;
};

export type CreatePlayerOptions = {
  clock?: LogicalClock;
};

export type PlayerSnapshot = {
  revision: number;
  playback: { timeMs: number; playing: boolean; durationMs: number };
  frame: VisualFrame;
};
