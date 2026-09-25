import type { AudioControlState, DemoFlow, SystemNotice } from "@/contracts";
import {
  bubbleEffectDuration,
  cueProgress,
  macTransitions,
  messageMotion,
  pendingCueDurations,
  screenEffectDuration,
  screenTransitionDuration,
  screenTransitionKind,
} from "@/runtime/tokens";
import type {
  ConversationState,
  Cue,
  CueDetail,
  DemoSource,
  InitialConversation,
  LogicalMessage,
  LogicalState,
  OverlayState,
  Reaction,
  RuntimeDemo,
  SceneEvent,
  SceneMessage,
  VisualFrame,
} from "@/runtime/types";

type Working = {
  screen: LogicalState["screen"];
  windowActive: boolean;
  selectedConversationId: string;
  conversations: ConversationState[];
  overlay: OverlayState;
  audio: AudioControlState | null;
  timeReveal: number;
  notices: SystemNotice[];
};

type Prepared = {
  event: SceneEvent;
  index: number;
  sourceIndex: number;
  atMs: number;
};

type CueSeed = {
  id: string;
  kind: Cue["kind"];
  startedAtMs: number;
  durationMs: number;
  sourceIndex: number;
  subjectId?: string;
  transition?: Cue["transition"];
  beforeState?: LogicalState;
  detail?: CueDetail;
};

function readEvents(compiled: DemoSource): readonly SceneEvent[] {
  return compiled.events as readonly SceneEvent[];
}

function initialOf(compiled: DemoSource): RuntimeDemo["initialState"] {
  return "initialState" in compiled ? compiled.initialState : undefined;
}

function reducedMotion(compiled: DemoSource): boolean {
  return "reducedMotion" in compiled && compiled.reducedMotion === true;
}

function queryTime(timeMs: number): number {
  return Number.isFinite(timeMs) ? timeMs : 0;
}

function prepare(events: readonly SceneEvent[]): Prepared[] {
  return events
    .map((event, index) => ({
      event,
      index,
      sourceIndex: typeof event.sourceIndex === "number" && Number.isFinite(event.sourceIndex) ? event.sourceIndex : index,
      atMs: event.atMs,
    }))
    .filter((item) => Number.isFinite(item.atMs))
    .sort((a, b) => a.atMs - b.atMs || a.sourceIndex - b.sourceIndex || a.index - b.index);
}

function copyReactions(message: SceneMessage): Reaction[] {
  return (message.reactions ?? []).map((reaction, index) => {
    const stored: Reaction = { id: reaction.id || `${message.id}:${index}`, type: reaction.type };
    if (reaction.byMe !== undefined) stored.byMe = reaction.byMe;
    if (reaction.emoji !== undefined) stored.emoji = reaction.emoji;
    return stored;
  });
}

function copyMessage(message: SceneMessage, existing: readonly LogicalMessage[]): LogicalMessage {
  const target = message.replyTo ? existing.find((item) => item.id === message.replyTo?.id) : undefined;
  const logical: LogicalMessage = {
    id: message.id,
    text: message.text,
    direction: message.direction,
    atMs: message.atMs,
    edited: message.edited ?? false,
    reactions: copyReactions(message),
    replyCount: 0,
  };
  if (message.kind !== undefined) logical.kind = message.kind;
  if (message.service !== undefined) logical.service = message.service;
  if (message.status !== undefined) logical.status = message.status;
  if (message.effect !== undefined) logical.effect = message.effect;
  if (message.link) logical.link = { ...message.link };
  if (message.attachments) logical.attachments = message.attachments.map((item) => ({ ...item }));
  if (message.images) logical.images = message.images.map((item) => ({ ...item }));
  if (message.audio) logical.audio = { ...message.audio, peaks: message.audio.peaks?.slice() };
  if (message.replyTo) {
    logical.replyTo = {
      id: message.replyTo.id,
      text: message.replyTo.text ?? target?.text ?? "",
      direction: message.replyTo.direction ?? target?.direction ?? message.direction,
    };
    const service = message.replyTo.service ?? target?.service;
    if (service !== undefined) logical.replyTo.service = service;
    if (message.replyTo.sender !== undefined) logical.replyTo.sender = message.replyTo.sender;
  }
  if (message.effect === "invisible-ink") logical.revealed = message.revealed ?? false;
  if (message.readAt !== undefined) logical.readAt = message.readAt;
  if (message.edited !== undefined) logical.edited = message.edited;
  return logical;
}

function emptyConversation(id: string, contact: DemoFlow["contact"]): ConversationState {
  return { id, contact: { ...contact }, messages: [], draft: "", typing: false, scroll: 0 };
}

function convertConversation(id: string, contact: DemoFlow["contact"], conversation?: InitialConversation): ConversationState {
  const messages: LogicalMessage[] = [];
  for (const message of conversation?.messages ?? []) messages.push(copyMessage(message, messages));
  return {
    id,
    contact: { ...(conversation?.contact ?? contact) },
    messages,
    draft: conversation?.draft ?? "",
    typing: conversation?.typing ?? false,
    scroll: conversation?.scroll ?? 0,
  };
}

function createWorking(compiled: DemoSource): Working {
  const initial = initialOf(compiled);
  const selectedConversationId = initial?.selectedConversationId ?? compiled.id;
  const seeded = initial?.conversations?.length
    ? initial.conversations.map((conversation) => convertConversation(conversation.id, compiled.contact, conversation))
    : [emptyConversation(compiled.id, compiled.contact)];
  const conversations = seeded.some((conversation) => conversation.id === selectedConversationId)
    ? seeded
    : [...seeded, emptyConversation(selectedConversationId, compiled.contact)];
  return {
    screen: initial?.screen ?? compiled.screen,
    windowActive: initial?.windowActive ?? true,
    selectedConversationId,
    conversations,
    overlay: initial?.overlay ? copyOverlay(initial.overlay) : { kind: "closed" },
    audio: null,
    timeReveal: 0,
    notices: [],
  };
}

function replyCounts(messages: readonly LogicalMessage[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const message of messages) {
    if (!message.replyTo) continue;
    counts.set(message.replyTo.id, (counts.get(message.replyTo.id) ?? 0) + 1);
  }
  return counts;
}

function projectConversation(conversation: ConversationState): ConversationState {
  const counts = replyCounts(conversation.messages);
  return {
    ...conversation,
    contact: { ...conversation.contact },
    messages: conversation.messages.map((message) => {
      const copy: LogicalMessage = {
        ...message,
        reactions: message.reactions.map((reaction) => ({ ...reaction })),
        replyCount: counts.get(message.id) ?? 0,
      };
      if (message.replyTo) copy.replyTo = { ...message.replyTo };
      if (message.link) copy.link = { ...message.link };
      if (message.attachments) copy.attachments = message.attachments.map((item) => ({ ...item }));
      if (message.images) copy.images = message.images.map((item) => ({ ...item }));
      if (message.audio) copy.audio = { ...message.audio, peaks: message.audio.peaks?.slice() };
      return copy;
    }),
  };
}

function finish(compiled: DemoSource, working: Working, timeMs: number): LogicalState {
  const conversations = working.conversations.map(projectConversation);
  const selected = conversations.find((conversation) => conversation.id === working.selectedConversationId) ?? conversations[0];
  return {
    timeMs,
    playing: false,
    durationMs: compiled.durationMs,
    platform: compiled.platform,
    theme: compiled.theme,
    nowMs: compiled.nowMs,
    screen: working.screen,
    windowActive: working.windowActive,
    selectedConversationId: selected?.id ?? working.selectedConversationId,
    conversations,
    overlay: copyOverlay(working.overlay),
    contact: selected ? { ...selected.contact } : { ...compiled.contact },
    messages: selected?.messages ?? [],
    typing: selected?.typing ?? false,
    draft: selected?.draft ?? "",
    scroll: selected?.scroll ?? 0,
    audio: working.audio ? { ...working.audio } : null,
    timeReveal: working.timeReveal,
    notices: working.notices.map((notice) => ({ ...notice })),
  };
}

function updateConversation(working: Working, id: string, updater: (conversation: ConversationState) => ConversationState): Working {
  return {
    ...working,
    conversations: working.conversations.map((conversation) => (conversation.id === id ? updater(conversation) : conversation)),
  };
}

function ensureConversation(working: Working, id: string, contact: DemoFlow["contact"]): Working {
  if (working.conversations.some((conversation) => conversation.id === id)) return working;
  return { ...working, conversations: [...working.conversations, emptyConversation(id, contact)] };
}

function withContact(working: Working, id: string, contact: DemoFlow["contact"] | undefined): Working {
  if (!contact) return working;
  return updateConversation(working, id, (conversation) => ({ ...conversation, contact: { ...contact } }));
}

function hasMessage(working: Working, messageId: string): boolean {
  return working.conversations.some((conversation) => conversation.messages.some((message) => message.id === messageId));
}

function mapMessage(working: Working, messageId: string, updater: (message: LogicalMessage) => LogicalMessage): Working {
  return {
    ...working,
    conversations: working.conversations.map((conversation) => {
      if (!conversation.messages.some((message) => message.id === messageId)) return conversation;
      return {
        ...conversation,
        messages: conversation.messages.map((message) => (message.id === messageId ? updater(message) : message)),
      };
    }),
  };
}

function findMessage(working: Working, messageId: string): LogicalMessage | undefined {
  for (const conversation of working.conversations) {
    const message = conversation.messages.find((item) => item.id === messageId);
    if (message) return message;
  }
  return undefined;
}

function conversationTarget(event: SceneEvent, selected: string): string {
  if ("conversationId" in event && typeof event.conversationId === "string") return event.conversationId;
  return selected;
}

function reduceEvent(working: Working, event: SceneEvent, fallbackContact: DemoFlow["contact"]): Working {
  switch (event.type) {
    case "message": {
      const conversationId = conversationTarget(event, working.selectedConversationId);
      const ensured = ensureConversation(working, conversationId, fallbackContact);
      if (hasMessage(ensured, event.message.id)) return ensured;
      return updateConversation(ensured, conversationId, (conversation) => ({
        ...conversation,
        messages: [...conversation.messages, copyMessage(event.message, conversation.messages)],
      }));
    }
    case "typing": {
      const conversationId = conversationTarget(event, working.selectedConversationId);
      const ensured = ensureConversation(working, conversationId, fallbackContact);
      return updateConversation(ensured, conversationId, (conversation) => ({ ...conversation, typing: event.typing }));
    }
    case "draft": {
      const conversationId = conversationTarget(event, working.selectedConversationId);
      const ensured = ensureConversation(working, conversationId, fallbackContact);
      return updateConversation(ensured, conversationId, (conversation) => ({ ...conversation, draft: event.value }));
    }
    case "status":
      return mapMessage(working, event.messageId, (message) => ({ ...message, status: event.status }));
    case "reaction":
      return mapMessage(working, event.messageId, (message) => {
        if (event.reaction === null) {
          return { ...message, reactions: message.reactions.filter((reaction) => reaction.id !== event.reactionId) };
        }
        const next: Reaction = { id: event.reactionId, type: event.reaction.type };
        if (event.reaction.byMe !== undefined) next.byMe = event.reaction.byMe;
        if (event.reaction.emoji !== undefined) next.emoji = event.reaction.emoji;
        const exists = message.reactions.some((reaction) => reaction.id === event.reactionId);
        return {
          ...message,
          reactions: exists
            ? message.reactions.map((reaction) => (reaction.id === event.reactionId ? next : reaction))
            : [...message.reactions, next],
        };
      });
    case "edit":
      return mapMessage(working, event.messageId, (message) => ({ ...message, text: event.text, edited: true }));
    case "remove":
      return {
        ...working,
        conversations: working.conversations.map((conversation) => ({
          ...conversation,
          messages: conversation.messages.filter((message) => message.id !== event.messageId),
        })),
      };
    case "reveal":
      return mapMessage(working, event.messageId, (message) => ({ ...message, revealed: event.revealed }));
    case "screen":
      return { ...working, screen: event.screen };
    case "select-conversation": {
      const ensured = ensureConversation(working, event.conversationId, event.contact ?? fallbackContact);
      return { ...withContact(ensured, event.conversationId, event.contact), selectedConversationId: event.conversationId };
    }
    case "scroll": {
      const conversationId = conversationTarget(event, working.selectedConversationId);
      const ensured = ensureConversation(working, conversationId, fallbackContact);
      return updateConversation(ensured, conversationId, (conversation) => ({ ...conversation, scroll: event.offset }));
    }
    case "window-active":
      return { ...working, windowActive: event.active };
    case "overlay":
      return { ...working, overlay: copyOverlay(event.overlay) };
    case "screen-effect":
      return working;
    case "audio-control":
      return {
        ...working,
        audio: {
          messageId: event.messageId,
          position: event.position,
          playing: event.playing,
          ...(event.seeking !== undefined ? { seeking: event.seeking } : {}),
        },
      };
    case "time-reveal":
      return { ...working, timeReveal: event.progress };
    case "notice":
      return { ...working, notices: [...working.notices, { ...event.notice }] };
    default:
      return working;
  }
}

function messageCueDuration(direction: LogicalMessage["direction"], reduced: boolean): number {
  const motion = messageMotion();
  if (reduced) return motion.reduced.duration;
  return direction === "outgoing" ? motion.send.duration : motion.receive.duration;
}

function overlayMotion(overlay: OverlayState, phase: "enter" | "exit"): number {
  switch (overlay.kind) {
    case "closed":
      return 0;
    case "context-menu":
      return phase === "enter" ? macTransitions().menu.open : pendingCueDurations.contextMenuExit;
    case "plus-menu":
      return phase === "enter" ? pendingCueDurations.plusMenuEnter : pendingCueDurations.plusMenuExit;
    case "thread":
      return phase === "enter" ? pendingCueDurations.threadEnter : pendingCueDurations.threadExit;
    case "long-press":
      return phase === "enter" ? pendingCueDurations.longPressEnter : pendingCueDurations.longPressExit;
    case "effects-picker":
      return phase === "enter" ? pendingCueDurations.effectsPickerEnter : pendingCueDurations.effectsPickerExit;
    case "image-viewer":
      return pendingCueDurations.imageViewer;
    case "details":
      return phase === "enter" ? pendingCueDurations.detailsEnter : pendingCueDurations.detailsExit;
    case "photo-picker":
      return phase === "enter" ? pendingCueDurations.photoPickerEnter : pendingCueDurations.photoPickerExit;
    case "selection":
      return phase === "enter" ? pendingCueDurations.selectionEnter : pendingCueDurations.selectionExit;
  }
}

function copyOverlay(overlay: OverlayState): OverlayState {
  switch (overlay.kind) {
    case "closed":
      return { kind: "closed" };
    case "plus-menu":
      return { kind: "plus-menu" };
    case "thread":
      return { kind: "thread", rootId: overlay.rootId };
    case "long-press":
      return { kind: "long-press", messageId: overlay.messageId };
    case "context-menu":
      return { kind: "context-menu", messageId: overlay.messageId, x: overlay.x, y: overlay.y };
    case "effects-picker":
      return {
        kind: "effects-picker",
        tab: overlay.tab,
        draft: overlay.draft,
        ...(overlay.effect !== undefined ? { effect: overlay.effect } : {}),
      };
    case "image-viewer":
      return { kind: "image-viewer", messageId: overlay.messageId, index: overlay.index };
    case "details":
      return { kind: "details" };
    case "photo-picker":
      return overlay.selectedId !== undefined ? { kind: "photo-picker", selectedId: overlay.selectedId } : { kind: "photo-picker" };
    case "selection":
      return { kind: "selection", messageIds: [...overlay.messageIds] };
  }
}

function sameOverlay(left: OverlayState, right: OverlayState): boolean {
  return JSON.stringify(copyOverlay(left)) === JSON.stringify(copyOverlay(right));
}

function seed(partial: CueSeed): CueSeed | null {
  if (!(partial.durationMs > 0)) return null;
  return partial;
}

function cuesFor(compiled: DemoSource, working: Working, prepared: Prepared, origin: LogicalState): CueSeed[] {
  const event = prepared.event;
  const seeds: Array<CueSeed | null> = [];
  const stamp = { startedAtMs: prepared.atMs, sourceIndex: prepared.sourceIndex };
  if (event.type === "message" && !hasMessage(working, event.message.id)) {
    const durationMs = messageCueDuration(event.message.direction, reducedMotion(compiled));
    const kind = event.message.direction === "outgoing" ? "send" : "receive";
    seeds.push(seed({
      ...stamp,
      id: `${kind}:${event.message.id}:${prepared.atMs}:${prepared.sourceIndex}`,
      kind,
      durationMs,
      subjectId: event.message.id,
      detail: { direction: event.message.direction, effect: event.message.effect },
    }));
    if (event.message.effect) {
      const effectDuration = bubbleEffectDuration(event.message.effect);
      seeds.push(seed({
        ...stamp,
        id: `bubble-effect:${event.message.id}:${prepared.atMs}:${prepared.sourceIndex}`,
        kind: "bubble-effect",
        durationMs: effectDuration,
        subjectId: event.message.id,
        detail: { effect: event.message.effect, direction: event.message.direction },
      }));
    }
  }
  if (event.type === "reaction" && findMessage(working, event.messageId)) {
    const previous = findMessage(working, event.messageId)?.reactions.find((reaction) => reaction.id === event.reactionId) ?? null;
    const next = event.reaction === null ? null : { id: event.reactionId, ...event.reaction };
    seeds.push(seed({
      ...stamp,
      id: `reaction:${event.reactionId}:${prepared.atMs}:${prepared.sourceIndex}`,
      kind: "reaction",
      durationMs: messageMotion().reaction,
      subjectId: event.messageId,
      detail: { reactionId: event.reactionId, reaction: next, previousReaction: previous ? { ...previous } : null },
    }));
  }
  if (event.type === "screen" && compiled.platform === "ios") {
    const kind = screenTransitionKind(working.screen, event.screen);
    if (kind) {
      seeds.push(seed({
        ...stamp,
        id: `screen:${kind}:${prepared.atMs}:${prepared.sourceIndex}`,
        kind: "screen",
        durationMs: screenTransitionDuration(kind),
        transition: kind,
        beforeState: origin,
        detail: { fromScreen: working.screen, toScreen: event.screen },
      }));
    }
  }
  if (event.type === "select-conversation" && compiled.platform === "macos" && event.conversationId !== working.selectedConversationId) {
    const mac = macTransitions();
    seeds.push(seed({
      ...stamp,
      id: `conversation:${event.conversationId}:${prepared.atMs}:${prepared.sourceIndex}`,
      kind: "conversation",
      durationMs: mac.conversation.duration,
      subjectId: event.conversationId,
      beforeState: origin,
      detail: { fromConversationId: working.selectedConversationId, toConversationId: event.conversationId },
    }));
    seeds.push(seed({
      ...stamp,
      id: `selection-text:${event.conversationId}:${prepared.atMs}:${prepared.sourceIndex}`,
      kind: "selection-text",
      durationMs: mac.selection.text,
      subjectId: event.conversationId,
      detail: { fromConversationId: working.selectedConversationId, toConversationId: event.conversationId },
    }));
  }
  if (event.type === "overlay" && !sameOverlay(working.overlay, event.overlay)) {
    if (working.overlay.kind !== "closed") {
      seeds.push(seed({
        ...stamp,
        id: `overlay-exit:${working.overlay.kind}:${prepared.atMs}:${prepared.sourceIndex}`,
        kind: "overlay-exit",
        durationMs: overlayMotion(working.overlay, "exit"),
        subjectId: "rootId" in working.overlay ? working.overlay.rootId : "messageId" in working.overlay ? working.overlay.messageId : working.overlay.kind,
        beforeState: origin,
        detail: { overlay: copyOverlay(working.overlay) },
      }));
    }
    if (event.overlay.kind !== "closed") {
      seeds.push(seed({
        ...stamp,
        id: `overlay-enter:${event.overlay.kind}:${prepared.atMs}:${prepared.sourceIndex}`,
        kind: "overlay-enter",
        durationMs: overlayMotion(event.overlay, "enter"),
        subjectId: "rootId" in event.overlay ? event.overlay.rootId : "messageId" in event.overlay ? event.overlay.messageId : event.overlay.kind,
        detail: { overlay: copyOverlay(event.overlay) },
      }));
    }
  }
  if (event.type === "screen-effect") {
    seeds.push(seed({
      ...stamp,
      id: `screen-effect:${event.effect}:${prepared.atMs}:${prepared.sourceIndex}`,
      kind: "screen-effect",
      durationMs: screenEffectDuration(event.effect),
      subjectId: event.messageId,
      detail: { effect: event.effect },
    }));
  }
  return seeds.filter((item): item is CueSeed => item !== null);
}

function projectAt(compiled: DemoSource, timeMs: number): { state: LogicalState; seeds: CueSeed[] } {
  const t = queryTime(timeMs);
  let working = createWorking(compiled);
  const seeds: CueSeed[] = [];
  for (const prepared of prepare(readEvents(compiled))) {
    if (prepared.atMs > t) break;
    const origin = finish(compiled, working, prepared.atMs);
    seeds.push(...cuesFor(compiled, working, prepared, origin));
    working = reduceEvent(working, prepared.event, compiled.contact);
  }
  return { state: finish(compiled, working, t), seeds };
}

function activate(seeds: CueSeed[], timeMs: number): Cue[] {
  const cues: Cue[] = [];
  for (const item of seeds) {
    const elapsedMs = timeMs - item.startedAtMs;
    const progress = cueProgress(elapsedMs, item.durationMs);
    if (progress === null) continue;
    const cue: Cue = {
      id: item.id,
      kind: item.kind,
      startedAtMs: item.startedAtMs,
      elapsedMs,
      durationMs: item.durationMs,
      progress,
      sourceIndex: item.sourceIndex,
    };
    if (item.subjectId !== undefined) cue.subjectId = item.subjectId;
    if (item.transition !== undefined) cue.transition = item.transition;
    if (item.beforeState !== undefined) cue.beforeState = item.beforeState;
    if (item.detail !== undefined) cue.detail = item.detail;
    cues.push(cue);
  }
  return cues;
}

export function frameAt(compiled: DemoSource, timeMs: number): VisualFrame {
  const t = queryTime(timeMs);
  const { state, seeds } = projectAt(compiled, t);
  const cues = activate(seeds, t).filter((cue) => cueHolds(state, cue));
  const cached = cues.filter((cue) => cue.beforeState !== undefined);
  const beforeState = cached.length > 0 ? cached[cached.length - 1].beforeState ?? null : null;
  return { ...state, cues, beforeState };
}

export function stateAt(compiled: DemoSource, timeMs: number): LogicalState {
  const frame = frameAt(compiled, timeMs);
  const { cues: _cues, beforeState: _beforeState, ...state } = frame;
  return state;
}

export function logicalState(frame: VisualFrame): LogicalState {
  const { cues: _cues, beforeState: _beforeState, ...state } = frame;
  return state;
}

function cueHolds(state: LogicalState, cue: Cue): boolean {
  if (cue.kind !== "send" && cue.kind !== "receive" && cue.kind !== "bubble-effect" && cue.kind !== "reaction") return true;
  if (!cue.subjectId) return false;
  return state.conversations.some((conversation) => conversation.messages.some((message) => message.id === cue.subjectId));
}
