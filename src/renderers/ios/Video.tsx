import { useEffect, useRef } from "react";
import type { DemoMessage } from "@/contracts";
import { Tapback, type TapbackType } from "@/components/imessage/tapback";

/** Repository-owned muted media row, synchronized to the conversation clock. */
export function IosVideo({ message, timeMs, arrivalMs }: { message: DemoMessage; timeMs: number; arrivalMs: number }) {
  const video = useRef<HTMLVideoElement>(null);
  const pendingPlay = useRef(false);
  const playing = typeof window !== "undefined" && window.IMESSAGE_DEMO?.state().playing === true;
  const target = Math.max(0, (timeMs - arrivalMs) / 1000);
  const latest = useRef({ target, playing });
  latest.current = { target, playing };
  const synchronize = () => {
    const node = video.current;
    if (!node || node.readyState < 1) return;
    const state = latest.current;
    const position = Number.isFinite(node.duration) ? Math.min(state.target, node.duration) : state.target;
    const ended = Number.isFinite(node.duration) && position >= node.duration;
    // The media clock runs freely between corrections; do not seek on every animation frame.
    if (Math.abs(node.currentTime - position) > (state.playing ? 0.35 : 0.001)) node.currentTime = position;
    if (!state.playing || ended) {
      node.pause();
      node.dataset.playback = ended ? "ended" : "paused";
    } else if (node.paused && !pendingPlay.current) {
      pendingPlay.current = true;
      void node.play().then(() => {
        if (!latest.current.playing) node.pause();
        node.dataset.playback = node.paused ? "paused" : "playing";
      }).catch(() => { node.dataset.playback = "blocked"; }).finally(() => { pendingPlay.current = false; });
    }
  };
  useEffect(synchronize, [target, playing]);
  const payload = message.video!;
  const ratio = payload.width && payload.height ? payload.width / payload.height : 16 / 9;
  return (
    <div data-slot="video-message" style={{ position: "relative", width: 260, maxWidth: "100%", marginTop: message.reactions?.length ? 12 : 0 }}>
      <div style={{ borderRadius: 18, overflow: "hidden", background: "#151515", color: "white" }}>
        <video ref={video} src={payload.src} poster={payload.poster} muted playsInline disablePictureInPicture disableRemotePlayback preload="auto"
          aria-label={message.text || "Video message"} data-slot="message-video" data-target-time={target}
          style={{ display: "block", width: "100%", aspectRatio: ratio, objectFit: "contain" }}
          onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
          onLoadedMetadata={synchronize} onLoadedData={synchronize}
          onError={event => { event.currentTarget.dataset.playback = "unavailable"; }} />
      </div>
      {message.reactions?.length ? <div data-slot="reactions" style={{ position: "absolute", top: -13, [message.direction === "outgoing" ? "left" : "right"]: -8, display: "flex" }}>
        {message.reactions.map(reaction => <Tapback key={reaction.id} reaction={reaction.emoji ? undefined : reaction.type as TapbackType} emoji={reaction.emoji} own={reaction.byMe ?? true} side={message.direction === "outgoing" ? "left" : "right"} animateIn={false} />)}
      </div> : null}
    </div>
  );
}
