import type { DemoMessage } from "@/contracts";
import type { Message } from "@/components/imessage/message-list";

/**
 * Map a frozen demo message onto the pinned `Message`.
 * `sentAt` stays a number. Typing is not a row. Reaction ids, counts, and actors are not fields on this pin.
 */
export function toUpstreamMessage(message: DemoMessage): Message {
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
  if (message.link) {
    upstream.link = {
      url: message.link.url,
      ...(message.link.title ? { title: message.link.title } : {}),
      ...(message.link.host ? { host: message.link.host } : {}),
    };
  }
  if (message.attachments) {
    upstream.attachments = message.attachments.map((file) => ({
      name: file.name,
      ...(file.size ? { size: file.size } : {}),
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
