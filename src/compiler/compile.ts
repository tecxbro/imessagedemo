import type { CompiledDemo, DemoFlow, DemoMessage } from "@/contracts";
import { arrivalWindow } from "./motion";

function copyContact(contact: DemoFlow["contact"]): DemoFlow["contact"] {
  const copy: DemoFlow["contact"] = { name: contact.name };
  if (contact.initials !== undefined) copy.initials = contact.initials;
  return copy;
}

function copyMessage(message: DemoMessage): DemoMessage {
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
    copy.link = link;
  }
  if (message.attachments !== undefined) {
    copy.attachments = message.attachments.map((item) => {
      const attachment: NonNullable<DemoMessage["attachments"]>[number] = { name: item.name };
      if (item.size !== undefined) attachment.size = item.size;
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
  return copy;
}

export function compileDemo(demo: DemoFlow): CompiledDemo {
  const baseline = demo.messages[0]?.atMs ?? 0;
  const events: CompiledDemo["events"] = [];
  let durationMs = 0;

  for (const message of demo.messages) {
    const atMs = message.atMs - baseline;
    events.push({ type: "message", atMs, message: copyMessage(message) });
    durationMs = Math.max(durationMs, atMs);
    const window = arrivalWindow(message);
    if (window) durationMs = Math.max(durationMs, window.end - baseline);
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
