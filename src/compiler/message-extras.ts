import { videoPayloadSchema, POLL_MAX_OPTIONS, type DemoMessage, type PollPayload, type StickerPayload, type SystemMessagePayload } from "@/contracts";
import { issue, isPlainObject } from "./issues";
import type { ValidationIssue } from "@/contracts";

const SYSTEM_TYPES = new Set([
  "unknownSender",
  "conversationNamed",
  "conversationNameRemoved",
  "participantAdded",
  "participantRemoved",
  "participantLeft",
  "groupPhotoChanged",
  "groupPhotoRemoved",
  "backgroundChanged",
  "backgroundRemoved",
  "messageUnsent",
  "messageKept",
  "phoneNumberChanged",
  "addFailed",
  "removeFailed",
]);

const FACETIME = new Set(["invitation", "ringing", "connected", "ended", "missed"]);
const IOS_ONLY_KINDS = new Set(["poll", "facetime", "sticker", "system", "video"]);

export function rejectIosOnlyKind(kind: string | undefined, platform: string | undefined, path: string, issues: ValidationIssue[]): void {
  if (platform === "macos" && kind && IOS_ONLY_KINDS.has(kind)) {
    issues.push(issue(path, "PLATFORM_MISMATCH", `${kind} is an iOS message and is not a macOS target`));
  }
}

function readSticker(value: unknown, path: string, issues: ValidationIssue[]): StickerPayload | "invalid" | undefined {
  if (!isPlainObject(value)) {
    issues.push(issue(path, "INVALID_TYPE", "sticker must be an object"));
    return "invalid";
  }
  if (typeof value.id !== "string" || value.id.length === 0 || typeof value.glyph !== "string" || value.glyph.length === 0 || typeof value.label !== "string" || value.label.length === 0) {
    issues.push(issue(path, "INVALID_VALUE", "sticker requires id, glyph, and label"));
    return "invalid";
  }
  const sticker: StickerPayload = { id: value.id, glyph: value.glyph, label: value.label };
  if (value.rotation !== undefined) {
    if (typeof value.rotation !== "number" || !Number.isFinite(value.rotation)) {
      issues.push(issue(`${path}/rotation`, "INVALID_VALUE", "sticker rotation must be a number"));
      return "invalid";
    }
    sticker.rotation = value.rotation;
  }
  return sticker;
}

export function readMessageExtras(
  value: Record<string, unknown>,
  base: string,
  kind: DemoMessage["kind"] | undefined,
  platform: string | undefined,
  issues: ValidationIssue[],
): Partial<DemoMessage> | "invalid" {
  rejectIosOnlyKind(kind, platform, `${base}/kind`, issues);
  const extras: Partial<DemoMessage> = {};
  let invalid = false;
  const assignString = (key: "sender" | "senderId" | "senderInitials" | "senderPhoto" | "conversationId") => {
    if (!Object.hasOwn(value, key)) return;
    if (typeof value[key] !== "string" || value[key].length === 0) {
      issues.push(issue(`${base}/${key}`, "INVALID_TYPE", `${key} must be a non-empty string`));
      invalid = true;
      return;
    }
    extras[key] = value[key];
  };
  assignString("sender");
  assignString("senderId");
  assignString("senderInitials");
  assignString("senderPhoto");
  assignString("conversationId");

  if (Object.hasOwn(value, "system")) {
    if (kind !== "system") {
      issues.push(issue(`${base}/system`, "INVALID_VALUE", "system is only valid on kind \"system\""));
      invalid = true;
    } else if (!isPlainObject(value.system) || typeof value.system.type !== "string" || !SYSTEM_TYPES.has(value.system.type)) {
      issues.push(issue(`${base}/system`, "INVALID_VALUE", "system must be a supported SystemMessage event"));
      invalid = true;
    } else {
      extras.system = value.system as SystemMessagePayload;
    }
  } else if (kind === "system") {
    issues.push(issue(`${base}/system`, "MISSING_FIELD", "system messages require a system event"));
    invalid = true;
  }

  if (Object.hasOwn(value, "facetime")) {
    const state = isPlainObject(value.facetime) ? value.facetime.state : undefined;
    if (kind !== "facetime" || typeof state !== "string" || !FACETIME.has(state)) {
      issues.push(issue(`${base}/facetime`, "INVALID_VALUE", "facetime requires kind \"facetime\" and a supported state"));
      invalid = true;
    } else {
      const duration = isPlainObject(value.facetime) && typeof value.facetime.duration === "string" ? value.facetime.duration : undefined;
      extras.facetime = { state: state as NonNullable<DemoMessage["facetime"]>["state"], ...(duration ? { duration } : {}) };
    }
  } else if (kind === "facetime") {
    issues.push(issue(`${base}/facetime`, "MISSING_FIELD", "facetime messages require a facetime payload"));
    invalid = true;
  }

  if (Object.hasOwn(value, "sticker")) {
    const sticker = readSticker(value.sticker, `${base}/sticker`, issues);
    if (sticker === "invalid" || kind !== "sticker") {
      if (kind !== "sticker") issues.push(issue(`${base}/sticker`, "INVALID_VALUE", "sticker payload requires kind \"sticker\""));
      invalid = true;
    } else if (sticker) extras.sticker = sticker;
  } else if (kind === "sticker") {
    issues.push(issue(`${base}/sticker`, "MISSING_FIELD", "sticker messages require a sticker payload"));
    invalid = true;
  }

  if (Object.hasOwn(value, "stickers")) {
    if (!Array.isArray(value.stickers)) {
      issues.push(issue(`${base}/stickers`, "INVALID_TYPE", "stickers must be an array"));
      invalid = true;
    } else {
      const stickers: StickerPayload[] = [];
      value.stickers.forEach((item, index) => {
        const sticker = readSticker(item, `${base}/stickers/${index}`, issues);
        if (sticker === "invalid" || !sticker) invalid = true;
        else stickers.push(sticker);
      });
      if (!invalid) extras.stickers = stickers;
    }
  }

  if (Object.hasOwn(value, "video") || kind === "video") {
    const parsed = videoPayloadSchema.safeParse(value.video);
    if (kind !== "video" || !parsed.success) {
      issues.push(issue(`${base}/video`, "INVALID_VALUE", 'video messages require video { src, poster?, width?, height? } and kind "video"'));
      invalid = true;
    } else {
      const local = (src: string, extensions: string) => new RegExp(`^/demo-assets/(?:[a-z0-9_-]+/)*[a-z0-9._-]+\\.(${extensions})$`, "i").test(src) && !src.includes("..");
      if (!local(parsed.data.src, "mp4|webm") || (parsed.data.poster !== undefined && !local(parsed.data.poster, "png|jpe?g|gif|webp"))) {
        issues.push(issue(`${base}/video`, "INVALID_ASSET", "video and poster must be local supported files under /demo-assets/"));
        invalid = true;
      } else extras.video = parsed.data;
    }
  }

  if (Object.hasOwn(value, "poll") || kind === "poll") {
    const poll = readPoll(value.poll, `${base}/poll`, issues);
    if (kind !== "poll") {
      issues.push(issue(`${base}/poll`, "INVALID_VALUE", "poll payload requires kind \"poll\""));
      invalid = true;
    } else if (poll === "invalid" || !poll) invalid = true;
    else extras.poll = poll;
  }

  if (Object.hasOwn(value, "audio") && isPlainObject(value.audio) && Object.hasOwn(value.audio, "src")) {
    if (typeof value.audio.src !== "string" || !isLocalAudio(value.audio.src)) {
      issues.push(issue(`${base}/audio/src`, "INVALID_ASSET", "audio src must be a local demo asset with an audio extension"));
      invalid = true;
    }
  }

  return invalid ? "invalid" : extras;
}

function isLocalAudio(src: string): boolean {
  return /^\/demo-assets\/[a-z0-9._-]+\.(m4a|mp3|wav|aac|caf)$/i.test(src) && !src.includes("..");
}

const LOCAL_AVATAR = /^\/demo-assets\/[a-z0-9._-]+\.(png|jpe?g|gif|webp)$/i;

function readPoll(value: unknown, path: string, issues: ValidationIssue[]): PollPayload | "invalid" | undefined {
  if (!isPlainObject(value)) {
    issues.push(issue(path, "INVALID_TYPE", "poll must be an object"));
    return "invalid";
  }
  let invalid = false;
  let question = "";
  if (value.question !== undefined && typeof value.question !== "string") {
    issues.push(issue(`${path}/question`, "INVALID_TYPE", "poll question must be a string"));
    invalid = true;
  } else if (typeof value.question === "string") question = value.question;
  let selectionMode: PollPayload["selectionMode"];
  if (value.selectionMode !== undefined) {
    if (value.selectionMode !== "single" && value.selectionMode !== "multiple") {
      issues.push(issue(`${path}/selectionMode`, "INVALID_VALUE", "poll selectionMode must be single or multiple"));
      invalid = true;
    } else selectionMode = value.selectionMode;
  }
  if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > POLL_MAX_OPTIONS) {
    issues.push(issue(`${path}/options`, "INVALID_VALUE", `a poll has 1 to ${POLL_MAX_OPTIONS} options`));
    return "invalid";
  }
  const options: PollPayload["options"] = [];
  const ids = new Set<string>();
  value.options.forEach((option, index) => {
    const text = isPlainObject(option) ? optionText(option) : undefined;
    if (!isPlainObject(option) || typeof option.id !== "string" || option.id.length === 0 || !text) {
      issues.push(issue(`${path}/options/${index}`, "INVALID_VALUE", "each poll option needs an id and text"));
      invalid = true;
      return;
    }
    if (isPlainObject(option) && typeof option.text === "string" && typeof option.label === "string" && option.text !== option.label) {
      issues.push(issue(`${path}/options/${index}`, "INVALID_VALUE", "poll option text and label must match when both are set"));
      invalid = true;
      return;
    }
    if (ids.has(option.id)) {
      issues.push(issue(`${path}/options/${index}/id`, "DUPLICATE_ID", `duplicate poll option id ${JSON.stringify(option.id)}`));
      invalid = true;
      return;
    }
    ids.add(option.id);
    options.push({ id: option.id, text });
  });
  const voters: NonNullable<PollPayload["voters"]> = [];
  const voterIds = new Set<string>();
  if (value.voters !== undefined) {
    if (!Array.isArray(value.voters)) {
      issues.push(issue(`${path}/voters`, "INVALID_TYPE", "poll voters must be an array"));
      invalid = true;
    } else {
      value.voters.forEach((voter, index) => {
        if (!isPlainObject(voter) || typeof voter.id !== "string" || voter.id.length === 0) {
          issues.push(issue(`${path}/voters/${index}`, "INVALID_VALUE", "each poll voter needs an id"));
          invalid = true;
          return;
        }
        if (typeof voter.avatar !== "string" || !LOCAL_AVATAR.test(voter.avatar) || voter.avatar.includes("..")) {
          issues.push(issue(`${path}/voters/${index}/avatar`, "INVALID_ASSET", "poll voter avatar must be a local image under /demo-assets/"));
          invalid = true;
          return;
        }
        if (voterIds.has(voter.id)) {
          issues.push(issue(`${path}/voters/${index}/id`, "DUPLICATE_ID", `duplicate poll voter id ${JSON.stringify(voter.id)}`));
          invalid = true;
          return;
        }
        voterIds.add(voter.id);
        voters.push({ id: voter.id, avatar: voter.avatar });
      });
    }
  }
  if (value.votes !== undefined && value.initialVotes !== undefined) {
    issues.push(issue(`${path}/initialVotes`, "INVALID_VALUE", "use votes or initialVotes, not both"));
    invalid = true;
  }
  const rawVotes = value.votes ?? value.initialVotes;
  const votes: NonNullable<PollPayload["votes"]> = [];
  if (rawVotes !== undefined) {
    const votePath = value.votes !== undefined ? "votes" : "initialVotes";
    if (!Array.isArray(rawVotes)) {
      issues.push(issue(`${path}/${votePath}`, "INVALID_TYPE", "poll votes must be an array"));
      invalid = true;
    } else {
      rawVotes.forEach((vote, index) => {
        const participantId = isPlainObject(vote) ? voteParticipant(vote) : undefined;
        if (!isPlainObject(vote) || !participantId || typeof vote.optionId !== "string" || !ids.has(vote.optionId)) {
          issues.push(issue(`${path}/${votePath}/${index}`, "INVALID_REFERENCE", "a vote must name a voter and an existing option"));
          invalid = true;
          return;
        }
        if (voterIds.size > 0 && !voterIds.has(participantId)) {
          issues.push(issue(`${path}/${votePath}/${index}/participantId`, "INVALID_REFERENCE", `vote names unknown voter ${JSON.stringify(participantId)}`));
          invalid = true;
          return;
        }
        votes.push({ participantId, optionId: vote.optionId });
      });
    }
  }
  if (invalid) return "invalid";
  return {
    question,
    options,
    ...(selectionMode ? { selectionMode } : {}),
    ...(votes.length > 0 ? { votes } : {}),
    ...(voters.length > 0 ? { voters } : {}),
  };
}

function optionText(option: Record<string, unknown>): string | undefined {
  if (typeof option.text === "string" && option.text.length > 0) return option.text;
  if (typeof option.label === "string" && option.label.length > 0) return option.label;
  return undefined;
}

function voteParticipant(vote: Record<string, unknown>): string | undefined {
  if (typeof vote.participantId === "string" && vote.participantId.length > 0) return vote.participantId;
  if (typeof vote.voterId === "string" && vote.voterId.length > 0) return vote.voterId;
  return undefined;
}

export function knownParticipantIds(participants: ReadonlyArray<{ id: string }> | undefined, contactName: string): Set<string> {
  const ids = new Set<string>(["me"]);
  if (participants) for (const person of participants) ids.add(person.id);
  else ids.add("contact");
  if (contactName) ids.add(contactName);
  return ids;
}
