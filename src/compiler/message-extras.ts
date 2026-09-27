import { POLL_MAX_OPTIONS, type DemoMessage, type PollPayload, type StickerPayload, type SystemMessagePayload } from "@/contracts";
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
const IOS_ONLY_KINDS = new Set(["poll", "facetime", "sticker", "system"]);

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

function readPoll(value: unknown, path: string, issues: ValidationIssue[]): PollPayload | "invalid" | undefined {
  if (!isPlainObject(value)) {
    issues.push(issue(path, "INVALID_TYPE", "poll must be an object"));
    return "invalid";
  }
  if (typeof value.question !== "string" || value.question.length === 0) {
    issues.push(issue(`${path}/question`, "MISSING_FIELD", "poll question is required"));
    return "invalid";
  }
  if (!Array.isArray(value.options) || value.options.length < 1 || value.options.length > POLL_MAX_OPTIONS) {
    issues.push(issue(`${path}/options`, "INVALID_VALUE", `a poll has 1 to ${POLL_MAX_OPTIONS} options`));
    return "invalid";
  }
  const options: PollPayload["options"] = [];
  const ids = new Set<string>();
  let invalid = false;
  value.options.forEach((option, index) => {
    if (!isPlainObject(option) || typeof option.id !== "string" || option.id.length === 0 || typeof option.text !== "string" || option.text.length === 0) {
      issues.push(issue(`${path}/options/${index}`, "INVALID_VALUE", "each poll option needs an id and text"));
      invalid = true;
      return;
    }
    if (ids.has(option.id)) {
      issues.push(issue(`${path}/options/${index}/id`, "DUPLICATE_ID", `duplicate poll option id ${JSON.stringify(option.id)}`));
      invalid = true;
      return;
    }
    ids.add(option.id);
    options.push({ id: option.id, text: option.text });
  });
  const votes: NonNullable<PollPayload["votes"]> = [];
  if (value.votes !== undefined) {
    if (!Array.isArray(value.votes)) {
      issues.push(issue(`${path}/votes`, "INVALID_TYPE", "poll votes must be an array"));
      invalid = true;
    } else {
      value.votes.forEach((vote, index) => {
        if (!isPlainObject(vote) || typeof vote.participantId !== "string" || typeof vote.optionId !== "string" || !ids.has(vote.optionId)) {
          issues.push(issue(`${path}/votes/${index}`, "INVALID_REFERENCE", "a vote must name a participant and an existing option"));
          invalid = true;
          return;
        }
        votes.push({ participantId: vote.participantId, optionId: vote.optionId });
      });
    }
  }
  if (invalid) return "invalid";
  return { question: value.question, options, ...(votes.length > 0 ? { votes } : {}) };
}

export function knownParticipantIds(participants: ReadonlyArray<{ id: string }> | undefined, contactName: string): Set<string> {
  const ids = new Set<string>(["me"]);
  if (participants) for (const person of participants) ids.add(person.id);
  else ids.add("contact");
  if (contactName) ids.add(contactName);
  return ids;
}
