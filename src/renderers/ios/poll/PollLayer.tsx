import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { CompiledDemo, DemoMessage } from "@/contracts";
import { iosScreen } from "@/components/imessage/ios-messages-app";
import { senderAvatarMetricsForPlatform } from "@/components/imessage/group-avatar";
import { bubbleMetrics } from "@/components/imessage/tokens";
import type { VisualFrame } from "@/runtime";
import { Poll, pollScaleFor, pollStackHeight } from "./Poll";

function rowSelector(id: string): string {
  return `[data-slot="message-row"][data-message-id="${CSS.escape(id)}"]`;
}

export function pollViewWidth(groupIncoming: boolean): number {
  const content = iosScreen.width - bubbleMetrics.ios.edgeInset * 2;
  return content - (groupIncoming ? senderAvatarMetricsForPlatform("ios").gutter : 0);
}

export function PollLayer({
  compiled,
  frame,
  frameRef,
  onVote,
}: {
  compiled: CompiledDemo;
  frame: VisualFrame;
  frameRef: RefObject<HTMLElement | null>;
  onVote?: (messageId: string, optionId: string) => void;
}) {
  const polls = frame.messages.filter((message): message is VisualFrame["messages"][number] & { poll: NonNullable<DemoMessage["poll"]> } => message.kind === "poll" && message.poll !== undefined);
  const group = Boolean(compiled.group) || (compiled.participants?.length ?? 0) > 1;
  const hideRule = polls
    .map((message) => `${rowSelector(message.id)} [data-slot="message-bubble"]`)
    .join(",");
  return (
    <>
      {hideRule ? <style data-slot="poll-style">{`${hideRule}{display:none !important}`}</style> : null}
      {polls.map((message) => (
        <PollDock
          key={message.id}
          message={message}
          frameRef={frameRef}
          timeMs={frame.timeMs}
          theme={frame.theme}
          participants={compiled.participants ?? []}
          viewWidth={pollViewWidth(group && message.direction === "incoming" && Boolean(message.sender))}
          detailsOpen={frame.overlay.kind === "poll-details" && frame.overlay.messageId === message.id}
          onVote={onVote ? (optionId) => onVote(message.id, optionId) : undefined}
        />
      ))}
    </>
  );
}

function PollDock({
  message,
  frameRef,
  timeMs,
  theme,
  participants,
  viewWidth,
  detailsOpen,
  onVote,
}: {
  message: VisualFrame["messages"][number] & { poll: NonNullable<DemoMessage["poll"]> };
  frameRef: RefObject<HTMLElement | null>;
  timeMs: number;
  theme: VisualFrame["theme"];
  participants: NonNullable<CompiledDemo["participants"]>;
  viewWidth: number;
  detailsOpen: boolean;
  onVote?: (optionId: string) => void;
}) {
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.dataset.slot = "poll-host";
    element.dataset.messageId = "";
    return element;
  });
  const mounted = useRef(false);
  const question = message.poll.question.trim().length > 0;
  const height = pollStackHeight(message.poll.options.map((option) => option.text), pollScaleFor(viewWidth), question);

  useLayoutEffect(() => {
    container.dataset.messageId = message.id;
    Object.assign(container.style, {
      position: "relative",
      width: `${viewWidth}px`,
      minHeight: `${height}px`,
      flex: "none",
      overflow: "visible",
    });
  }, [container, height, message.id, viewWidth]);

  const dock = useRef(() => {});
  dock.current = () => {
    const row = frameRef.current?.querySelector(rowSelector(message.id));
    if (row && container.parentElement !== row) row.appendChild(container);
  };
  useLayoutEffect(() => dock.current());
  useLayoutEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    const observer = new MutationObserver(() => dock.current());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [frameRef]);

  useEffect(() => {
    const stopMenu = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const stopDouble = (event: Event) => event.stopPropagation();
    container.addEventListener("contextmenu", stopMenu);
    container.addEventListener("dblclick", stopDouble);
    return () => {
      container.removeEventListener("contextmenu", stopMenu);
      container.removeEventListener("dblclick", stopDouble);
    };
  }, [container]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) container.remove();
      });
    };
  }, [container]);

  if (!message.poll) return null;
  return createPortal(
    <Poll
      poll={message.poll}
      timeMs={timeMs}
      viewWidth={viewWidth}
      participants={participants}
      detailsOpen={detailsOpen}
      theme={theme}
      onVote={onVote}
    />,
    container,
  );
}
