import type { DemoMessage } from "@/contracts";
import type { Message } from "@/components/imessage/message-list";

/**
 * Canonical / runtime messages may carry a computed `replyCount`.
 * Do not invent one here — only forward it when present.
 */
export type AdaptableMessage = DemoMessage & { replyCount?: number };

/**
 * Map a frozen demo message onto the pinned `Message`.
 * `sentAt` stays a number. Typing is not a row.
 * Reaction ids stay on the canonical message; the pin only gets type/byMe/emoji.
 * Optional fields are set only when the source has them.
 */
export function toUpstreamMessage(message: AdaptableMessage): Message {
  const upstream: Message = {
    id: message.id,
    text: message.text,
    direction: message.direction,
    sentAt: message.atMs,
  };
  if (message.service) upstream.service = message.service;
  if (message.status) upstream.status = message.status;
  if (message.kind) upstream.kind = message.kind;
  if (message.effect) upstream.effect = message.effect;
  if (message.edited) upstream.edited = message.edited;
  if (message.readAt !== undefined) upstream.readAt = message.readAt;
  if (message.replyCount !== undefined) upstream.replyCount = message.replyCount;
  if (message.replyTo) {
    upstream.replyTo = {
      id: message.replyTo.id,
      text: message.replyTo.text,
      direction: message.replyTo.direction,
      ...(message.replyTo.service ? { service: message.replyTo.service } : {}),
      ...(message.replyTo.sender ? { sender: message.replyTo.sender } : {}),
    };
  }
  if (message.reactions?.length) {
    upstream.reactions = message.reactions.map(({ type, byMe, emoji }) => ({
      type,
      ...(byMe !== undefined ? { byMe } : {}),
      ...(emoji !== undefined ? { emoji } : {}),
    }));
  }
  if (message.link) {
    upstream.link = {
      url: message.link.url,
      ...(message.link.title ? { title: message.link.title } : {}),
      ...(message.link.host ? { host: message.link.host } : {}),
      ...(message.link.image ? { image: message.link.image } : {}),
    };
  }
  if (message.attachments) {
    upstream.attachments = message.attachments.map((file) => ({
      name: file.name,
      ...(file.size ? { size: file.size } : {}),
      ...(file.href ? { href: file.href } : {}),
    }));
  }
  if (message.images) {
    upstream.images = message.images.map((image) => ({
      src: image.src,
      alt: image.alt,
      ...(image.width !== undefined ? { width: image.width } : {}),
      ...(image.height !== undefined ? { height: image.height } : {}),
    }));
  }
  if (message.audio) {
    upstream.audio = {
      duration: message.audio.duration,
      ...(message.audio.peaks ? { peaks: message.audio.peaks } : {}),
    };
  }
  return upstream;
}
