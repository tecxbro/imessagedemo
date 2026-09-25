import type {
  Cue,
  LogicalMessage,
  LogicalState,
  OverlayState,
  SystemNotice,
  VisualFrame,
} from "@/runtime/types";

/** Runtime state the interaction helpers accept. VisualFrame adds cue progress for overlays. */
export type InteractionInput = LogicalState | VisualFrame;

export type OverlayPhase = "closed" | "enter" | "exit" | "settled";

export type ActiveOverlay = {
  overlay: OverlayState;
  phase: OverlayPhase;
  /** Cue progress for overlay-enter / overlay-exit, or 1 when settled open, 0 when closed. */
  progress: number;
};

export type LongPressPose = {
  open: boolean;
  messageId: string;
  progress: number;
};

export type ThreadPose = {
  open: boolean;
  rootId: string;
  progress: number;
};

export type PlusMenuPose = {
  open: boolean;
  progress: number;
};

export type DetailsPose = {
  open: boolean;
  progress: number;
};

export type PhotoPickerPose = {
  open: boolean;
  progress: number;
  selectedId?: string;
};

export type SelectionPose = {
  open: boolean;
  progress: number;
  messageIds: string[];
};

export type ReplyJumpPose = {
  messageId: string;
  progress: number;
};

export type EditPose = {
  editedIds: string[];
  /** Messages present just before a remove (from beforeState) but gone now. */
  removedIds: string[];
  /** Deterministic Undo Send pose when a remove just dropped a message. */
  undoSend: { messageId: string; progress: number } | null;
};

export type InteractionPose = {
  overlay: OverlayState;
  phase: OverlayPhase;
  progress: number;
  longPress: LongPressPose | null;
  thread: ThreadPose | null;
  plusMenu: PlusMenuPose | null;
  details: DetailsPose | null;
  photoPicker: PhotoPickerPose | null;
  selection: SelectionPose | null;
  timeReveal: number;
  notices: SystemNotice[];
  replyJump: ReplyJumpPose | null;
  edit: EditPose;
};

function isVisualFrame(state: InteractionInput): state is VisualFrame {
  return Array.isArray((state as VisualFrame).cues);
}

function cuesOf(state: InteractionInput): Cue[] {
  return isVisualFrame(state) ? state.cues : [];
}

function beforeOf(state: InteractionInput): LogicalState | null {
  return isVisualFrame(state) ? state.beforeState : null;
}

function findOverlayCue(cues: Cue[], kind: "overlay-enter" | "overlay-exit"): Cue | undefined {
  for (let index = cues.length - 1; index >= 0; index -= 1) {
    const cue = cues[index];
    if (cue?.kind === kind && cue.detail?.overlay) return cue;
  }
  return undefined;
}

/**
 * Resolve the overlay the capture path should draw, including mid-exit frames where
 * `state.overlay` is already `closed` but `beforeState` + an overlay-exit cue still name the surface.
 */
export function activeOverlay(state: InteractionInput): ActiveOverlay {
  const cues = cuesOf(state);
  const enter = findOverlayCue(cues, "overlay-enter");
  const exit = findOverlayCue(cues, "overlay-exit");

  if (state.overlay.kind !== "closed") {
    if (enter) {
      return { overlay: state.overlay, phase: "enter", progress: enter.progress };
    }
    return { overlay: state.overlay, phase: "settled", progress: 1 };
  }

  const exiting = exit?.detail?.overlay ?? beforeOf(state)?.overlay;
  if (exit && exiting && exiting.kind !== "closed") {
    return { overlay: exiting, phase: "exit", progress: exit.progress };
  }

  return { overlay: { kind: "closed" }, phase: "closed", progress: 0 };
}

export function describeLongPress(state: InteractionInput): LongPressPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "long-press") return null;
  return {
    open: active.phase !== "exit",
    messageId: active.overlay.messageId,
    progress: active.progress,
  };
}

export function describeThread(state: InteractionInput): ThreadPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "thread") return null;
  return {
    open: active.phase !== "exit",
    rootId: active.overlay.rootId,
    progress: active.progress,
  };
}

export function describePlusMenu(state: InteractionInput): PlusMenuPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "plus-menu") return null;
  return { open: active.phase !== "exit", progress: active.progress };
}

export function describeDetails(state: InteractionInput): DetailsPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "details") return null;
  return { open: active.phase !== "exit", progress: active.progress };
}

export function describePhotoPicker(state: InteractionInput): PhotoPickerPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "photo-picker") return null;
  return {
    open: active.phase !== "exit",
    progress: active.progress,
    ...(active.overlay.selectedId !== undefined ? { selectedId: active.overlay.selectedId } : {}),
  };
}

export function describeSelection(state: InteractionInput): SelectionPose | null {
  const active = activeOverlay(state);
  if (active.overlay.kind !== "selection") return null;
  return {
    open: active.phase !== "exit",
    progress: active.progress,
    messageIds: [...active.overlay.messageIds],
  };
}

/** Deterministic swipe-to-reveal progress from canonical `timeReveal` (0 hidden, 1 revealed). */
export function describeTimeReveal(state: InteractionInput): number {
  return Math.max(0, Math.min(1, state.timeReveal));
}

/**
 * Non-group system notices from canonical state.
 * Group-chat events (participant added/removed, group photo, conversation named) are out of scope.
 */
export function describeNotices(state: InteractionInput): SystemNotice[] {
  return state.notices.filter((notice) => {
    return notice.kind === "unknown-sender" || notice.kind === "not-delivered" || notice.kind === "missed-call";
  });
}

/**
 * Quoted-reply jump / flash target while a thread is opening or open.
 * Progress follows the overlay cue so a seek lands on the same flash pose.
 */
export function describeReplyJump(state: InteractionInput): ReplyJumpPose | null {
  const thread = describeThread(state);
  if (!thread || !thread.open) return null;
  return { messageId: thread.rootId, progress: thread.progress };
}

function messageIds(messages: readonly LogicalMessage[]): Set<string> {
  return new Set(messages.map((message) => message.id));
}

export function describeEdit(state: InteractionInput): EditPose {
  const editedIds = state.messages.filter((message) => message.edited).map((message) => message.id);
  const before = beforeOf(state);
  const removedIds: string[] = [];
  if (before) {
    const live = messageIds(state.messages);
    for (const message of before.messages) {
      if (!live.has(message.id)) removedIds.push(message.id);
    }
  }
  const undoSend =
    removedIds.length > 0
      ? { messageId: removedIds[removedIds.length - 1]!, progress: 1 }
      : null;
  return { editedIds, removedIds, undoSend };
}

export function describeInteraction(state: InteractionInput): InteractionPose {
  const active = activeOverlay(state);
  return {
    overlay: active.overlay,
    phase: active.phase,
    progress: active.progress,
    longPress: describeLongPress(state),
    thread: describeThread(state),
    plusMenu: describePlusMenu(state),
    details: describeDetails(state),
    photoPicker: describePhotoPicker(state),
    selection: describeSelection(state),
    timeReveal: describeTimeReveal(state),
    notices: describeNotices(state),
    replyJump: describeReplyJump(state),
    edit: describeEdit(state),
  };
}

/**
 * Props `IosMessagesApp` already understands for long-press and thread.
 * Exit frames clear the prop so the pin can run its dismiss path; enter/settled pass cue progress.
 */
export function iosInteractionShell(state: InteractionInput): {
  longPress: { id: string; progress?: number } | null;
  thread: { rootId: string; progress?: number } | null;
  flash: { id: string; progress?: number } | null;
} {
  const longPress = describeLongPress(state);
  const thread = describeThread(state);
  const replyJump = describeReplyJump(state);
  return {
    longPress: longPress && longPress.open ? { id: longPress.messageId, progress: longPress.progress } : null,
    thread: thread && thread.open ? { rootId: thread.rootId, progress: thread.progress } : null,
    flash: replyJump ? { id: replyJump.messageId, progress: replyJump.progress } : null,
  };
}
