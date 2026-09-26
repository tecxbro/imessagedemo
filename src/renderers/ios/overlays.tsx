import type { ReactNode } from "react";
import type { CompiledDemo, DemoFlow } from "@/contracts";
import type { SystemNotice } from "@/runtime/types";
import { IosPlusMenu } from "@/components/imessage/ios-plus-menu";
import { IosDetails } from "@/components/imessage/ios-details";
import { PhotoPicker, photoPickerSamples } from "@/components/imessage/photo-picker";
import {
  IosSelectMode,
  IosSelectionToolbar,
  MessageSelectionRow,
} from "@/components/imessage/ios-select-mode";
import { SwipeTimes } from "@/components/imessage/ios-swipe-times";
import { EditableBubble, EditedLabel, UndoSendPoof, undoSendPoof } from "@/components/imessage/message-edit";
import { SystemMessage, type SystemMessageEvent } from "@/components/imessage/system-message";
import { UnknownSenderNotice, NotDelivered } from "@/components/imessage/ios-notices";
import { MessageBubble } from "@/components/imessage/message-bubble";
import {
  describeDetails,
  describeEdit,
  describeInteraction,
  describeNotices,
  describePhotoPicker,
  describePlusMenu,
  describeSelection,
  describeTimeReveal,
  type InteractionInput,
  type InteractionPose,
} from "./interaction-state";

export type OverlayRenderOptions = {
  contact?: DemoFlow["contact"];
  /** Photos for the picker; defaults to the pin's samples. */
  photos?: typeof photoPickerSamples;
  /** Message rows rendered inside selection mode (circles + toolbar wrap these). */
  selectionChildren?: ReactNode;
  /**
   * The conversation log owns select mode and wraps its real rows.
   * Skip the overlay copy so the circles are not a second, empty list.
   */
  selectionInList?: boolean;
};

/** Map canonical notices onto the pinned system-message / notice components' event shapes. */
export function noticeToSystemEvent(notice: SystemNotice): SystemMessageEvent | null {
  switch (notice.kind) {
    case "unknown-sender":
      return { type: "unknownSender" };
    case "missed-call":
      return { type: "missedCall", kind: notice.call };
    case "not-delivered":
      return null;
  }
}

export function renderNotice(notice: SystemNotice, key?: string): ReactNode {
  if (notice.kind === "unknown-sender") {
    return <UnknownSenderNotice key={key ?? notice.kind} />;
  }
  if (notice.kind === "not-delivered") {
    return <NotDelivered key={key ?? `${notice.kind}:${notice.messageId}`} />;
  }
  if (notice.kind === "missed-call") {
    return <SystemMessage key={key ?? `${notice.kind}:${notice.call}`} event={{ type: "missedCall", kind: notice.call }} platform="ios" />;
  }
  return null;
}

export function renderNotices(state: InteractionInput): ReactNode {
  const notices = describeNotices(state);
  if (notices.length === 0) return null;
  return (
    <div data-slot="ios-runtime-notices">
      {notices.map((notice, index) => renderNotice(notice, `${notice.kind}:${index}`))}
    </div>
  );
}

export function renderPlusMenu(state: InteractionInput): ReactNode {
  const pose = describePlusMenu(state);
  if (!pose) return null;
  return <IosPlusMenu open={pose.open} progress={pose.progress} />;
}

export function renderDetails(state: InteractionInput, contact: DemoFlow["contact"]): ReactNode {
  const pose = describeDetails(state);
  if (!pose) return null;
  return (
    <IosDetails
      name={contact.name}
      initials={contact.initials}
      open={pose.open}
      progress={pose.progress}
    />
  );
}

export function renderPhotoPicker(
  state: InteractionInput,
  photos: typeof photoPickerSamples = photoPickerSamples,
): ReactNode {
  const pose = describePhotoPicker(state);
  if (!pose) return null;
  const selected = pose.selectedId ? [pose.selectedId] : [];
  return (
    <PhotoPicker
      photos={photos}
      selected={selected}
      open={pose.open}
      progress={pose.progress}
      multiple={false}
    />
  );
}

export function renderSelection(
  state: InteractionInput,
  children?: ReactNode,
): ReactNode {
  const pose = describeSelection(state);
  if (!pose) return null;
  const selected = new Set(pose.messageIds);
  const rows = children ?? state.messages.map((message) => (
    <MessageSelectionRow
      key={message.id}
      data-message-id={message.id}
      selected={selected.has(message.id)}
      active={pose.open}
      progress={pose.progress}
      label={message.text || message.id}
    >
      <MessageBubble direction={message.direction} tail>
        {message.text}
      </MessageBubble>
    </MessageSelectionRow>
  ));
  return (
    <IosSelectMode active={pose.open} progress={pose.progress}>
      {rows}
      <IosSelectionToolbar count={pose.messageIds.length} active={pose.open} progress={pose.progress} />
    </IosSelectMode>
  );
}

/**
 * Overlay stack driven only by canonical overlay state (plus menu, details, photo picker, selection).
 * Long-press and thread stay on `IosMessagesApp` shell props via `iosInteractionShell`.
 */
export function renderIosOverlays(state: InteractionInput, options: OverlayRenderOptions = {}): ReactNode {
  const contact = options.contact ?? { name: "Contact" };
  const parts: ReactNode[] = [];
  const plus = renderPlusMenu(state);
  if (plus) parts.push(<div key="plus-menu" data-slot="ios-overlay-plus-menu">{plus}</div>);
  const details = renderDetails(state, contact);
  if (details) parts.push(<div key="details" data-slot="ios-overlay-details">{details}</div>);
  const picker = renderPhotoPicker(state, options.photos);
  if (picker) parts.push(<div key="photo-picker" data-slot="ios-overlay-photo-picker">{picker}</div>);
  if (!options.selectionInList) {
    const selection = renderSelection(state, options.selectionChildren);
    if (selection) parts.push(<div key="selection" data-slot="ios-overlay-selection">{selection}</div>);
  }
  if (parts.length === 0) return null;
  return <div data-slot="ios-runtime-overlays">{parts}</div>;
}

/** Wrap message content with controlled swipe-timestamp progress from `state.timeReveal`. */
export function renderSwipeTimes(state: InteractionInput, time: string, children: ReactNode): ReactNode {
  const progress = describeTimeReveal(state);
  return (
    <SwipeTimes time={time} progress={progress}>
      {children}
    </SwipeTimes>
  );
}

export function renderEditedLabels(state: InteractionInput): ReactNode {
  const edit = describeEdit(state);
  if (edit.editedIds.length === 0) return null;
  const byId = new Map(state.messages.map((message) => [message.id, message]));
  return (
    <div data-slot="ios-runtime-edited">
      {edit.editedIds.map((id) => {
        const message = byId.get(id);
        return (
          <EditedLabel
            key={id}
            data-message-id={id}
            direction={message?.direction ?? "outgoing"}
          />
        );
      })}
    </div>
  );
}

export function renderEditableMessage(
  message: { id: string; text: string; direction?: "incoming" | "outgoing" },
): ReactNode {
  return (
    <EditableBubble
      data-message-id={message.id}
      value={message.text}
      direction={message.direction ?? "outgoing"}
      autoFocus={false}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  );
}

export function renderUndoSend(
  state: InteractionInput,
  message: { id: string; text: string; direction?: "incoming" | "outgoing" },
  progress?: number,
): ReactNode {
  const edit = describeEdit(state);
  if (!edit.removedIds.includes(message.id) && edit.undoSend?.messageId !== message.id) {
    return null;
  }
  const poofProgress = progress ?? edit.undoSend?.progress ?? 1;
  return (
    <UndoSendPoof progress={poofProgress} data-message-id={message.id}>
      <MessageBubble direction={message.direction ?? "outgoing"} tail>
        {message.text}
      </MessageBubble>
    </UndoSendPoof>
  );
}

/**
 * Seekable Undo Send. The remove event is the semantic fact; this only paints the pin's poof
 * while that event's 420ms window is still open.
 */
export function undoSendOverlay(compiled: CompiledDemo, timeMs: number): ReactNode {
  const duration = undoSendPoof.duration;
  let removal: { atMs: number; messageId: string } | null = null;
  for (const event of compiled.events) {
    if (event.type !== "remove" || event.atMs > timeMs) continue;
    if (timeMs - event.atMs >= duration) continue;
    if (!removal || event.atMs >= removal.atMs) removal = { atMs: event.atMs, messageId: event.messageId };
  }
  if (!removal) return null;
  const source = compiled.events.find((event) => event.type === "message" && event.message.id === removal.messageId);
  if (!source || source.type !== "message") return null;
  const progress = (timeMs - removal.atMs) / duration;
  return (
    <UndoSendPoof progress={progress} data-message-id={removal.messageId}>
      <MessageBubble direction={source.message.direction} tail>
        {source.message.text}
      </MessageBubble>
    </UndoSendPoof>
  );
}

/** Convenience: full interaction pose + overlay nodes for a VisualFrame / LogicalState. */
export function iosInteractionView(
  state: InteractionInput,
  options: OverlayRenderOptions = {},
): {
  pose: InteractionPose;
  overlays: ReactNode;
  notices: ReactNode;
  timeReveal: number;
} {
  return {
    pose: describeInteraction(state),
    overlays: renderIosOverlays(state, options),
    notices: renderNotices(state),
    timeReveal: describeTimeReveal(state),
  };
}
