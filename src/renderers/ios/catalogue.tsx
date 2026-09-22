import type { ReactNode } from "react";
import type { CatalogueSceneDefinition, CatalogueSceneProps, DemoTheme } from "@/contracts";
import motionTokens from "@/contracts/motion-tokens.json";
import { iosScreen } from "@/components/imessage/ios-messages-app";
import { PlatformProvider } from "@/components/imessage/platform";
import { PaletteStyle } from "@/components/imessage/palette";
import { FaceTimeCard } from "@/components/imessage/facetime-card";
import { SystemMessage } from "@/components/imessage/system-message";
import { ImageViewer } from "@/components/imessage/image-viewer";
import { ScreenEffect } from "@/components/imessage/screen-effects";
import { IosPlusMenu } from "@/components/imessage/ios-plus-menu";
import { IosDetails } from "@/components/imessage/ios-details";
import { PhotoPicker, photoPickerSamples } from "@/components/imessage/photo-picker";
import { EditableBubble, UndoSendPoof } from "@/components/imessage/message-edit";
import { MessageAudio } from "@/components/imessage/message-audio";
import { MessageBubble } from "@/components/imessage/message-bubble";
import { IosSelectMode, IosSelectionToolbar, MessageSelectionRow } from "@/components/imessage/ios-select-mode";
import { SwipeTimes, useSwipeToRevealTimes } from "@/components/imessage/ios-swipe-times";
import type { Message } from "@/components/imessage/message-list";
import { viewportRectToFrame } from "./geometry";
import { pixel, attachmentFixture, audioFixture, imageFixture, inkFixture, linkFixture, listFixture, newMessageFixture, nowMs, smsFixture, statusFixture, textFixture, typingFixture } from "./fixtures";
import { IosDemoRenderer, IosFrame } from "./scene";

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

const sentAt = nowMs - 60_000;

const replyMessages: Message[] = [
  { id: "earlier", text: "Earlier note", direction: "incoming", sentAt: nowMs - 180_000, replyCount: 1 },
  {
    id: "reply",
    text: "This reply",
    direction: "outgoing",
    sentAt,
    status: "delivered",
    replyTo: { id: "earlier", text: "Earlier note", direction: "incoming" },
  },
];

const scriptedSourceRect = viewportRectToFrame(
  { left: 0, top: 0, width: iosScreen.width * 2, height: iosScreen.height * 2 },
  { left: 80, top: 160, width: 200, height: 120 },
  iosScreen,
);

function rendererScene(scene: CatalogueSceneDefinition, theme: DemoTheme, bundle: ReturnType<typeof textFixture>) {
  const next = themed(bundle, theme);
  return (
    <SceneChrome scene={scene}>
      <IosDemoRenderer compiled={next.compiled} frame={next.frame} />
    </SceneChrome>
  );
}

function SwipePreview() {
  const swipe = useSwipeToRevealTimes({ progress: 0.65 });
  return (
    <SwipeTimes time="4:41" progress={swipe.progress}>
      <MessageBubble direction="incoming" tail>Swipe the row</MessageBubble>
    </SwipeTimes>
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
    case "tapback":
      return (
        <SceneChrome scene={scene}>
          <IosFrame
            compiled={textFixture(theme).compiled}
            frame={themed(textFixture(theme), theme).frame}
            shell={{
              messages: [
                { id: "in-1", text: "Are you close?", direction: "incoming", sentAt: nowMs - 120_000, reactions: [{ type: "love", byMe: true }] },
                { id: "out-1", text: "See you there.", direction: "outgoing", sentAt, status: "delivered", reactions: [{ type: "like", byMe: false }] },
              ],
            }}
          />
        </SceneChrome>
      );
    case "screen-effect":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} overlay={<ScreenEffect kind="confetti" progress={0.35} />} />
        </SceneChrome>
      );
    case "facetime":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <FaceTimeCard state="invitation" platform="ios" />
          </Standalone>
        </SceneChrome>
      );
    case "system":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <SystemMessage event={{ type: "unknownSender" }} platform="ios" />
          </Standalone>
        </SceneChrome>
      );
    case "image-viewer":
      return (
        <SceneChrome scene={scene}>
          <div data-source-rect={`${scriptedSourceRect.x} ${scriptedSourceRect.y} ${scriptedSourceRect.width} ${scriptedSourceRect.height}`} data-slot="scripted-source-rect" />
          <IosFrame
            compiled={imageFixture().compiled}
            frame={themed(imageFixture(), theme).frame}
            overlay={
              <ImageViewer
                photos={[{ src: pixel, alt: "Still", width: 4, height: 4 }]}
                open
                progress={1}
                sourceRect={scriptedSourceRect}
                frame={iosScreen}
                title="Alex Morgan"
                subtitle="4:41"
              />
            }
          />
        </SceneChrome>
      );
    case "effects-picker":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} shell={{ effectsPicker: { tab: "bubble", progress: 1, draft: "With effect" } }} />
        </SceneChrome>
      );
    case "reply-long-press":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} shell={{ messages: replyMessages, longPress: { id: "reply", progress: 1 } }} />
        </SceneChrome>
      );
    case "thread":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} shell={{ messages: replyMessages, thread: { rootId: "earlier", progress: 1 } }} />
        </SceneChrome>
      );
    case "plus-menu":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} overlay={<IosPlusMenu progress={1} />} />
        </SceneChrome>
      );
    case "details":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} overlay={<IosDetails name="Alex Morgan" initials="AM" phone="555-0100" progress={1} open />} />
        </SceneChrome>
      );
    case "photo-picker":
      return (
        <SceneChrome scene={scene}>
          <IosFrame compiled={textFixture(theme).compiled} frame={themed(textFixture(theme), theme).frame} overlay={<PhotoPicker photos={photoPickerSamples} selected={[]} open progress={1} />} />
        </SceneChrome>
      );
    case "edited":
      return (
        <SceneChrome scene={scene}>
          <IosFrame
            compiled={textFixture(theme).compiled}
            frame={themed(textFixture(theme), theme).frame}
            shell={{ messages: [{ id: "out-1", text: "See you there.", direction: "outgoing", sentAt, status: "delivered", edited: true }] }}
          />
        </SceneChrome>
      );
    case "editable-bubble":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <EditableBubble value="Edit this line" onChange={() => {}} onSubmit={() => {}} autoFocus={false} direction="outgoing" />
          </Standalone>
        </SceneChrome>
      );
    case "undo-send":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <UndoSendPoof progress={0.35}>
              <MessageBubble direction="outgoing" tail>Undo this send</MessageBubble>
            </UndoSendPoof>
          </Standalone>
        </SceneChrome>
      );
    case "controlled-audio":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <MessageAudio duration={8} position={3} playing={false} peaks={[0.2, 0.8, 0.4, 0.9, 0.3]} direction="incoming" tail />
          </Standalone>
        </SceneChrome>
      );
    case "selection":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <IosSelectMode progress={1}>
              <MessageSelectionRow selected progress={1} label="Select message">
                <MessageBubble direction="incoming" tail>Selected</MessageBubble>
              </MessageSelectionRow>
              <IosSelectionToolbar count={1} progress={1} />
            </IosSelectMode>
          </Standalone>
        </SceneChrome>
      );
    case "swipe-times":
      return (
        <SceneChrome scene={scene}>
          <Standalone theme={theme}>
            <SwipePreview />
          </Standalone>
        </SceneChrome>
      );
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
