import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { frameAt, pendingCueDurations, stateAt, type RuntimeDemo } from "@/runtime";
import {
  describeDetails,
  describeInteraction,
  describeLongPress,
  describeNotices,
  describePhotoPicker,
  describePlusMenu,
  describeSelection,
  describeThread,
  describeTimeReveal,
  iosInteractionShell,
} from "@/renderers/ios/interaction-state";
import { renderIosOverlays, renderNotices, renderSwipeTimes } from "@/renderers/ios/overlays";
import { MessageBubble } from "@/components/imessage/message-bubble";
import { MessageList } from "@/components/imessage/message-list";

const contact = { name: "Alex Morgan", initials: "AM" };
const sentAt = 1_758_470_000_000;

function message(id: string, text: string, direction: "incoming" | "outgoing" = "incoming") {
  return { id, text, direction, atMs: sentAt };
}

function demo(events: RuntimeDemo["events"], extra: Partial<RuntimeDemo> = {}): RuntimeDemo {
  return {
    id: "interactions",
    platform: "ios",
    theme: "light",
    durationMs: 20_000,
    contact,
    nowMs: sentAt + 60_000,
    screen: "conversation",
    events,
    ...extra,
  };
}

describe("iOS interaction-state from canonical runtime", () => {
  it("reads long-press open message id and cue progress", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hello") },
      { type: "overlay", atMs: 1000, overlay: { kind: "long-press", messageId: "m1" } },
    ]);
    const enter = pendingCueDurations.longPressEnter;
    const mid = frameAt(compiled, 1000 + enter / 2);
    const pose = describeLongPress(mid);
    expect(pose).toEqual({ open: true, messageId: "m1", progress: 0.5 });
    expect(iosInteractionShell(mid).longPress).toEqual({ id: "m1", progress: 0.5 });

    const settled = stateAt(compiled, 1000 + enter);
    expect(describeLongPress(settled)).toEqual({ open: true, messageId: "m1", progress: 1 });

    const closed = frameAt(compiled, 1000 + enter);
    const dismissed = demo([
      { type: "message", atMs: 0, message: message("m1", "Hello") },
      { type: "overlay", atMs: 1000, overlay: { kind: "long-press", messageId: "m1" } },
      { type: "overlay", atMs: 2000, overlay: { kind: "closed" } },
    ]);
    const afterClose = stateAt(dismissed, 2000 + pendingCueDurations.longPressExit);
    expect(describeLongPress(afterClose)).toBeNull();
    expect(closed.overlay).toEqual({ kind: "long-press", messageId: "m1" });
  });

  it("reads thread root id with seekable progress", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("root", "Earlier") },
      {
        type: "message",
        atMs: 100,
        message: {
          ...message("reply", "This reply", "outgoing"),
          replyTo: { id: "root", text: "Earlier", direction: "incoming" },
        },
      },
      { type: "overlay", atMs: 500, overlay: { kind: "thread", rootId: "root" } },
    ]);
    const enter = pendingCueDurations.threadEnter;
    const mid = frameAt(compiled, 500 + enter / 2);
    expect(describeThread(mid)).toEqual({ open: true, rootId: "root", progress: 0.5 });
    expect(iosInteractionShell(mid).thread).toEqual({ rootId: "root", progress: 0.5 });
    expect(iosInteractionShell(mid).flash).toEqual({ id: "root", progress: 0.5 });
  });

  it("reads selection message ids", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "A") },
      { type: "message", atMs: 50, message: message("m2", "B") },
      { type: "overlay", atMs: 200, overlay: { kind: "selection", messageIds: ["m1", "m2"] } },
    ]);
    const settled = stateAt(compiled, 200 + pendingCueDurations.selectionEnter);
    expect(describeSelection(settled)).toEqual({
      open: true,
      progress: 1,
      messageIds: ["m1", "m2"],
    });
  });

  it("reads timeReveal progress for swipe timestamps", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "time-reveal", atMs: 300, progress: 0.65 },
    ]);
    expect(describeTimeReveal(stateAt(compiled, 300))).toBe(0.65);
    expect(describeTimeReveal(stateAt(compiled, 0))).toBe(0);
  });

  it("reads notice kinds without inventing group-chat events", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "notice", atMs: 100, notice: { kind: "unknown-sender" } },
      { type: "notice", atMs: 200, notice: { kind: "not-delivered", messageId: "m1" } },
      { type: "notice", atMs: 300, notice: { kind: "missed-call", call: "video" } },
    ]);
    const notices = describeNotices(stateAt(compiled, 300));
    expect(notices).toEqual([
      { kind: "unknown-sender" },
      { kind: "not-delivered", messageId: "m1" },
      { kind: "missed-call", call: "video" },
    ]);
  });

  it("reads photo picker selectedId and open pose", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 400, overlay: { kind: "photo-picker", selectedId: "dune" } },
    ]);
    const pose = describePhotoPicker(stateAt(compiled, 400 + pendingCueDurations.photoPickerEnter));
    expect(pose).toEqual({ open: true, progress: 1, selectedId: "dune" });
  });

  it("reads details and plus-menu open poses", () => {
    const detailsDemo = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "details" } },
    ]);
    expect(describeDetails(stateAt(detailsDemo, 100 + pendingCueDurations.detailsEnter))).toEqual({
      open: true,
      progress: 1,
    });

    const plusDemo = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "plus-menu" } },
    ]);
    expect(describePlusMenu(stateAt(plusDemo, 100 + pendingCueDurations.plusMenuEnter))).toEqual({
      open: true,
      progress: 1,
    });
  });

  it("aggregates a full interaction pose from one frame", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "edit", atMs: 50, messageId: "m1", text: "Hi there" },
      { type: "time-reveal", atMs: 80, progress: 0.4 },
      { type: "notice", atMs: 90, notice: { kind: "unknown-sender" } },
      { type: "overlay", atMs: 100, overlay: { kind: "selection", messageIds: ["m1"] } },
    ]);
    const pose = describeInteraction(stateAt(compiled, 100 + pendingCueDurations.selectionEnter));
    expect(pose.selection?.messageIds).toEqual(["m1"]);
    expect(pose.timeReveal).toBe(0.4);
    expect(pose.notices).toEqual([{ kind: "unknown-sender" }]);
    expect(pose.edit.editedIds).toEqual(["m1"]);
  });
});

describe("iOS overlays render from canonical state", () => {
  it("mounts plus menu, details, photo picker, and selection from overlay kind", () => {
    const plus = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "plus-menu" } },
    ]);
    const plusHtml = renderToStaticMarkup(
      <>{renderIosOverlays(stateAt(plus, 100 + pendingCueDurations.plusMenuEnter), { contact })}</>,
    );
    expect(plusHtml).toContain("data-slot=\"ios-plus-menu\"");

    const details = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "details" } },
    ]);
    const detailsHtml = renderToStaticMarkup(
      <>{renderIosOverlays(stateAt(details, 100 + pendingCueDurations.detailsEnter), { contact })}</>,
    );
    expect(detailsHtml).toContain("data-slot=\"ios-details\"");

    const picker = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "photo-picker", selectedId: "leaf" } },
    ]);
    const pickerHtml = renderToStaticMarkup(
      <>{renderIosOverlays(stateAt(picker, 100 + pendingCueDurations.photoPickerEnter), { contact })}</>,
    );
    expect(pickerHtml).toContain("data-slot=\"photo-picker\"");

    const selection = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "overlay", atMs: 100, overlay: { kind: "selection", messageIds: ["m1"] } },
    ]);
    const selectionHtml = renderToStaticMarkup(
      <>{renderIosOverlays(stateAt(selection, 100 + pendingCueDurations.selectionEnter), { contact })}</>,
    );
    expect(selectionHtml).toContain("data-slot=\"ios-select-mode\"");
    expect(selectionHtml).toContain("data-slot=\"ios-selection-toolbar\"");
    expect(selectionHtml).toContain("data-slot=\"message-selection-row\"");
    expect(selectionHtml).toContain("data-message-id=\"m1\"");
    expect(selectionHtml).toContain("data-slot=\"bubble\"");
    expect(selectionHtml).toContain("Hi");
    expect(selectionHtml).not.toContain("data-slot=\"selection-message-id\"");
  });

  it("wraps the live message row instead of an empty selection placeholder", () => {
    const html = renderToStaticMarkup(
      <MessageList
        messages={[{ id: "m1", text: "Are you close?", direction: "incoming", sentAt }]}
        iosSelection={{ active: true, progress: 1, messageIds: ["m1"] }}
      />,
    );
    expect(html).toContain("data-slot=\"message-selection-row\"");
    expect(html).toContain("data-message-id=\"m1\"");
    expect(html).toContain("data-slot=\"bubble\"");
    expect(html).toContain("Are you close?");
    expect(html).not.toContain("data-slot=\"selection-message-id\"");
  });

  it("renders notices and controlled swipe progress from state", () => {
    const compiled = demo([
      { type: "message", atMs: 0, message: message("m1", "Hi") },
      { type: "notice", atMs: 100, notice: { kind: "unknown-sender" } },
      { type: "notice", atMs: 150, notice: { kind: "missed-call", call: "audio" } },
      { type: "time-reveal", atMs: 200, progress: 0.8 },
    ]);
    const state = stateAt(compiled, 200);
    const noticeHtml = renderToStaticMarkup(<>{renderNotices(state)}</>);
    expect(noticeHtml).toContain("data-slot=\"unknown-sender-notice\"");
    expect(noticeHtml).toContain("Missed Call");

    const swipeHtml = renderToStaticMarkup(
      <>{renderSwipeTimes(state, "4:41", <MessageBubble direction="incoming" tail>Swipe</MessageBubble>)}</>,
    );
    expect(swipeHtml).toContain("data-slot=\"swipe-times\"");
  });
});
