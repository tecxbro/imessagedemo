import type { RendererHandle, RendererProps } from "@/contracts";
import type { BubbleEffectName, DemoMessage, ScreenEffectName } from "@/contracts";

/**
 * Fields the frozen DemoMessage does not declare. They are read when a fixture
 * carries them and ignored otherwise. Adding them to the schema is a contract request.
 */
export type MacMessageExtras = {
  sender?: string;
  senderInitials?: string;
  edited?: boolean;
  readAtMs?: number;
  reactions?: Array<{ type: string; byMe?: boolean; emoji?: string }>;
  replyTo?: { id: string; text: string; direction: "incoming" | "outgoing"; service?: "imessage" | "sms"; sender?: string };
  replyCount?: number;
  link?: DemoMessage["link"] & { image?: string };
  attachments?: Array<{ name: string; size?: string; href?: string }>;
};

export type MacConversationInput = {
  id: string;
  contact: { name: string; initials?: string; photo?: string };
  messages?: DemoMessage[];
  draft?: string;
  typing?: boolean;
  group?: boolean;
  pinned?: boolean;
  muted?: boolean;
  /** Drawn only when a fixture sets it. The adapter never invents an unread dot. */
  unread?: boolean | number;
  preview?: string;
  time?: string;
};

export type MacArrival = {
  id: string;
  kind: "send" | "receive";
  /** 0..1 seeks the source animation. Omit to play. 1 is the settled end. */
  progress?: number;
};

export type MacTimeline = {
  conversation?: { fromId: string; toId: string; startMs: number; durationMs: number };
  arrival?: { id: string; kind: "send" | "receive"; startMs: number; durationMs: number };
};

/**
 * Optional capture directives. RendererProps stays the frozen pair; these fields
 * are how a fixture asks for a sidebar, a seeked switch, or a menu without a contract edit.
 */
export type MacSceneInput = {
  conversations?: MacConversationInput[];
  selectedId?: string;
  active?: boolean;
  group?: boolean;
  /** Departing conversation. Required to seek a switch; a mount of the destination alone will not cross-fade. */
  switchFromId?: string;
  /** 0..1 of macTransitions.conversation. Omit to play the switch. */
  conversationProgress?: number;
  /** Pane coordinates, the same space MacMessagesApp stores on contextMenu. */
  contextMenu?: { id: string; x: number; y: number } | null;
  plusMenu?: boolean;
  menuProgress?: number;
  selectedMessageIds?: readonly string[];
  arrival?: MacArrival | null;
  bubbleEffect?: { id: string; kind: BubbleEffectName; progress?: number } | null;
  screenEffect?: { kind: ScreenEffectName; progress?: number; anchorMessageId?: string } | null;
  /** Drawn with ReplyThread through overlay. Never forwarded as a MacMessagesApp prop. */
  thread?: { rootId: string; open?: boolean; progress?: number } | null;
  /** Sync-status footer. Omitted unless a fixture sets it. */
  footer?: string;
  inspect?: { confidence: string; note: string } | null;
  timeline?: MacTimeline;
};

export type MacDemoRendererProps = RendererProps & {
  scene?: MacSceneInput;
};

export type ReadinessReceipt = {
  revision: number;
  ready: true;
  width: number;
  height: number;
  fontsReady: true;
  assetsDecoded: true;
  scrollSettled: true;
  fillsReady: true;
  animationsSettled: true;
  clones: number;
  ghosts: number;
};

export type MacRendererHandle = RendererHandle & {
  readonly revision: number;
  whenReady(revision: number): Promise<ReadinessReceipt>;
  reset(): void;
};
