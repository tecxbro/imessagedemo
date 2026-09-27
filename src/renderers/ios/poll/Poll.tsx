import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { DemoParticipant, PollPayload, PollVote } from "@/contracts";
import { iosScreen } from "@/components/imessage/ios-messages-app";
import { fontStack } from "@/components/imessage/tokens";
import { pollOptionElapsed } from "@/runtime/poll";
import { BASE, samplePollVote, type RGB } from "./motion";

const DRAG_PX = 8;
const QUESTION_HEIGHT = 22;
/** Drawn capsule height for every poll. Shorter than the recording crop so a one-line option stays compact. */
const POLL_ROW_HEIGHT = 44;
/** Empty ring and voter face, relative to the recorded indicator size. */
const CIRCLE_SCALE = 0.78;
const IDLE_MAX_WIDTH = iosScreen.width * (2 / 5);
const EXPANDED_WIDTH = iosScreen.width * 0.7;
const LABEL_FONT = 17;
const LABEL_LINE = 22;

function cssColor(color: RGB): string {
  return `rgb(${color[0]} ${color[1]} ${color[2]})`;
}

export function pollScaleFor(viewWidth: number): number {
  return viewWidth / BASE.peakWidth;
}

export function pollStackHeight(texts: readonly string[], scale: number, question: boolean): number {
  const gap = BASE.gap * scale;
  const rows = texts.reduce((sum, text) => sum + layoutOption(text, scale, idleWidth(scale)).rowHeight, 0);
  return rows + Math.max(0, texts.length - 1) * gap + (question ? QUESTION_HEIGHT + gap : 0);
}

export { Poll as IosPoll };

export function Poll({
  poll,
  timeMs,
  viewWidth,
  participants,
  detailsOpen = false,
  theme = "dark",
  onVote,
}: {
  poll: PollPayload;
  timeMs: number;
  viewWidth: number;
  participants: readonly DemoParticipant[];
  detailsOpen?: boolean;
  theme?: "light" | "dark";
  onVote?: (optionId: string) => void;
}) {
  const scale = pollScaleFor(viewWidth);
  const question = poll.question.trim();
  const press = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      data-slot="poll"
      data-selection-mode={poll.selectionMode ?? "multiple"}
      data-vote-count={poll.votes?.length ?? 0}
      role="group"
      aria-label={question || "Poll"}
      style={{
        width: viewWidth,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: BASE.gap * scale,
        fontFamily: fontStack,
        color: theme === "dark" ? "#fffaf3" : "#1c1c1e",
      }}
    >
      {question ? (
        <div data-slot="poll-question" style={{ height: QUESTION_HEIGHT, fontSize: 17, lineHeight: "22px", fontWeight: 600, color: theme === "dark" ? "#fffaf3" : "#1c1c1e" }}>
          {question}
        </div>
      ) : null}
      {poll.options.map((option) => {
        const chosen = (poll.votes ?? []).filter((vote) => vote.optionId === option.id);
        const elapsed = pollOptionElapsed(chosen, timeMs);
        const pose = samplePollVote(elapsed === null ? -1 : elapsed, scale);
        const layout = layoutOption(option.text, scale, optionWidth(pose.selected ? pose.widthProgress : 0, scale));
        const { rowWidth, labelMax, rowHeight, fontSize, lineHeight, lines } = layout;
        const ring = pose.ringDiameter * CIRCLE_SCALE;
        const ringStroke = pose.ringStroke * CIRCLE_SCALE;
        const avatar = pose.avatarDiameter * CIRCLE_SCALE;
        const trailing = pose.rowWidth - pose.indicatorCenterFromLeft;
        const voter = latestVoter(chosen);
        const face = voter ? faceFor(voter.participantId, poll, participants) : undefined;
        const activate = (event: { stopPropagation(): void; clientX?: number; clientY?: number }) => {
          const origin = press.current;
          if (origin && event.clientX !== undefined && event.clientY !== undefined) {
            if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > DRAG_PX) return;
          }
          event.stopPropagation();
          onVote?.(option.id);
        };
        return (
          <button
            key={option.id}
            type="button"
            data-slot="poll-option"
            data-option-id={option.id}
            data-selected={pose.selected ? "true" : "false"}
            data-width={rowWidth.toFixed(2)}
            data-progress={pose.widthProgress.toFixed(6)}
            data-label={pose.label.join(",")}
            aria-pressed={pose.selected}
            aria-label={option.text}
            title={option.text}
            onPointerDown={(event: ReactPointerEvent<HTMLButtonElement>) => {
              press.current = { x: event.clientX, y: event.clientY };
            }}
            onClick={(event) => activate(event)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.stopPropagation();
            }}
            style={optionButton(rowWidth, rowHeight)}
          >
            <span
              aria-hidden="true"
              data-slot="poll-pill"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: rowWidth,
                height: rowHeight,
                borderRadius: rowHeight / 2,
                background: cssColor(pose.fill),
                overflow: "hidden",
              }}
            />
            <span
              data-slot="poll-label"
              style={{
                position: "absolute",
                left: pose.labelInset,
                top: "50%",
                transform: "translateY(-50%)",
                display: "block",
                width: labelMax,
                overflow: "hidden",
                whiteSpace: lines > 1 ? "normal" : "nowrap",
                fontSize,
                lineHeight: `${lineHeight}px`,
                fontWeight: 500,
                color: cssColor(pose.label),
                pointerEvents: "none",
              }}
            >
              {option.text}
            </span>
            <span
              aria-hidden="true"
              data-slot="poll-ring"
              style={{
                position: "absolute",
                left: rowWidth - trailing - ring / 2,
                top: (rowHeight - ring) / 2,
                width: ring,
                height: ring,
                boxSizing: "border-box",
                borderRadius: ring / 2,
                border: `${ringStroke}px solid rgb(246 155 52)`,
                opacity: pose.ringOpacity,
                pointerEvents: "none",
              }}
            />
            {face ? (
              <span
                aria-hidden="true"
                data-slot="poll-avatar"
                data-opacity={pose.avatarOpacity.toFixed(3)}
                style={{
                  position: "absolute",
                  left: rowWidth - trailing - avatar / 2,
                  top: (rowHeight - avatar) / 2,
                  width: avatar,
                  height: avatar,
                  borderRadius: avatar / 2,
                  overflow: "hidden",
                  opacity: pose.avatarOpacity,
                  transform: `scale(${pose.avatarScale})`,
                  transformOrigin: "center",
                  pointerEvents: "none",
                  background: "#3a3a3c",
                  color: "#fffaf3",
                  display: "grid",
                  placeItems: "center",
                  fontSize: Math.max(11, 15 * CIRCLE_SCALE),
                  lineHeight: 1,
                }}
              >
                {face.src ? (
                  <img src={face.src} alt="" width={Math.ceil(avatar)} height={Math.ceil(avatar)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                ) : (
                  face.initials
                )}
              </span>
            ) : null}
          </button>
        );
      })}
      {detailsOpen ? <PollDetails poll={poll} participants={participants} /> : null}
    </div>
  );
}

function idleWidth(scale: number): number {
  return Math.min(IDLE_MAX_WIDTH, BASE.idleWidth * scale);
}

function optionWidth(progress: number, scale: number): number {
  const idle = idleWidth(scale);
  return idle + (EXPANDED_WIDTH - idle) * Math.max(0, progress);
}

function labelWidth(text: string, fontSize: number): number {
  return text.length * 9.4 * (fontSize / LABEL_FONT);
}

function fitLabel(text: string, labelMax: number): { fontSize: number; lineHeight: number; lines: number } {
  const room = Math.max(labelMax, 1);
  if (labelWidth(text, LABEL_FONT) <= room) return { fontSize: LABEL_FONT, lineHeight: LABEL_LINE, lines: 1 };
  for (let fontSize = 15; fontSize >= 12; fontSize -= 1) {
    const lineHeight = Math.max(fontSize + 3, Math.round(fontSize * LABEL_LINE / LABEL_FONT));
    const lines = Math.max(1, Math.ceil(labelWidth(text, fontSize) / room));
    if (lines <= 2) return { fontSize, lineHeight, lines };
  }
  return { fontSize: 12, lineHeight: 16, lines: 2 };
}

function layoutOption(text: string, scale: number, animatedWidth: number): {
  rowWidth: number;
  labelMax: number;
  rowHeight: number;
  fontSize: number;
  lineHeight: number;
  lines: number;
} {
  const chrome = labelChrome(scale);
  const rowWidth = Math.max(0, animatedWidth);
  const labelMax = Math.max(24, rowWidth - chrome);
  const fit = fitLabel(text, labelMax);
  const rowHeight = Math.max(POLL_ROW_HEIGHT, fit.lines * fit.lineHeight + 12);
  return { rowWidth, labelMax, rowHeight, ...fit };
}

function labelChrome(scale: number): number {
  const left = BASE.labelInset * scale;
  const trailing = BASE.indicatorEndInset * scale;
  const ring = BASE.ringDiameter * scale * CIRCLE_SCALE;
  return left + trailing + ring / 2 + 10;
}

function optionButton(width: number, height: number): CSSProperties {
  return {
    position: "relative",
    width,
    height,
    margin: 0,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    flex: "none",
    overflow: "visible",
  };
}

function latestVoter(votes: readonly PollVote[]): PollVote | undefined {
  let best: PollVote | undefined;
  for (const vote of votes) {
    if (!best) {
      best = vote;
      continue;
    }
    const next = vote.atMs ?? Number.NEGATIVE_INFINITY;
    const current = best.atMs ?? Number.NEGATIVE_INFINITY;
    if (next >= current) best = vote;
  }
  return best;
}

function faceFor(
  participantId: string,
  poll: PollPayload,
  participants: readonly DemoParticipant[],
): { src?: string; initials: string } {
  const voter = poll.voters?.find((item) => item.id === participantId);
  const person = participants.find((item) => item.id === participantId);
  const src = voter?.avatar ?? person?.photo;
  const initials = person?.initials || person?.name?.slice(0, 1) || participantId.slice(0, 1);
  return src ? { src, initials } : { initials };
}

function PollDetails({ poll, participants }: { poll: PollPayload; participants: readonly DemoParticipant[] }) {
  const votedIds = new Set((poll.votes ?? []).map((vote) => vote.participantId));
  const waiting = participants.filter((person) => !votedIds.has(person.id));
  return (
    <div data-slot="poll-details" role="dialog" aria-label="Poll Details" style={{ color: "inherit", fontSize: 15, lineHeight: "20px" }}>
      {poll.options.map((option) => {
        const names = (poll.votes ?? [])
          .filter((vote) => vote.optionId === option.id)
          .map((vote) => participants.find((person) => person.id === vote.participantId)?.name ?? vote.participantId);
        return (
          <div key={option.id} data-slot="poll-detail-option" data-option-id={option.id}>
            <div style={{ fontWeight: 600 }}>{option.text}</div>
            <div data-slot="poll-voters">{names.length > 0 ? names.join(", ") : "No votes"}</div>
          </div>
        );
      })}
      <div data-slot="poll-waiting">{waiting.length > 0 ? waiting.map((person) => person.name).join(", ") : "Everyone has voted"}</div>
    </div>
  );
}
