import type {
  BubbleEffectName,
  DemoFlow,
  DemoMessage,
  DemoPlatform,
  DemoTheme,
  Direction,
  IosScreenName,
  MessageKind,
  MessageStatus,
  Service,
  ValidationIssue,
  ValidationResult,
} from "@/contracts";
import capabilities from "@/contracts/capabilities.json";
import { isPlainObject, issue, pointer } from "./issues";
import { arrivalWindow, bubbleEffectDurationMs } from "./motion";

const MESSAGE_KINDS = new Set<MessageKind>(["text", "link", "attachment", "image", "audio"]);
const DIRECTIONS = new Set<Direction>(["incoming", "outgoing"]);
const SERVICES = new Set<Service>(["imessage", "sms"]);
const STATUSES = new Set<MessageStatus>(["sending", "sent", "delivered", "read", "failed"]);
const PLATFORMS = new Set<DemoPlatform>(["ios", "macos"]);
const THEMES = new Set<DemoTheme>(["light", "dark"]);
const SCREENS = new Set<IosScreenName>(["list", "conversation", "new-message"]);
const EFFECTS = new Set<BubbleEffectName>(["slam", "loud", "gentle", "invisible-ink"]);
const IOS_ONLY_SCREENS = new Set<IosScreenName>(["list", "new-message"]);

const ROOT_FIELDS = new Set([
  "id",
  "title",
  "platform",
  "theme",
  "contact",
  "nowMs",
  "draft",
  "typing",
  "screen",
  "messages",
]);

const MESSAGE_FIELDS = new Set([
  "id",
  "text",
  "direction",
  "atMs",
  "kind",
  "service",
  "status",
  "effect",
  "link",
  "attachments",
  "images",
  "audio",
  "replyTo",
  "reactions",
  "edited",
  "readAt",
  "sentAt",
  "removed",
  "replyCount",
  "platforms",
]);

const unsupportedReason = new Map(capabilities.unsupported.map((entry) => [entry.id, entry.reason]));
const catalogueReason = new Map(capabilities.catalogueOnly.map((entry) => [entry.id, entry.reason]));

const unsupportedKinds = new Map<string, string>([
  ["poll", "polls"],
  ["polls", "polls"],
  ["mini-app", "mini-apps"],
  ["mini-apps", "mini-apps"],
  ["miniapp", "mini-apps"],
  ["photon", "mini-apps"],
  ["photon-mini-app", "mini-apps"],
]);

const catalogueKinds = new Map<string, string>([
  ["system", "system-message"],
  ["system-message", "system-message"],
  ["facetime", "facetime-card"],
  ["face-time", "facetime-card"],
  ["facetime-card", "facetime-card"],
  ["screen-effect", "screen-effect"],
  ["image-viewer", "image-viewer"],
  ["effects-picker", "effects-picker"],
  ["long-press", "long-press"],
  ["ios-list", "ios-list"],
  ["mac-context-menu", "mac-context-menu"],
  ["mac-plus-menu", "mac-plus-menu"],
]);

type ReplyRef = {
  id: string;
  conversationId?: string;
  text?: string;
  direction?: string;
};

type MessageMeta = {
  index: number;
  id?: string;
  text: string;
  direction?: Direction;
  kind?: MessageKind;
  effect?: BubbleEffectName;
  atMs?: number;
  reply: ReplyRef | null;
  removed?: boolean;
  edited?: boolean;
  hasReactions: boolean;
  reactionTargets: string[];
  readAt?: "valid" | "invalid";
  sentAt?: "valid" | "invalid";
  kindBlocked: boolean;
};

export function validateDemo(input: unknown): ValidationResult {
  if (!isPlainObject(input)) {
    return { ok: false, issues: [issue("/", "INVALID_TYPE", "demo must be a JSON object")] };
  }
  if (Object.hasOwn(input, "steps") && !Object.hasOwn(input, "messages")) {
    return { ok: false, issues: stepsOnlyIssues(input) };
  }

  const { issues, demo } = validateFlow(input);
  if (Object.hasOwn(input, "steps")) {
    issues.push(...stepComponentIssues(input.steps));
  }
  if (issues.length > 0 || !demo) return { ok: false, issues };
  return { ok: true, demo };
}

function stepsOnlyIssues(input: Record<string, unknown>): ValidationIssue[] {
  const inspected = stepComponentIssues(input.steps);
  if (inspected.length > 0) return inspected;
  return [
    issue(
      "/steps",
      "CONTRACT_GAP",
      "the frozen DemoFlow has no steps timeline, so this document cannot compile",
    ),
  ];
}

function stepComponentIssues(steps: unknown): ValidationIssue[] {
  if (!Array.isArray(steps)) {
    return [issue("/steps", "INVALID_TYPE", "steps must be an array")];
  }
  const issues: ValidationIssue[] = [];
  steps.forEach((step, index) => {
    if (!isPlainObject(step) || !isPlainObject(step.message) || !Object.hasOwn(step.message, "kind")) return;
    const stepId = typeof step.id === "string" && step.id.length > 0 ? step.id : undefined;
    classifyKind(step.message.kind, pointer(["steps", index, "message", "kind"]), issues, stepId ? `stepId=${stepId}` : undefined);
  });
  return issues;
}

function classifyKind(kind: unknown, path: string, issues: ValidationIssue[], note?: string): boolean {
  const suffix = note ? ` (${note})` : "";
  if (typeof kind !== "string") {
    issues.push(issue(path, "INVALID_TYPE", `kind must be a string${suffix}`));
    return true;
  }
  const unsupported = unsupportedKinds.get(kind);
  if (unsupported) {
    const reason = unsupportedReason.get(unsupported) ?? `${unsupported} is not a pinned component`;
    issues.push(issue(path, "UNSUPPORTED_COMPONENT", `${reason}${suffix}`));
    return true;
  }
  const catalogue = catalogueKinds.get(kind);
  if (catalogue) {
    const reason = catalogueReason.get(catalogue) ?? `${catalogue} is catalogue-only`;
    issues.push(issue(path, "CATALOGUE_ONLY", `${reason}${suffix}`));
    return true;
  }
  if (kind === "typing") {
    issues.push(
      issue(
        path,
        "INVALID_VALUE",
        `typing is the conversation flag, not a message kind${suffix}`,
      ),
    );
    return true;
  }
  if (!MESSAGE_KINDS.has(kind as MessageKind)) {
    issues.push(issue(path, "INVALID_VALUE", `unknown message kind ${JSON.stringify(kind)}${suffix}`));
    return true;
  }
  return false;
}

function validateFlow(input: Record<string, unknown>): { issues: ValidationIssue[]; demo?: DemoFlow } {
  const issues: ValidationIssue[] = [];
  const id = readBoundedString(input, "id", pointer(["id"]), issues, false);
  const title = readBoundedString(input, "title", pointer(["title"]), issues, false);
  const platform = readEnum(input, "platform", pointer(["platform"]), issues, PLATFORMS);
  const theme = readEnum(input, "theme", pointer(["theme"]), issues, THEMES);
  const contact = readContact(input.contact, Object.hasOwn(input, "contact"), issues);
  const nowMs = readMillis(input, "nowMs", pointer(["nowMs"]), issues, true);
  const draft = readDraft(input, issues);
  const typing = readBoolean(input, "typing", pointer(["typing"]), issues, true);
  const screen = readEnum(input, "screen", pointer(["screen"]), issues, SCREENS);

  if (platform === "macos" && screen && IOS_ONLY_SCREENS.has(screen)) {
    issues.push(
      issue(
        pointer(["screen"]),
        "PLATFORM_MISMATCH",
        `${screen} is an iOS shell screen and is not a macOS target`,
      ),
    );
  }

  const messages = readMessages(input, issues, typeof id === "string" ? id : undefined, platform);

  for (const key of Object.keys(input)) {
    if (ROOT_FIELDS.has(key)) continue;
    issues.push(issue(pointer([key]), "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
  }

  if (
    issues.length > 0 ||
    id === undefined ||
    title === undefined ||
    platform === undefined ||
    theme === undefined ||
    contact === undefined ||
    nowMs === undefined ||
    draft === undefined ||
    typing === undefined ||
    screen === undefined ||
    messages === undefined
  ) {
    return { issues };
  }

  return {
    issues,
    demo: { id, title, platform, theme, contact, nowMs, draft, typing, screen, messages },
  };
}

function readMessages(
  input: Record<string, unknown>,
  issues: ValidationIssue[],
  flowId: string | undefined,
  flowPlatform: DemoPlatform | undefined,
): DemoMessage[] | undefined {
  if (!Object.hasOwn(input, "messages")) {
    issues.push(issue(pointer(["messages"]), "MISSING_FIELD", "missing messages"));
    return undefined;
  }
  if (!Array.isArray(input.messages)) {
    issues.push(issue(pointer(["messages"]), "INVALID_TYPE", "messages must be an array"));
    return undefined;
  }

  const metas: MessageMeta[] = [];
  const normalized: DemoMessage[] = [];
  const seen = new Map<string, number>();
  let previousAt: number | undefined;
  let messagesValid = true;

  input.messages.forEach((value, index) => {
    const base = pointer(["messages", index]);
    if (!isPlainObject(value)) {
      messagesValid = false;
      issues.push(issue(base, "INVALID_TYPE", "message must be an object"));
      return;
    }
    const before = issues.length;
    const meta = readMessage(value, index, base, issues, seen, previousAt, flowPlatform);
    metas.push(meta);
    if (meta.atMs !== undefined) previousAt = meta.atMs;
    if (issues.length !== before) messagesValid = false;
    else if (meta.normalized) normalized.push(meta.normalized);
  });

  semanticPass(metas, flowId, issues);
  if (issues.length > 0) messagesValid = false;
  return messagesValid ? normalized : undefined;
}

type ReadMessage = MessageMeta & { normalized?: DemoMessage };

function readMessage(
  value: Record<string, unknown>,
  index: number,
  base: string,
  issues: ValidationIssue[],
  seen: Map<string, number>,
  previousAt: number | undefined,
  flowPlatform: DemoPlatform | undefined,
): ReadMessage {
  const id = readBoundedString(value, "id", `${base}/id`, issues, false);
  if (id !== undefined) {
    const first = seen.get(id);
    if (first !== undefined) {
      issues.push(issue(`${base}/id`, "DUPLICATE_ID", `duplicate message id ${JSON.stringify(id)} also appears at sourceIndex ${first}`));
    } else {
      seen.set(id, index);
    }
  }
  const text = readText(value, `${base}/text`, issues);
  const direction = readEnum(value, "direction", `${base}/direction`, issues, DIRECTIONS);
  const atMs = readMillis(value, "atMs", `${base}/atMs`, issues, true);
  if (atMs !== undefined && previousAt !== undefined && atMs < previousAt) {
    issues.push(
      issue(
        `${base}/atMs`,
        "INVALID_TIMESTAMP",
        `atMs ${atMs} is earlier than sourceIndex ${index - 1} at ${previousAt}; authored times must be nondecreasing`,
      ),
    );
  }

  let kind: MessageKind | undefined;
  let kindBlocked = false;
  if (Object.hasOwn(value, "kind")) {
    kindBlocked = classifyKind(value.kind, `${base}/kind`, issues, id ? `id=${id}` : undefined);
    if (!kindBlocked && typeof value.kind === "string") kind = value.kind as MessageKind;
  }

  const service = readOptionalEnum(value, "service", `${base}/service`, issues, SERVICES);
  const status = readOptionalEnum(value, "status", `${base}/status`, issues, STATUSES);
  const effect = readEffect(value, base, issues, kind, kindBlocked, direction);

  const effectiveKind = kind ?? "text";
  const link = readOwnedPayload(value, "link", !kindBlocked && effectiveKind === "link", kindBlocked, () =>
    readLink(value, base, issues, !kindBlocked && effectiveKind === "link"),
  );
  const attachments = readOwnedPayload(value, "attachments", !kindBlocked && effectiveKind === "attachment", kindBlocked, () =>
    readAttachments(value, base, issues, !kindBlocked && effectiveKind === "attachment"),
  );
  const images = readOwnedPayload(value, "images", !kindBlocked && effectiveKind === "image", kindBlocked, () =>
    readImages(value, base, issues, !kindBlocked && effectiveKind === "image"),
  );
  const audio = readOwnedPayload(value, "audio", !kindBlocked && effectiveKind === "audio", kindBlocked, () =>
    readAudio(value, base, issues, !kindBlocked && effectiveKind === "audio"),
  );

  if (!kindBlocked) {
    rejectForeignPayload(value, base, effectiveKind, issues);
  }

  const reply = readReply(value, base, issues);
  const reactions = readReactions(value, base, issues);
  const edited = readEdited(value, base, issues);
  const removed = readRemoved(value, base, issues);
  const readAt = readOptionalMillis(value, "readAt", `${base}/readAt`, issues);
  const sentAt = readOptionalMillis(value, "sentAt", `${base}/sentAt`, issues);
  readReplyCount(value, base, issues);
  readPlatforms(value, base, issues, flowPlatform);

  for (const key of Object.keys(value)) {
    if (MESSAGE_FIELDS.has(key)) continue;
    issues.push(issue(`${base}/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
  }

  const meta: ReadMessage = {
    index,
    id,
    text: text ?? "",
    direction,
    kind,
    effect,
    atMs,
    reply,
    removed,
    edited,
    hasReactions: reactions.present,
    reactionTargets: reactions.targets,
    readAt: readAt === "absent" ? undefined : readAt,
    sentAt: sentAt === "absent" ? undefined : sentAt,
    kindBlocked,
  };

  if (
    id !== undefined &&
    text !== undefined &&
    direction !== undefined &&
    atMs !== undefined &&
    link !== "invalid" &&
    attachments !== "invalid" &&
    images !== "invalid" &&
    audio !== "invalid"
  ) {
    const normalized: DemoMessage = { id, text, direction, atMs };
    if (kind !== undefined) normalized.kind = kind;
    if (service !== undefined) normalized.service = service;
    if (status !== undefined) normalized.status = status;
    if (effect !== undefined) normalized.effect = effect;
    if (link) normalized.link = link;
    if (attachments) normalized.attachments = attachments;
    if (images) normalized.images = images;
    if (audio) normalized.audio = audio;
    meta.normalized = normalized;
  }
  return meta;
}

function rejectForeignPayload(
  value: Record<string, unknown>,
  base: string,
  kind: MessageKind,
  issues: ValidationIssue[],
): void {
  const allowed = new Set(
    kind === "link"
      ? ["link"]
      : kind === "attachment"
        ? ["attachments"]
        : kind === "image"
          ? ["images"]
          : kind === "audio"
            ? ["audio"]
            : [],
  );
  for (const field of ["link", "attachments", "images", "audio"] as const) {
    if (!Object.hasOwn(value, field) || allowed.has(field)) continue;
    issues.push(
      issue(
        `${base}/${field}`,
        "INVALID_VALUE",
        `${field} is not a payload of kind ${JSON.stringify(kind === "text" && !Object.hasOwn(value, "kind") ? "text" : kind)}`,
      ),
    );
  }
}

function semanticPass(messages: MessageMeta[], flowId: string | undefined, issues: ValidationIssue[]): void {
  const byId = new Map<string, MessageMeta>();
  for (const message of messages) {
    if (message.id && !byId.has(message.id)) byId.set(message.id, message);
  }

  const windows: Array<{ message: MessageMeta; window: NonNullable<ReturnType<typeof arrivalWindow>> }> = [];

  for (const message of messages) {
    const base = pointer(["messages", message.index]);
    const idNote = message.id ? ` (id=${message.id})` : "";

    if (message.removed === true && (message.edited === true || message.hasReactions)) {
      issues.push(
        issue(
          `${base}/removed`,
          "INVALID_REFERENCE",
          `removed message cannot be edited or reacted to${idNote}`,
        ),
      );
    }

    if (message.reply) {
      const target = byId.get(message.reply.id);
      const targetIndex = target?.index;
      const forward = !target || targetIndex === undefined || targetIndex >= message.index;
      if (message.reply.conversationId !== undefined && flowId !== undefined && message.reply.conversationId !== flowId) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "INVALID_REFERENCE",
            `reply crosses conversations ${JSON.stringify(message.reply.conversationId)} and ${JSON.stringify(flowId)}${idNote}`,
          ),
        );
      } else if (forward) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "INVALID_REFERENCE",
            `reply target ${JSON.stringify(message.reply.id)} is not an earlier message in this conversation${idNote}`,
          ),
        );
      } else if (target?.removed === true) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "INVALID_REFERENCE",
            `reply target ${JSON.stringify(message.reply.id)} is removed${idNote}`,
          ),
        );
      } else if (
        message.reply.text !== undefined &&
        target &&
        target.edited !== true &&
        message.reply.text !== target.text
      ) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "INVALID_VALUE",
            `reply quote does not match the target text at creation${idNote}`,
          ),
        );
      } else if (
        message.reply.direction !== undefined &&
        target?.direction !== undefined &&
        message.reply.direction !== target.direction
      ) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "INVALID_VALUE",
            `reply quote direction does not match the target${idNote}`,
          ),
        );
      } else if (target) {
        issues.push(
          issue(
            `${base}/replyTo`,
            "CONTRACT_GAP",
            `reply quote snapshots are not representable on the frozen DemoMessage${idNote}`,
          ),
        );
      }
    }

    let reactionRefsOk = true;
    for (const targetId of message.reactionTargets) {
      const target = byId.get(targetId);
      if (!target || target.removed === true || target.index >= message.index) {
        reactionRefsOk = false;
        issues.push(
          issue(
            `${base}/reactions`,
            "INVALID_REFERENCE",
            `reaction target ${JSON.stringify(targetId)} is not an earlier live message${idNote}`,
          ),
        );
      }
    }
    if (message.hasReactions && message.removed !== true && reactionRefsOk) {
      issues.push(
        issue(
          `${base}/reactions`,
          "CONTRACT_GAP",
          `reactions are not representable on the frozen DemoMessage${idNote}`,
        ),
      );
    }

    if (message.edited === true && message.removed !== true) {
      const kind = message.kind ?? "text";
      if (message.direction !== "outgoing" || kind !== "text" || message.kindBlocked) {
        issues.push(
          issue(
            `${base}/edited`,
            "INVALID_VALUE",
            `edit target must be outgoing text${idNote}`,
          ),
        );
      } else {
        issues.push(
          issue(
            `${base}/edited`,
            "CONTRACT_GAP",
            `edited is not representable on the frozen DemoMessage${idNote}`,
          ),
        );
      }
    } else if (message.edited === false) {
      issues.push(
        issue(
          `${base}/edited`,
          "CONTRACT_GAP",
          `edited is not representable on the frozen DemoMessage${idNote}`,
        ),
      );
    }

    if (message.removed === true) {
      const liveReplies = messages.filter(
        (other) => other.reply?.id === message.id && other.removed !== true && other.index !== message.index,
      );
      if (liveReplies.length > 0) {
        const ids = liveReplies.map((other) => other.id ?? String(other.index)).join(", ");
        issues.push(
          issue(
            `${base}/removed`,
            "INVALID_REFERENCE",
            `cannot remove ${JSON.stringify(message.id)} while live replies remain: ${ids}`,
          ),
        );
      } else if (message.edited !== true && !message.hasReactions) {
        issues.push(
          issue(
            `${base}/removed`,
            "CONTRACT_GAP",
            `removals are not representable on the frozen DemoMessage${idNote}`,
          ),
        );
      }
    } else if (message.removed === false) {
      issues.push(
        issue(
          `${base}/removed`,
          "CONTRACT_GAP",
          `removals are not representable on the frozen DemoMessage${idNote}`,
        ),
      );
    }

    if (message.readAt === "valid") {
      issues.push(issue(`${base}/readAt`, "CONTRACT_GAP", `readAt is not representable on the frozen DemoMessage${idNote}`));
    }
    if (message.sentAt === "valid") {
      issues.push(issue(`${base}/sentAt`, "CONTRACT_GAP", `sentAt is not representable on the frozen DemoMessage${idNote}`));
    }

    if (
      message.atMs === undefined ||
      message.direction === undefined ||
      message.kindBlocked ||
      (message.kind !== undefined && message.kind !== "text") ||
      message.effect === "invisible-ink"
    ) {
      continue;
    }
    const window = arrivalWindow({
      atMs: message.atMs,
      direction: message.direction,
      effect: message.effect,
      kind: message.kind,
    });
    if (!window) continue;
    for (const earlier of windows) {
      if (window.start < earlier.window.end && earlier.window.start < window.end) {
        issues.push(
          issue(
            `${base}/atMs`,
            "OVERLAPPING_ARRIVAL",
            `message ${JSON.stringify(message.id)} at sourceIndex ${message.index} arrives during the ${earlier.window.label} of ${JSON.stringify(earlier.message.id)} (${earlier.window.durationMs}ms) and would cancel it`,
          ),
        );
      }
    }
    windows.push({ message, window });
  }
}

function readOwnedPayload<T>(
  value: Record<string, unknown>,
  field: string,
  allowed: boolean,
  kindBlocked: boolean,
  read: () => T,
): T | undefined {
  if (kindBlocked) return undefined;
  if (!allowed && Object.hasOwn(value, field)) return undefined;
  return read();
}

function readReply(value: Record<string, unknown>, base: string, issues: ValidationIssue[]): ReplyRef | null {
  if (!Object.hasOwn(value, "replyTo")) return null;
  const reply = value.replyTo;
  if (typeof reply === "string" && reply.length > 0) return { id: reply };
  if (!isPlainObject(reply)) {
    issues.push(issue(`${base}/replyTo`, "INVALID_TYPE", "replyTo must be an id or a quote snapshot"));
    return null;
  }
  if (typeof reply.id !== "string" || reply.id.length === 0) {
    issues.push(issue(`${base}/replyTo/id`, "INVALID_VALUE", "replyTo.id must be a non-empty string"));
    return null;
  }
  const parsed: ReplyRef = { id: reply.id };
  if (Object.hasOwn(reply, "conversationId")) {
    if (typeof reply.conversationId !== "string" || reply.conversationId.length === 0) {
      issues.push(issue(`${base}/replyTo/conversationId`, "INVALID_VALUE", "conversationId must be a non-empty string"));
    } else {
      parsed.conversationId = reply.conversationId;
    }
  }
  if (Object.hasOwn(reply, "text")) {
    if (typeof reply.text !== "string") {
      issues.push(issue(`${base}/replyTo/text`, "INVALID_TYPE", "reply quote text must be a string"));
    } else {
      parsed.text = reply.text;
    }
  }
  if (Object.hasOwn(reply, "direction")) {
    if (!DIRECTIONS.has(reply.direction as Direction)) {
      issues.push(issue(`${base}/replyTo/direction`, "INVALID_VALUE", "reply quote direction must be incoming or outgoing"));
    } else {
      parsed.direction = reply.direction as string;
    }
  }
  for (const key of Object.keys(reply)) {
    if (key === "id" || key === "conversationId" || key === "text" || key === "direction" || key === "service" || key === "sender") {
      continue;
    }
    issues.push(issue(`${base}/replyTo/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
  }
  if (Object.hasOwn(reply, "service") && !SERVICES.has(reply.service as Service)) {
    issues.push(issue(`${base}/replyTo/service`, "INVALID_VALUE", "reply quote service must be imessage or sms"));
  }
  if (Object.hasOwn(reply, "sender") && typeof reply.sender !== "string") {
    issues.push(issue(`${base}/replyTo/sender`, "INVALID_TYPE", "reply quote sender must be a string"));
  }
  return parsed;
}

function readReactions(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
): { present: boolean; targets: string[] } {
  if (!Object.hasOwn(value, "reactions")) return { present: false, targets: [] };
  const reactions = value.reactions;
  if (!Array.isArray(reactions)) {
    issues.push(issue(`${base}/reactions`, "INVALID_TYPE", "reactions must be an array"));
    return { present: false, targets: [] };
  }
  const targets: string[] = [];
  reactions.forEach((reaction, index) => {
    const path = `${base}/reactions/${index}`;
    if (!isPlainObject(reaction)) {
      issues.push(issue(path, "INVALID_TYPE", "reaction must be an object"));
      return;
    }
    if (typeof reaction.type !== "string" || reaction.type.length === 0) {
      issues.push(issue(`${path}/type`, "INVALID_VALUE", "reaction type must be a non-empty string"));
    }
    if (Object.hasOwn(reaction, "byMe") && typeof reaction.byMe !== "boolean") {
      issues.push(issue(`${path}/byMe`, "INVALID_TYPE", "reaction byMe must be a boolean"));
    }
    if (Object.hasOwn(reaction, "emoji") && typeof reaction.emoji !== "string") {
      issues.push(issue(`${path}/emoji`, "INVALID_TYPE", "reaction emoji must be a string"));
    }
    const target = reaction.messageId ?? reaction.targetId;
    if (target !== undefined && (typeof target !== "string" || target.length === 0)) {
      issues.push(issue(`${path}/messageId`, "INVALID_REFERENCE", "reaction target must be a message id"));
    } else if (typeof target === "string") {
      targets.push(target);
    }
    for (const key of Object.keys(reaction)) {
      if (key === "type" || key === "byMe" || key === "emoji" || key === "messageId" || key === "targetId") continue;
      issues.push(issue(`${path}/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
    }
  });
  return { present: true, targets };
}

function readEdited(value: Record<string, unknown>, base: string, issues: ValidationIssue[]): boolean | undefined {
  if (!Object.hasOwn(value, "edited")) return undefined;
  if (typeof value.edited !== "boolean") {
    issues.push(issue(`${base}/edited`, "INVALID_TYPE", "edited must be a boolean"));
    return undefined;
  }
  return value.edited;
}

function readRemoved(value: Record<string, unknown>, base: string, issues: ValidationIssue[]): boolean | undefined {
  if (!Object.hasOwn(value, "removed")) return undefined;
  if (typeof value.removed !== "boolean") {
    issues.push(issue(`${base}/removed`, "INVALID_TYPE", "removed must be a boolean"));
    return undefined;
  }
  return value.removed;
}

function readReplyCount(value: Record<string, unknown>, base: string, issues: ValidationIssue[]): void {
  if (!Object.hasOwn(value, "replyCount")) return;
  issues.push(
    issue(
      `${base}/replyCount`,
      "INVALID_VALUE",
      "reply counts are recomputed by the runtime contract",
    ),
  );
}

function readPlatforms(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  flowPlatform: DemoPlatform | undefined,
): void {
  if (!Object.hasOwn(value, "platforms")) return;
  const declared = value.platforms;
  if (!Array.isArray(declared) || declared.some((entry) => entry !== "ios" && entry !== "macos")) {
    issues.push(issue(`${base}/platforms`, "INVALID_VALUE", "platforms must be an array of ios and macos"));
    return;
  }
  if (flowPlatform && (declared.length !== 1 || declared[0] !== flowPlatform)) {
    issues.push(
      issue(
        `${base}/platforms`,
        "PLATFORM_MISMATCH",
        `message targets ${declared.join(", ")} but the demo platform is ${flowPlatform}`,
      ),
    );
    return;
  }
  issues.push(
    issue(
      `${base}/platforms`,
      "UNKNOWN_FIELD",
      "platform targets are declared once on the demo, not on each message",
    ),
  );
}

function readOptionalMillis(
  value: Record<string, unknown>,
  key: "readAt" | "sentAt",
  path: string,
  issues: ValidationIssue[],
): "absent" | "valid" | "invalid" {
  if (!Object.hasOwn(value, key)) return "absent";
  const stamp = value[key];
  if (typeof stamp !== "number" || !Number.isSafeInteger(stamp) || stamp < 0) {
    issues.push(issue(path, "INVALID_TIMESTAMP", `${key} must be an integer number of epoch milliseconds`));
    return "invalid";
  }
  return "valid";
}

function readEffect(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  kind: MessageKind | undefined,
  kindBlocked: boolean,
  direction: Direction | undefined,
): BubbleEffectName | undefined {
  if (!Object.hasOwn(value, "effect")) return undefined;
  if (typeof value.effect !== "string" || !EFFECTS.has(value.effect as BubbleEffectName)) {
    issues.push(
      issue(
        `${base}/effect`,
        "INVALID_VALUE",
        "effect must be slam, loud, gentle, or invisible-ink",
      ),
    );
    return undefined;
  }
  const effect = value.effect as BubbleEffectName;
  const effectiveKind = kind ?? "text";
  if (!kindBlocked && effectiveKind !== "text") {
    issues.push(
      issue(
        `${base}/effect`,
        "INVALID_ANIMATION",
        `native send effects apply to outgoing text, not ${JSON.stringify(effectiveKind)}`,
      ),
    );
    return undefined;
  }
  if (!kindBlocked && direction === "incoming" && effect !== undefined) {
    issues.push(
      issue(
        `${base}/effect`,
        "INVALID_ANIMATION",
        `${effect} conflicts with the receive arrival flight`,
      ),
    );
    return undefined;
  }
  if (effect !== "invisible-ink" && !(effect in bubbleEffectDurationMs)) return undefined;
  return effect;
}

function readLink(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  required: boolean,
): DemoMessage["link"] | "invalid" | undefined {
  if (!Object.hasOwn(value, "link")) {
    if (required) issues.push(issue(`${base}/link`, "MISSING_FIELD", "link messages require a link payload"));
    return undefined;
  }
  const link = value.link;
  if (!isPlainObject(link)) {
    issues.push(issue(`${base}/link`, "INVALID_TYPE", "link must be an object"));
    return "invalid";
  }
  let invalid = false;
  if (!Object.hasOwn(link, "url")) {
    issues.push(issue(`${base}/link/url`, "MISSING_FIELD", "link.url is required"));
    invalid = true;
  } else if (typeof link.url !== "string" || !isDisplayedHttpUrl(link.url)) {
    issues.push(issue(`${base}/link/url`, "INVALID_ASSET", "link destinations must be http or https URLs"));
    invalid = true;
  }
  if (Object.hasOwn(link, "title") && typeof link.title !== "string") {
    issues.push(issue(`${base}/link/title`, "INVALID_TYPE", "link.title must be a string"));
    invalid = true;
  }
  if (Object.hasOwn(link, "host") && typeof link.host !== "string") {
    issues.push(issue(`${base}/link/host`, "INVALID_TYPE", "link.host must be a string"));
    invalid = true;
  }
  for (const key of Object.keys(link)) {
    if (key === "url" || key === "title" || key === "host") continue;
    issues.push(issue(`${base}/link/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
    invalid = true;
  }
  if (invalid || typeof link.url !== "string") return "invalid";
  const copy: NonNullable<DemoMessage["link"]> = { url: link.url };
  if (typeof link.title === "string") copy.title = link.title;
  if (typeof link.host === "string") copy.host = link.host;
  return copy;
}

function readAttachments(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  required: boolean,
): DemoMessage["attachments"] | "invalid" | undefined {
  if (!Object.hasOwn(value, "attachments")) {
    if (required) issues.push(issue(`${base}/attachments`, "MISSING_FIELD", "attachment messages require attachments"));
    return undefined;
  }
  if (!Array.isArray(value.attachments)) {
    issues.push(issue(`${base}/attachments`, "INVALID_TYPE", "attachments must be an array"));
    return "invalid";
  }
  if (required && value.attachments.length === 0) {
    issues.push(issue(`${base}/attachments`, "MISSING_FIELD", "attachment messages require at least one attachment"));
    return "invalid";
  }
  let invalid = false;
  const copies: NonNullable<DemoMessage["attachments"]> = [];
  value.attachments.forEach((item, index) => {
    const path = `${base}/attachments/${index}`;
    if (!isPlainObject(item)) {
      issues.push(issue(path, "INVALID_TYPE", "attachment must be an object"));
      invalid = true;
      return;
    }
    if (typeof item.name !== "string" || !isConfinedName(item.name)) {
      issues.push(issue(`${path}/name`, "INVALID_ASSET", "attachment names must stay inside the asset root"));
      invalid = true;
    }
    if (Object.hasOwn(item, "size") && typeof item.size !== "string") {
      issues.push(issue(`${path}/size`, "INVALID_TYPE", "attachment size must be a string"));
      invalid = true;
    }
    for (const key of Object.keys(item)) {
      if (key === "name" || key === "size") continue;
      issues.push(issue(`${path}/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
      invalid = true;
    }
    if (typeof item.name === "string" && isConfinedName(item.name)) {
      const copy: NonNullable<DemoMessage["attachments"]>[number] = { name: item.name };
      if (typeof item.size === "string") copy.size = item.size;
      copies.push(copy);
    }
  });
  return invalid ? "invalid" : copies;
}

function readImages(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  required: boolean,
): DemoMessage["images"] | "invalid" | undefined {
  if (!Object.hasOwn(value, "images")) {
    if (required) issues.push(issue(`${base}/images`, "MISSING_FIELD", "image messages require images"));
    return undefined;
  }
  if (!Array.isArray(value.images)) {
    issues.push(issue(`${base}/images`, "INVALID_TYPE", "images must be an array"));
    return "invalid";
  }
  if (required && value.images.length === 0) {
    issues.push(issue(`${base}/images`, "MISSING_FIELD", "image messages require at least one image"));
    return "invalid";
  }
  let invalid = false;
  const copies: NonNullable<DemoMessage["images"]> = [];
  value.images.forEach((item, index) => {
    const path = `${base}/images/${index}`;
    if (!isPlainObject(item)) {
      issues.push(issue(path, "INVALID_TYPE", "image must be an object"));
      invalid = true;
      return;
    }
    if (typeof item.src !== "string" || !isConfinedRelativePath(item.src)) {
      issues.push(issue(`${path}/src`, "INVALID_ASSET", "images must be local paths inside the asset root"));
      invalid = true;
    }
    if (typeof item.alt !== "string") {
      issues.push(issue(`${path}/alt`, "MISSING_FIELD", "image alt must be a string"));
      invalid = true;
    }
    for (const dimension of ["width", "height"] as const) {
      if (!Object.hasOwn(item, dimension)) continue;
      const size = item[dimension];
      if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) {
        issues.push(issue(`${path}/${dimension}`, "INVALID_ASSET", `${dimension} must be a positive integer`));
        invalid = true;
      }
    }
    for (const key of Object.keys(item)) {
      if (key === "src" || key === "alt" || key === "width" || key === "height") continue;
      issues.push(issue(`${path}/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
      invalid = true;
    }
    if (typeof item.src === "string" && isConfinedRelativePath(item.src) && typeof item.alt === "string") {
      const copy: NonNullable<DemoMessage["images"]>[number] = { src: item.src, alt: item.alt };
      if (typeof item.width === "number" && Number.isSafeInteger(item.width) && item.width > 0) copy.width = item.width;
      if (typeof item.height === "number" && Number.isSafeInteger(item.height) && item.height > 0) copy.height = item.height;
      copies.push(copy);
    }
  });
  return invalid ? "invalid" : copies;
}

function readAudio(
  value: Record<string, unknown>,
  base: string,
  issues: ValidationIssue[],
  required: boolean,
): DemoMessage["audio"] | "invalid" | undefined {
  if (!Object.hasOwn(value, "audio")) {
    if (required) issues.push(issue(`${base}/audio`, "MISSING_FIELD", "audio messages require an audio payload"));
    return undefined;
  }
  const audio = value.audio;
  if (!isPlainObject(audio)) {
    issues.push(issue(`${base}/audio`, "INVALID_TYPE", "audio must be an object"));
    return "invalid";
  }
  let invalid = false;
  if (typeof audio.duration !== "number" || !Number.isFinite(audio.duration) || audio.duration < 0) {
    issues.push(issue(`${base}/audio/duration`, "INVALID_VALUE", "audio duration must be a nonnegative number of seconds"));
    invalid = true;
  }
  let peaks: number[] | undefined;
  if (Object.hasOwn(audio, "peaks")) {
    if (!Array.isArray(audio.peaks) || audio.peaks.some((peak) => typeof peak !== "number" || !Number.isFinite(peak) || peak < 0 || peak > 1)) {
      issues.push(issue(`${base}/audio/peaks`, "INVALID_ASSET", "audio peaks must be numbers from 0 to 1"));
      invalid = true;
    } else {
      peaks = [...audio.peaks];
    }
  }
  for (const key of Object.keys(audio)) {
    if (key === "duration" || key === "peaks") continue;
    issues.push(issue(`${base}/audio/${escapeSegment(key)}`, "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
    invalid = true;
  }
  if (invalid || typeof audio.duration !== "number") return "invalid";
  const copy: NonNullable<DemoMessage["audio"]> = { duration: audio.duration };
  if (peaks) copy.peaks = peaks;
  return copy;
}

function readContact(
  value: unknown,
  present: boolean,
  issues: ValidationIssue[],
): DemoFlow["contact"] | undefined {
  if (!present) {
    issues.push(issue(pointer(["contact"]), "MISSING_FIELD", "missing contact"));
    return undefined;
  }
  if (!isPlainObject(value)) {
    issues.push(issue(pointer(["contact"]), "INVALID_TYPE", "contact must be an object"));
    return undefined;
  }
  const name = readBoundedString(value, "name", pointer(["contact", "name"]), issues, false);
  let initials: string | undefined;
  if (Object.hasOwn(value, "initials")) {
    if (typeof value.initials !== "string") {
      issues.push(issue(pointer(["contact", "initials"]), "INVALID_TYPE", "initials must be a string"));
    } else {
      initials = value.initials;
    }
  }
  for (const key of Object.keys(value)) {
    if (key === "name" || key === "initials") continue;
    issues.push(issue(pointer(["contact", key]), "UNKNOWN_FIELD", `unknown field ${JSON.stringify(key)}`));
  }
  if (name === undefined) return undefined;
  const contact: DemoFlow["contact"] = { name };
  if (initials !== undefined) contact.initials = initials;
  return contact;
}

function readDraft(input: Record<string, unknown>, issues: ValidationIssue[]): string | undefined {
  if (!Object.hasOwn(input, "draft")) {
    issues.push(issue(pointer(["draft"]), "MISSING_FIELD", "missing draft"));
    return undefined;
  }
  if (typeof input.draft !== "string") {
    issues.push(issue(pointer(["draft"]), "INVALID_TYPE", "draft must be a string"));
    return undefined;
  }
  return input.draft;
}

function readBoundedString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  allowEmpty: boolean,
): string | undefined {
  if (!Object.hasOwn(value, key)) {
    issues.push(issue(path, "MISSING_FIELD", `missing ${key}`));
    return undefined;
  }
  if (typeof value[key] !== "string" || (!allowEmpty && (value[key] as string).length === 0)) {
    issues.push(issue(path, "INVALID_VALUE", `${key} must be a non-empty string`));
    return undefined;
  }
  return value[key] as string;
}

function readText(value: Record<string, unknown>, path: string, issues: ValidationIssue[]): string | undefined {
  if (!Object.hasOwn(value, "text")) {
    issues.push(issue(path, "MISSING_FIELD", "missing text"));
    return undefined;
  }
  if (typeof value.text !== "string") {
    issues.push(issue(path, "INVALID_TYPE", "text must be a string"));
    return undefined;
  }
  return value.text;
}

function readBoolean(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  required: boolean,
): boolean | undefined {
  if (!Object.hasOwn(value, key)) {
    if (required) issues.push(issue(path, "MISSING_FIELD", `missing ${key}`));
    return undefined;
  }
  if (typeof value[key] !== "boolean") {
    issues.push(issue(path, "INVALID_TYPE", `${key} must be a boolean`));
    return undefined;
  }
  return value[key] as boolean;
}

function readMillis(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  required: boolean,
): number | undefined {
  if (!Object.hasOwn(value, key)) {
    if (required) issues.push(issue(path, "MISSING_FIELD", `missing ${key}`));
    return undefined;
  }
  const stamp = value[key];
  if (typeof stamp !== "number" || !Number.isSafeInteger(stamp)) {
    issues.push(issue(path, "INVALID_TIMESTAMP", `${key} must be an integer number of milliseconds`));
    return undefined;
  }
  if (stamp < 0) {
    issues.push(issue(path, "INVALID_TIMESTAMP", `${key} must be zero or greater`));
    return undefined;
  }
  return stamp;
}

function readEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  allowed: Set<T>,
): T | undefined {
  if (!Object.hasOwn(value, key)) {
    issues.push(issue(path, "MISSING_FIELD", `missing ${key}`));
    return undefined;
  }
  if (typeof value[key] !== "string" || !allowed.has(value[key] as T)) {
    issues.push(issue(path, "INVALID_VALUE", `${key} must be ${[...allowed].join(" or ")}`));
    return undefined;
  }
  return value[key] as T;
}

function readOptionalEnum<T extends string>(
  value: Record<string, unknown>,
  key: string,
  path: string,
  issues: ValidationIssue[],
  allowed: Set<T>,
): T | undefined {
  if (!Object.hasOwn(value, key)) return undefined;
  if (typeof value[key] !== "string" || !allowed.has(value[key] as T)) {
    issues.push(issue(path, "INVALID_VALUE", `${key} must be ${[...allowed].join(" or ")}`));
    return undefined;
  }
  return value[key] as T;
}

function isDisplayedHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isConfinedRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes("\0") || value.includes("\\")) return false;
  if (value.startsWith("/") || /^[a-zA-Z]:/.test(value)) return false;
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(value)) return false;
  const parts = value.split("/");
  return parts.every((part) => part.length > 0 && part !== "..");
}

function isConfinedName(value: string): boolean {
  return isConfinedRelativePath(value) && !value.includes("/");
}

function escapeSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}
