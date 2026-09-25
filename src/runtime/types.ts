import type {
  AudioControlState,
  BubbleEffectName,
  CompiledDemo,
  CompiledEvent,
  DemoFlow,
  DemoMessage,
  DemoPlatform,
  DemoTheme,
  Direction,
  IosScreenName,
  OverlayState,
  Reaction,
  ReplySnapshot,
  ScreenEffectName,
  SystemNotice,
} from "@/contracts";

/**
 * Projection types. Authoring and timeline events live in @/contracts.
 * SceneEvent is that canonical stream. This module only adds the folded scene.
 */
export type {
  AudioControlState,
  InitialConversation,
  InitialState,
  OverlayState,
  Reaction,
  ReplySnapshot,
  SystemNotice,
} from "@/contracts";

export type SceneMessage = DemoMessage;
export type SceneEvent = CompiledEvent;

export type LogicalMessage = DemoMessage & {
  edited: boolean;
  reactions: Reaction[];
  replyCount: number;
  replyTo?: ReplySnapshot;
  revealed?: boolean;
};

export type ConversationState = {
  id: string;
  contact: DemoFlow["contact"];
  messages: LogicalMessage[];
  draft: string;
  typing: boolean;
  scroll: number;
};

export type RuntimeDemo = CompiledDemo;

export type DemoSource = CompiledDemo;

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
  audio: AudioControlState | null;
  timeReveal: number;
  notices: SystemNotice[];
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
