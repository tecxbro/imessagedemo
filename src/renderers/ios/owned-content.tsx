import { useEffect, useRef, type ReactNode } from "react";
import type { CompiledDemo, DemoMessage } from "@/contracts";
import { FaceTimeCard } from "@/components/imessage/facetime-card";
import { MessageAudio } from "@/components/imessage/message-audio";
import type { Message } from "@/components/imessage/message-list";
import type { VisualFrame } from "@/runtime";

function AudibleAudio({ message, position, playing }: { message: DemoMessage; position: number; playing: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (Number.isFinite(position) && Math.abs(node.currentTime - position) > 0.08) {
      try {
        node.currentTime = position;
      } catch {
        node.dataset.playback = "unavailable";
      }
    }
    if (!playing) {
      node.pause();
      return;
    }
    void node.play().then(() => {
      node.dataset.playback = "playing";
    }).catch(() => {
      node.dataset.playback = "blocked";
    });
  }, [playing, position]);
  return (
    <>
      <MessageAudio duration={message.audio?.duration ?? 0} peaks={message.audio?.peaks} direction={message.direction} position={position} playing={playing} />
      {message.audio?.src ? <audio ref={ref} src={message.audio.src} data-slot="audible-audio" preload="auto" /> : null}
    </>
  );
}

function stickerMarks(message: DemoMessage, content: ReactNode): ReactNode {
  if (!message.stickers?.length) return content;
  return (
    <div data-slot="stickered-message" style={{ position: "relative" }}>
      {content}
      {message.stickers.map((sticker, index) => (
        <span
          key={sticker.id}
          data-slot="message-sticker"
          data-sticker-id={sticker.id}
          aria-label={sticker.label}
          style={{
            position: "absolute",
            right: 4,
            top: -8 - index * 28,
            fontSize: 32,
            lineHeight: 1,
            transform: `rotate(${sticker.rotation ?? 0}deg)`,
          }}
        >
          {sticker.glyph}
        </span>
      ))}
    </div>
  );
}

export function renderOwnedContent(compiled: CompiledDemo, frame: VisualFrame, upstream: Message, content: ReactNode): ReactNode | undefined {
  const message = frame.messages.find((item) => item.id === upstream.id);
  if (!message) return undefined;
  if (message.kind === "facetime" && message.facetime) {
    return <FaceTimeCard state={message.facetime.state} duration={message.facetime.duration} />;
  }
  if (message.kind === "sticker" && message.sticker) {
    return (
      <span data-slot="sticker-message" data-sticker-id={message.sticker.id} aria-label={message.sticker.label} style={{ fontSize: 64, lineHeight: 1, transform: `rotate(${message.sticker.rotation ?? 0}deg)` }}>
        {message.sticker.glyph}
      </span>
    );
  }
  if (message.kind === "audio" && message.audio?.src) {
    const control = frame.audio?.messageId === message.id ? frame.audio : null;
    return stickerMarks(message, <AudibleAudio message={message} position={control?.position ?? 0} playing={control?.playing ?? false} />);
  }
  if (message.stickers?.length) return stickerMarks(message, content);
  return undefined;
}
