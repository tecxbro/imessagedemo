import type { ReactNode } from "react";
import type { CatalogueSceneProps } from "@/contracts";
import { PlatformProvider } from "@/components/imessage/platform";
import { PaletteStyle } from "@/components/imessage/palette";
import { MacMessagesApp, macScreen } from "@/components/imessage/macos-messages-app";
import type { Message } from "@/components/imessage/message-list";
import { FaceTimeCard } from "@/components/imessage/facetime-card";
import { SystemMessage } from "@/components/imessage/system-message";
import { ImageViewer } from "@/components/imessage/image-viewer";
import { ScreenEffect } from "@/components/imessage/screen-effects";
import { EditedLabel } from "@/components/imessage/message-edit";
import { UndoSendPoof } from "@/components/imessage/message-edit";
import { macSourceLimitations, rejectCatalogueScene } from "@/renderers/macos/limits";

const now = Date.parse("2026-09-21T16:41:00.000Z");
const pixel = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function text(id: string, textValue: string, direction: "incoming" | "outgoing", extra: Partial<Message> = {}): Message {
  return { id, text: textValue, direction, sentAt: now, status: direction === "outgoing" ? "delivered" : "read", ...extra };
}

function fixture(sceneId: string): { messages: Message[]; typing?: boolean } {
  switch (sceneId) {
    case "link":
      return { messages: [text("link-1", "https://example.com", "incoming", { kind: "link", link: { url: "https://example.com", title: "Example", host: "example.com" } })] };
    case "image":
      return { messages: [text("image-1", "", "incoming", { kind: "image", images: [{ src: pixel, alt: "A white pixel", width: 1, height: 1 }] })] };
    case "audio":
      return { messages: [text("audio-1", "", "outgoing", { kind: "audio", audio: { duration: 3, peaks: [0.2, 0.8, 0.4] } })] };
    case "attachment":
      return { messages: [text("file-1", "", "incoming", { kind: "attachment", attachments: [{ name: "Notes.txt", size: "2 KB" }] })] };
    case "typing":
      return { messages: [text("in-1", "Are you close?", "incoming")], typing: true };
    case "tapback":
      return { messages: [text("in-1", "Nice", "incoming", { reactions: [{ type: "love", byMe: true }] })] };
    case "bubble-effect":
      return { messages: [text("out-1", "Wow", "outgoing", { effect: "slam" })] };
    default:
      return {
        messages: [
          text("in-1", "Are you close?", "incoming"),
          text("out-1", "See you there.", "outgoing"),
        ],
      };
  }
}

function ShellFixture({ sceneId, theme }: { sceneId: string; theme: "light" | "dark" }) {
  const sample = fixture(sceneId);
  return (
    <div className={theme === "dark" ? "dark" : undefined} style={{ width: macScreen.width, height: macScreen.height }}>
      <MacMessagesApp
        active
        contact={{ name: "Alex Morgan", initials: "AM" }}
        conversations={[{ id: "alex", name: "Alex Morgan", initials: "AM", preview: "See you there.", time: "9:41 AM" }]}
        selectedId="alex"
        messages={sample.messages}
        typing={sample.typing}
        now={now}
        composer={{ value: "", onSend: () => undefined }}
      />
    </div>
  );
}

function Standalone({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  return (
    <div className={theme === "dark" ? "dark" : undefined} style={{ width: macScreen.width, height: macScreen.height, position: "relative" }}>
      <PlatformProvider platform="macos">
        <PaletteStyle platform="macos" />
        {children}
      </PlatformProvider>
    </div>
  );
}

export function MacCatalogueScene({ scene, theme }: CatalogueSceneProps) {
  const rejection = rejectCatalogueScene(scene);
  if (rejection) throw new Error(rejection.message);

  let captured: ReactNode;
  if (scene.tier === "catalogue-only" && scene.id === "facetime") {
    captured = <Standalone theme={theme}><FaceTimeCard platform="macos" state="invitation" /></Standalone>;
  } else if (scene.tier === "catalogue-only" && scene.id === "system") {
    captured = (
      <Standalone theme={theme}>
        <SystemMessage platform="macos" event={{ type: "participantAdded", actor: "Alex Morgan", participant: "Jordan Lee" }} />
        <EditedLabel platform="macos" direction="outgoing" />
        <UndoSendPoof progress={0}><span data-slot="unsend-sample">Unsent</span></UndoSendPoof>
      </Standalone>
    );
  } else if (scene.tier === "catalogue-only" && scene.id === "image-viewer") {
    captured = (
      <Standalone theme={theme}>
        <ImageViewer photos={[{ src: pixel, alt: "A white pixel", width: 1, height: 1 }]} open progress={1} title="Alex Morgan" subtitle="Today" />
      </Standalone>
    );
  } else if (scene.tier === "catalogue-only" && scene.id === "screen-effect") {
    captured = (
      <Standalone theme={theme}>
        <ScreenEffect kind="confetti" progress={0.5} />
      </Standalone>
    );
  } else if (scene.tier === "supported") {
    captured = <ShellFixture sceneId={scene.id} theme={theme} />;
  } else {
    throw new Error(`MacCatalogueScene rejects scene "${scene.id}" with no macOS fixture.`);
  }

  const notes = macSourceLimitations.filter((item) => scene.sourceAnchors.some((anchor) => item.summary.includes(anchor) || item.id === scene.id));
  return (
    <div data-mac-catalogue={scene.id}>
      <div data-slot="captured-scene" data-tier={scene.tier}>{captured}</div>
      <aside
        data-developer-metadata
        data-confidence={scene.tier}
        style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clipPath: "inset(50%)", whiteSpace: "nowrap" }}
      >
        <span>{scene.summary}</span>
        {notes.map((item) => (
          <span key={item.id} data-limitation={item.id} data-confidence={item.confidence}>{item.summary}</span>
        ))}
      </aside>
    </div>
  );
}
