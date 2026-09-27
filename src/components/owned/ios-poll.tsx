"use client";

import type { CSSProperties } from "react";
import { fontStack } from "@/components/imessage/tokens";

/**
 * Repository-owned iOS poll. The upstream registry has no poll component.
 * Vote totals are the number of participants who selected an option. Multiple
 * selections are allowed, so the bars are each option's share of the conversation
 * and are not forced to sum to 100%.
 */

export const POLL_MAX_OPTIONS = 12;

export type PollOption = { id: string; text: string };
export type PollVote = { participantId: string; optionId: string };
export type PollParticipant = { id: string; name: string; initials?: string };

export type PollPayload = {
  question: string;
  options: PollOption[];
  votes?: PollVote[];
};

const card: CSSProperties = {
  width: 280.5,
  borderRadius: 20,
  overflow: "hidden",
  background: "var(--im-gray-top, #e9e9eb)",
  color: "var(--im-incoming-text, #000)",
  fontFamily: fontStack,
};

export function votesFor(optionId: string, votes: readonly PollVote[]): PollVote[] {
  const seen = new Set<string>();
  const matched: PollVote[] = [];
  for (const vote of votes) {
    if (vote.optionId !== optionId || seen.has(vote.participantId)) continue;
    seen.add(vote.participantId);
    matched.push(vote);
  }
  return matched;
}

export function applyPollVote(votes: readonly PollVote[], vote: PollVote, voted: boolean): PollVote[] {
  const without = votes.filter((item) => !(item.participantId === vote.participantId && item.optionId === vote.optionId));
  return voted ? [...without, { participantId: vote.participantId, optionId: vote.optionId }] : without;
}

export function IosPoll({
  question,
  options,
  votes = [],
  participants,
  voterId,
  detailsOpen = false,
  onToggle,
  onAddChoice,
  onOpenDetails,
  onCloseDetails,
}: {
  question: string;
  options: readonly PollOption[];
  votes?: readonly PollVote[];
  participants: readonly PollParticipant[];
  voterId?: string;
  detailsOpen?: boolean;
  onToggle?: (optionId: string, voted: boolean) => void;
  onAddChoice?: () => void;
  onOpenDetails?: () => void;
  onCloseDetails?: () => void;
}) {
  const people = Math.max(participants.length, 1);
  return (
    <div data-slot="poll" style={card}>
      <div style={{ padding: "12px 14px 4px", fontSize: 17, fontWeight: 650, lineHeight: "22px" }}>{question}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "8px 10px 10px" }}>
        {options.map((option) => {
          const chosen = votesFor(option.id, votes);
          const mine = voterId ? chosen.some((vote) => vote.participantId === voterId) : false;
          const share = chosen.length / people;
          return (
            <button
              key={option.id}
              type="button"
              data-slot="poll-option"
              data-option-id={option.id}
              data-votes={chosen.length}
              data-selected={mine ? "true" : "false"}
              aria-pressed={mine}
              onClick={() => onToggle?.(option.id, !mine)}
              style={{
                position: "relative",
                overflow: "hidden",
                textAlign: "left",
                border: 0,
                borderRadius: 12,
                background: "rgba(255,255,255,0.72)",
                color: "inherit",
                font: "inherit",
                minHeight: 36,
                padding: "8px 10px",
                cursor: onToggle ? "pointer" : "default",
              }}
            >
              <span
                aria-hidden="true"
                data-slot="poll-bar"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${Math.round(share * 1000) / 10}%`,
                  background: mine ? "rgba(0,136,255,0.28)" : "rgba(120,120,128,0.16)",
                }}
              />
              <span style={{ position: "relative", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{option.text}</span>
                <span data-slot="poll-count">{chosen.length}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 12px 12px", fontSize: 15 }}>
        {onAddChoice && options.length < POLL_MAX_OPTIONS ? (
          <button type="button" data-slot="poll-add" onClick={onAddChoice} style={textButton}>
            Add Choice
          </button>
        ) : <span />}
        <button type="button" data-slot="poll-details-open" onClick={onOpenDetails} style={textButton}>
          Details
        </button>
      </div>
      {detailsOpen ? (
        <IosPollDetails
          options={options}
          votes={votes}
          participants={participants}
          onClose={onCloseDetails}
        />
      ) : null}
    </div>
  );
}

const textButton: CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#0088ff",
  font: "inherit",
  fontWeight: 600,
  padding: 0,
  cursor: "pointer",
};

export function IosPollDetails({
  options,
  votes,
  participants,
  onClose,
}: {
  options: readonly PollOption[];
  votes: readonly PollVote[];
  participants: readonly PollParticipant[];
  onClose?: () => void;
}) {
  const votedIds = new Set(votes.map((vote) => vote.participantId));
  const waiting = participants.filter((person) => !votedIds.has(person.id));
  return (
    <div data-slot="poll-details" role="dialog" aria-label="Poll Details" style={{ borderTop: "1px solid rgba(60,60,67,0.18)", padding: "10px 14px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Poll Details</strong>
        <button type="button" data-slot="poll-details-close" onClick={onClose} style={textButton}>Close</button>
      </div>
      {options.map((option) => {
        const chosen = votesFor(option.id, votes);
        const names = chosen.map((vote) => participants.find((person) => person.id === vote.participantId)?.name ?? vote.participantId);
        return (
          <div key={option.id} data-slot="poll-detail-option" data-option-id={option.id} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{option.text}</div>
            <div data-slot="poll-voters">{names.length > 0 ? names.join(", ") : "No votes"}</div>
          </div>
        );
      })}
      <div data-slot="poll-waiting">
        <div style={{ fontWeight: 600 }}>Haven’t voted</div>
        <div>{waiting.length > 0 ? waiting.map((person) => person.name).join(", ") : "Everyone has voted"}</div>
      </div>
    </div>
  );
}
