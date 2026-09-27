import type { PollPayload, PollVote } from "@/contracts";

/** Elapsed time from the recorded keys at which the selected width has settled. */
export const POLL_VOTE_SETTLE_MS = 867;

export type PollSelectionMode = "single" | "multiple";

export function clonePoll(poll: PollPayload): PollPayload {
  return {
    question: poll.question,
    options: poll.options.map((option) => ({ id: option.id, text: option.text })),
    ...(poll.selectionMode ? { selectionMode: poll.selectionMode } : {}),
    ...(poll.votes ? { votes: poll.votes.map((vote) => cloneVote(vote)) } : {}),
    ...(poll.voters ? { voters: poll.voters.map((voter) => ({ id: voter.id, avatar: voter.avatar })) } : {}),
  };
}

function cloneVote(vote: PollVote): PollVote {
  return {
    participantId: vote.participantId,
    optionId: vote.optionId,
    ...(vote.atMs !== undefined ? { atMs: vote.atMs } : {}),
  };
}

/**
 * Vote membership is a set. A repeated selection keeps the original timestamp so the
 * transition does not restart. `single` replaces that participant's other option.
 * `multiple` is the default and leaves other selections in place.
 */
export function applyPollVote(
  votes: readonly PollVote[],
  vote: PollVote,
  voted: boolean,
  selectionMode: PollSelectionMode = "multiple",
): PollVote[] {
  if (selectionMode === "single" && voted) {
    const same = votes.find((item) => item.participantId === vote.participantId && item.optionId === vote.optionId);
    const others = votes.some((item) => item.participantId === vote.participantId && item.optionId !== vote.optionId);
    if (same && !others) return votes.slice();
    const rest = votes.filter((item) => item.participantId !== vote.participantId);
    return [...rest, cloneVote(vote)];
  }
  const without = votes.filter((item) => !(item.participantId === vote.participantId && item.optionId === vote.optionId));
  if (!voted) return without;
  if (without.length !== votes.length) return votes.slice();
  return [...without, cloneVote(vote)];
}

/**
 * Elapsed time for one option, or null when it has no vote.
 * An opening vote without `atMs` is already settled.
 */
export function pollOptionElapsed(votes: readonly PollVote[] | undefined, timeMs: number): number | null {
  if (!votes || votes.length === 0) return null;
  let latest: number | undefined;
  for (const vote of votes) {
    if (vote.atMs === undefined) continue;
    if (latest === undefined || vote.atMs >= latest) latest = vote.atMs;
  }
  if (latest === undefined) return 100_000;
  return timeMs - latest;
}
