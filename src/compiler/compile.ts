import type { CompiledDemo, CompiledEvent, DemoFlow, DemoMessage, Reaction } from "@/contracts";
import { arrivalWindow } from "./motion";

function copyContact(contact: DemoFlow["contact"]): DemoFlow["contact"] {
  const copy: DemoFlow["contact"] = { name: contact.name };
  if (contact.initials !== undefined) copy.initials = contact.initials;
  return copy;
}

function replyOf(message: DemoMessage, messages: readonly DemoMessage[]): DemoMessage["replyTo"] {
  const reply = message.replyTo as DemoMessage["replyTo"] | string | undefined;
  if (reply === undefined) return undefined;
  if (typeof reply === "string") {
    const target = messages.find((item) => item.id === reply);
    if (!target) return undefined;
    return { id: target.id, text: target.text, direction: target.direction };
  }
  return {
    id: reply.id,
    text: reply.text,
    direction: reply.direction,
    ...(reply.service !== undefined ? { service: reply.service } : {}),
    ...(reply.sender !== undefined ? { sender: reply.sender } : {}),
  };
}

function copyMessage(message: DemoMessage, messages: readonly DemoMessage[]): DemoMessage {
  const copy: DemoMessage = {
    id: message.id,
    text: message.text,
    direction: message.direction,
    atMs: message.atMs,
  };
  if (message.kind !== undefined) copy.kind = message.kind;
  if (message.service !== undefined) copy.service = message.service;
  if (message.status !== undefined) copy.status = message.status;
  if (message.effect !== undefined) copy.effect = message.effect;
  if (message.link !== undefined) {
    const link: NonNullable<DemoMessage["link"]> = { url: message.link.url };
    if (message.link.title !== undefined) link.title = message.link.title;
    if (message.link.host !== undefined) link.host = message.link.host;
    if (message.link.image !== undefined) link.image = message.link.image;
    copy.link = link;
  }
  if (message.attachments !== undefined) {
    copy.attachments = message.attachments.map((item) => {
      const attachment: NonNullable<DemoMessage["attachments"]>[number] = { name: item.name };
      if (item.size !== undefined) attachment.size = item.size;
      if (item.href !== undefined) attachment.href = item.href;
      return attachment;
    });
  }
  if (message.images !== undefined) {
    copy.images = message.images.map((item) => {
      const image: NonNullable<DemoMessage["images"]>[number] = { src: item.src, alt: item.alt };
      if (item.width !== undefined) image.width = item.width;
      if (item.height !== undefined) image.height = item.height;
      return image;
    });
  }
  if (message.audio !== undefined) {
    const audio: NonNullable<DemoMessage["audio"]> = { duration: message.audio.duration };
    if (message.audio.peaks !== undefined) audio.peaks = [...message.audio.peaks];
    copy.audio = audio;
  }
  const reply = replyOf(message, messages);
  if (reply) copy.replyTo = reply;
  const ownReactions = (message.reactions ?? []).filter((reaction) => {
    const target = (reaction as Reaction & { messageId?: string; targetId?: string }).messageId
      ?? (reaction as Reaction & { targetId?: string }).targetId;
    return target === undefined || target === message.id;
  });
  if (ownReactions.length > 0) {
    copy.reactions = ownReactions.map((reaction, index) => {
      const stored: Reaction = { id: reaction.id || `${message.id}:${index}`, type: reaction.type };
      if (reaction.byMe !== undefined) stored.byMe = reaction.byMe;
      if (reaction.emoji !== undefined) stored.emoji = reaction.emoji;
      return stored;
    });
  }
  if (message.edited !== undefined) copy.edited = message.edited;
  if (message.readAt !== undefined) copy.readAt = message.readAt;
  if (message.revealed !== undefined) copy.revealed = message.revealed;
  return copy;
}

function copyEvent(event: CompiledEvent, baseline: number): CompiledEvent {
  const atMs = event.atMs - baseline;
  switch (event.type) {
    case "message":
      return { ...event, atMs, message: copyMessage(event.message, [event.message]) };
    case "typing":
      return { type: "typing", atMs, typing: event.typing, ...(event.sourceIndex !== undefined ? { sourceIndex: event.sourceIndex } : {}), ...(event.conversationId !== undefined ? { conversationId: event.conversationId } : {}) };
    case "draft":
      return { type: "draft", atMs, value: event.value, ...(event.sourceIndex !== undefined ? { sourceIndex: event.sourceIndex } : {}), ...(event.conversationId !== undefined ? { conversationId: event.conversationId } : {}) };
    case "reaction":
      return {
        ...event,
        atMs,
        reaction: event.reaction === null ? null : { ...event.reaction },
      };
    case "overlay":
      return { ...event, atMs, overlay: event.overlay.kind === "selection" ? { ...event.overlay, messageIds: [...event.overlay.messageIds] } : { ...event.overlay } };
    case "notice":
      return { ...event, atMs, notice: { ...event.notice } };
    default:
      return { ...event, atMs };
  }
}

export function compileDemo(demo: DemoFlow): CompiledDemo {
  const baseline = demo.messages[0]?.atMs ?? demo.events?.[0]?.atMs ?? 0;
  const events: CompiledDemo["events"] = [];
  let durationMs = 0;

  for (const message of demo.messages) {
    if (message.removed === true) continue;
    const atMs = message.atMs - baseline;
    const copied = copyMessage(message, demo.messages);
    delete copied.removed;
    events.push({ type: "message", atMs, message: copied });
    durationMs = Math.max(durationMs, atMs);
    const window = arrivalWindow(message);
    if (window) durationMs = Math.max(durationMs, window.end - baseline);
  }

  for (const event of demo.events ?? []) {
    const copied = copyEvent(event, baseline);
    events.push(copied);
    durationMs = Math.max(durationMs, copied.atMs);
  }

  events.push({ type: "draft", atMs: 0, value: demo.draft });
  events.push({ type: "typing", atMs: 0, typing: demo.typing });

  return {
    id: demo.id,
    platform: demo.platform,
    theme: demo.theme,
    durationMs,
    contact: copyContact(demo.contact),
    nowMs: demo.nowMs,
    screen: demo.screen,
    events,
  };
}
