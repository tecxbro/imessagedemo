import type { ReactNode } from "react";
import type { CatalogueSceneDefinition, CatalogueSceneProps, DemoTheme } from "@/contracts";
import motionTokens from "@/contracts/motion-tokens.json";
import { screenEffectDuration } from "@/runtime";
import { iosScreen } from "@/components/imessage/ios-messages-app";
import { PlatformProvider } from "@/components/imessage/platform";
import { PaletteStyle } from "@/components/imessage/palette";
import { FaceTimeCard } from "@/components/imessage/facetime-card";
import { EditableBubble } from "@/components/imessage/message-edit";
import { undoSendPoof } from "@/components/imessage/message-edit";
import { extendFixture, attachmentFixture, audioFixture, imageFixture, inkFixture, linkFixture, listFixture, newMessageFixture, replyFixture, smsFixture, statusFixture, textFixture, typingFixture } from "./fixtures";
import { projectFrame } from "./project";
import { IosDemoRenderer } from "./scene";

const tokenByAnchor: Record<string, string> = {
  IosMessagesApp: "iosScreen",
  MessageList: "iosScreen",
  ScreenEffect: "screenEffectDuration",
  BubbleEffectKind: "bubbleEffectDuration",
};

export function confidenceText(scene: CatalogueSceneDefinition): string {
  const labels = scene.sourceAnchors.map((anchor) => {
    const symbol = tokenByAnchor[anchor] ?? anchor;
    const token = motionTokens.tokens.find((entry) => entry.symbol === symbol);
    return token ? `${token.symbol}: ${token.confidence}` : null;
  }).filter((label): label is string => Boolean(label));
  if (scene.id === "facetime") labels.push("unverified — no capture holds a FaceTime card");
  if (scene.id === "system") labels.push("standalone — not a MessageKind");
  return labels.join(" · ") || scene.tier;
}

function SceneChrome({ scene, children }: { scene: CatalogueSceneDefinition; children: ReactNode }) {
  return (
    <div data-slot="catalogue-scene" data-scene={scene.id} data-tier={scene.tier}>
      <aside data-slot="catalogue-label">
        <strong>{scene.title}</strong>
        <span>{scene.tier}</span>
        <span>{scene.summary}</span>
        <span data-slot="catalogue-confidence">{confidenceText(scene)}</span>
      </aside>
      {children}
    </div>
  );
}

function themed<T extends { compiled: { theme: DemoTheme }; frame: { theme: DemoTheme } }>(bundle: T, theme: DemoTheme): T {
  return {
    ...bundle,
    compiled: { ...bundle.compiled, theme },
    frame: { ...bundle.frame, theme },
  };
}

function rendererScene(scene: CatalogueSceneDefinition, theme: DemoTheme, bundle: ReturnType<typeof textFixture>) {
  const next = themed(bundle, theme);
  return (
    <SceneChrome scene={scene}>
      <IosDemoRenderer compiled={next.compiled} frame={next.frame} />
    </SceneChrome>
  );
}

function Standalone({ theme, children }: { theme: DemoTheme; children: ReactNode }) {
  return (
    <div className={theme === "dark" ? "dark" : undefined} data-slot="ios-capture" style={{ width: iosScreen.width, height: iosScreen.height, position: "relative", pointerEvents: "none" }}>
      <PlatformProvider platform="ios">
        <PaletteStyle platform="ios" />
        <div data-im-platform="ios" style={{ position: "absolute", inset: 0, padding: 16 }}>
          {children}
        </div>
      </PlatformProvider>
    </div>
  );
}

export function IosCatalogueScene({ scene, theme }: CatalogueSceneProps) {
  if (scene.platform === "macos") {
    return (
      <SceneChrome scene={scene}>
        <p data-slot="catalogue-skip">This iOS catalogue does not mount the macOS shell.</p>
      </SceneChrome>
    );
  }

  switch (scene.id) {
    case "ios-text":
      return rendererScene(scene, theme, textFixture(theme));
    case "link":
      return rendererScene(scene, theme, linkFixture());
    case "image":
      return rendererScene(scene, theme, imageFixture());
    case "audio":
      return rendererScene(scene, theme, audioFixture());
    case "attachment":
      return rendererScene(scene, theme, attachmentFixture());
    case "typing":
      return rendererScene(scene, theme, typingFixture(360));
    case "bubble-effect":
      return rendererScene(scene, theme, inkFixture(800));
    case "tapback": {
      const base = textFixture(theme);
      const events = base.compiled.events.map((event) => {
        if (event.type !== "message") return event;
        if (event.message.id === "in-1") {
          return { ...event, message: { ...event.message, reactions: [{ id: "love-1", type: "love", byMe: true }] } };
        }
        if (event.message.id === "out-1") {
          return { ...event, message: { ...event.message, reactions: [{ id: "like-1", type: "like", byMe: false }] } };
        }
        return event;
      });
      const compiled = { ...base.compiled, events };
      return rendererScene(scene, theme, { compiled, frame: projectFrame(compiled, base.frame.timeMs) });
    }
    case "screen-effect":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "screen-effect", atMs: 5000 - screenEffectDuration("confetti") * 0.35, effect: "confetti" },
      ], 5000));
    case "facetime":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <FaceTimeCard state="invitation" platform="ios" />
          </Standalone>
        </SceneChrome>
      );
    case "system":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "notice", atMs: 1000, notice: { kind: "unknown-sender" } },
      ]));
    case "image-viewer":
      return rendererScene(scene, theme, extendFixture(imageFixture(), [
        { type: "overlay", atMs: 2000, overlay: { kind: "image-viewer", messageId: "image-1", index: 0 } },
      ]));
    case "effects-picker":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "overlay", atMs: 2000, overlay: { kind: "effects-picker", tab: "bubble", draft: "With effect" } },
      ]));
    case "reply-long-press":
      return rendererScene(scene, theme, replyFixture(theme, [
        { type: "overlay", atMs: 2000, overlay: { kind: "long-press", messageId: "reply" } },
      ]));
    case "thread":
      return rendererScene(scene, theme, replyFixture(theme, [
        { type: "overlay", atMs: 2000, overlay: { kind: "thread", rootId: "earlier" } },
      ]));
    case "plus-menu":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "overlay", atMs: 2000, overlay: { kind: "plus-menu" } },
      ]));
    case "details":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "overlay", atMs: 2000, overlay: { kind: "details" } },
      ]));
    case "photo-picker":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "overlay", atMs: 2000, overlay: { kind: "photo-picker" } },
      ]));
    case "edited":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "edit", atMs: 2000, messageId: "out-1", text: "See you there." },
      ]));
    case "editable-bubble":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <EditableBubble value="Edit this line" onChange={() => {}} onSubmit={() => {}} autoFocus={false} direction="outgoing" />
          </Standalone>
        </SceneChrome>
      );
    case "undo-send":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "remove", atMs: 5000 - undoSendPoof.duration * 0.35, messageId: "out-1" },
      ], 5000));
    case "controlled-audio":
      return rendererScene(scene, theme, extendFixture(audioFixture(), [
        { type: "audio-control", atMs: 0, messageId: "audio-1", position: 3, playing: false },
      ]));
    case "selection":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "overlay", atMs: 2000, overlay: { kind: "selection", messageIds: ["in-1"] } },
      ]));
    case "swipe-times":
      return rendererScene(scene, theme, extendFixture(textFixture(theme), [
        { type: "time-reveal", atMs: 2000, progress: 0.65 },
      ]));
    case "status":
      return rendererScene(scene, theme, statusFixture());
    case "service-color":
      return rendererScene(scene, theme, smsFixture());
    case "ios-list":
      return rendererScene(scene, theme, listFixture());
    case "new-message":
      return rendererScene(scene, theme, newMessageFixture());
    default:
      return (
        <SceneChrome scene={scene}>
          <p data-slot="catalogue-unmounted">{scene.summary}</p>
        </SceneChrome>
      );
  }
}
