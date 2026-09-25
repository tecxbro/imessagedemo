import type { ComponentProps, ReactElement } from "react";
import type { AudioControlState, DemoMessage, OverlayState } from "@/contracts";
import type { Cue, LogicalMessage, LogicalState, VisualFrame } from "@/runtime";
import { pendingCueDurations } from "@/runtime";
import { ImageViewer, type ImageViewerPhoto } from "@/components/imessage/image-viewer";
import { MessageImages, type MessageImage } from "@/components/imessage/message-image";
import { MessageAudio } from "@/components/imessage/message-audio";
import type { Direction } from "@/components/imessage/tokens";

/** Canonical photo payload copied onto the pinned MessageImages / ImageViewer shapes. */
export type MediaPhoto = { src: string; alt: string; width?: number; height?: number };

export type PhotoMessageDescription =
  | { kind: "photo"; messageId: string; images: MediaPhoto[] }
  | { kind: "photo-grid"; messageId: string; images: MediaPhoto[]; count: number };

export type ImageViewerMedia = {
  open: boolean;
  messageId: string | null;
  index: number;
  /** 0 before open, cue progress while enter/exit runs, 1 when settled open (cue absent). */
  progress: number;
  photos: MediaPhoto[];
};

export type ControlledAudioVisual = AudioControlState | null;

type ImageBearing = Pick<DemoMessage, "id" | "kind" | "images">;

/** Photos on a canonical image message, or null when the message is not a photo row. */
export function photosFromMessage(message: ImageBearing): MediaPhoto[] | null {
  if (message.kind !== "image" || !message.images?.length) return null;
  return message.images.map((image) => ({
    src: image.src,
    alt: image.alt,
    ...(image.width !== undefined ? { width: image.width } : {}),
    ...(image.height !== undefined ? { height: image.height } : {}),
  }));
}

/** Structured description for capture / authoring checks. Single photo vs multi-photo grid. */
export function describePhotoMessage(message: ImageBearing): PhotoMessageDescription | null {
  const images = photosFromMessage(message);
  if (!images) return null;
  if (images.length === 1) return { kind: "photo", messageId: message.id, images };
  return { kind: "photo-grid", messageId: message.id, images, count: images.length };
}

export function toMessageImages(photos: MediaPhoto[]): MessageImage[] {
  return photos.map((photo) => ({
    src: photo.src,
    alt: photo.alt,
    ...(photo.width !== undefined ? { width: photo.width } : {}),
    ...(photo.height !== undefined ? { height: photo.height } : {}),
  }));
}

export function toViewerPhotos(photos: MediaPhoto[]): ImageViewerPhoto[] {
  return photos.map((photo) => ({
    src: photo.src,
    alt: photo.alt,
    ...(photo.width !== undefined ? { width: photo.width } : {}),
    ...(photo.height !== undefined ? { height: photo.height } : {}),
  }));
}

type PhotoRowProps = Omit<ComponentProps<typeof MessageImages>, "images"> & {
  message: ImageBearing;
};

/** Thin forward onto pinned MessageImages. Returns null when the message has no photos. */
export function PhotoMessage({ message, ...props }: PhotoRowProps): ReactElement | null {
  const photos = photosFromMessage(message);
  if (!photos) return null;
  return <MessageImages images={toMessageImages(photos)} {...props} />;
}

function findMessage(messages: readonly LogicalMessage[] | readonly DemoMessage[], messageId: string) {
  return messages.find((message) => message.id === messageId) ?? null;
}

function imageViewerOverlay(overlay: OverlayState | undefined): Extract<OverlayState, { kind: "image-viewer" }> | null {
  return overlay?.kind === "image-viewer" ? overlay : null;
}

function imageViewerCue(cues: readonly Cue[]): Cue | undefined {
  return cues.find((cue) => {
    if (cue.kind !== "overlay-enter" && cue.kind !== "overlay-exit") return false;
    return cue.detail?.overlay?.kind === "image-viewer";
  });
}

/**
 * Image viewer open/close/index and seekable transition progress from projected state + frame cues.
 * Cue duration is `pendingCueDurations.imageViewer` (300) on the runtime frame.
 */
export function imageViewerMedia(
  state: Pick<LogicalState, "overlay" | "messages">,
  cues: readonly Cue[] = [],
): ImageViewerMedia {
  const cue = imageViewerCue(cues);
  const live = imageViewerOverlay(state.overlay);
  const fromCue = imageViewerOverlay(cue?.detail?.overlay);
  const target = live ?? fromCue;

  if (!target) {
    return { open: false, messageId: null, index: 0, progress: 0, photos: [] };
  }

  const message = findMessage(state.messages, target.messageId);
  const photos = message ? photosFromMessage(message) ?? [] : [];
  const progress = cue ? cue.progress : live ? 1 : 0;
  const open = live !== null || cue?.kind === "overlay-enter";

  return {
    open,
    messageId: target.messageId,
    index: target.index,
    progress,
    photos,
  };
}

/** Controlled audio visual state. No HTMLAudioElement — position/playing are authored facts. */
export function controlledAudioVisual(audio: AudioControlState | null | undefined): ControlledAudioVisual {
  if (!audio) return null;
  return {
    messageId: audio.messageId,
    position: audio.position,
    playing: audio.playing,
    ...(audio.seeking !== undefined ? { seeking: audio.seeking } : {}),
  };
}

export function controlledAudioFromFrame(frame: Pick<LogicalState, "audio">): ControlledAudioVisual {
  return controlledAudioVisual(frame.audio);
}

export function imageViewerFromFrame(frame: VisualFrame): ImageViewerMedia {
  return imageViewerMedia(frame, frame.cues);
}

/** Props MessageList / MessageAudio need for one controlled audio row. */
export function audioControlProps(
  audio: ControlledAudioVisual,
  messageId: string,
): { position: number; playing: boolean } | undefined {
  if (!audio || audio.messageId !== messageId) return undefined;
  return { position: audio.position, playing: audio.playing };
}

type ViewerProps = Omit<ComponentProps<typeof ImageViewer>, "photos" | "open" | "index" | "progress"> & {
  viewer: ImageViewerMedia;
};

/** Mount the pinned ImageViewer from projected media state. */
export function ImageViewerFromMedia({ viewer, ...props }: ViewerProps): ReactElement | null {
  if (!viewer.open && viewer.progress <= 0 && !viewer.photos.length) return null;
  if (!viewer.photos.length) return null;
  return (
    <ImageViewer
      photos={toViewerPhotos(viewer.photos)}
      open={viewer.open}
      index={viewer.index}
      progress={viewer.progress}
      {...props}
    />
  );
}

type ControlledAudioProps = Omit<ComponentProps<typeof MessageAudio>, "duration" | "position" | "playing"> & {
  message: Pick<DemoMessage, "id" | "kind" | "audio" | "direction">;
  audio: ControlledAudioVisual;
  direction?: Direction;
};

/** Controlled waveform for an audio message. Does not start HTML media playback. */
export function ControlledAudioMessage({ message, audio, direction, ...props }: ControlledAudioProps): ReactElement | null {
  if (message.kind !== "audio" || !message.audio) return null;
  const control = audioControlProps(audio, message.id);
  return (
    <MessageAudio
      duration={message.audio.duration}
      peaks={message.audio.peaks}
      direction={direction ?? message.direction}
      position={control?.position ?? 0}
      playing={control?.playing ?? false}
      {...props}
    />
  );
}

export const imageViewerCueDurationMs = pendingCueDurations.imageViewer;
