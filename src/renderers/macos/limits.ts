import type { CatalogueSceneDefinition, RenderFrame } from "@/contracts";
import catalogueScenes from "@/contracts/catalogue-scenes.json";

export type MacRejection = {
  code: "platform" | "ios-only";
  message: string;
};

const iosOnlyScreens = new Set(["list", "new-message"]);

/** iOS surfaces that have no macOS counterpart in the pin. */
const iosOnlySceneIds = new Set(["effects-picker", "ios-text", "ios-list", "long-press", "ios-select"]);

export function rejectMacFrame(frame: Pick<RenderFrame, "platform" | "screen">): MacRejection | null {
  if (frame.platform !== "macos") {
    return { code: "platform", message: `MacDemoRenderer rejects platform "${frame.platform}".` };
  }
  if (iosOnlyScreens.has(frame.screen)) {
    return {
      code: "ios-only",
      message: `MacDemoRenderer rejects iOS screen "${frame.screen}". The macOS shell has no list or new-message screen.`,
    };
  }
  return null;
}

export function rejectCatalogueScene(scene: Pick<CatalogueSceneDefinition, "id" | "platform">): MacRejection | null {
  if (scene.platform === "ios" || iosOnlySceneIds.has(scene.id)) {
    return { code: "ios-only", message: `MacCatalogueScene rejects iOS-only scene "${scene.id}".` };
  }
  const known = catalogueScenes.scenes.some((item) => item.id === scene.id);
  if (!known) {
    return { code: "ios-only", message: `MacCatalogueScene rejects unknown scene "${scene.id}".` };
  }
  return null;
}

export type SourceLimitation = {
  id: string;
  confidence: "measured" | "source-export" | "unverified" | "catalogue-only" | "unsupported";
  summary: string;
};

/** Labels for developer metadata. They stay outside the captured window. */
export const macSourceLimitations: SourceLimitation[] = [
  {
    id: "mac-screen",
    confidence: "source-export",
    summary: "macScreen is 960×640 with a 330 sidebar, listTop 84.3 and listBottom 58.2.",
  },
  {
    id: "mac-window-metrics",
    confidence: "unverified",
    summary: "macWindowMetrics traffic-light centers are recorded unverified in motion-tokens.json.",
  },
  {
    id: "mac-transitions",
    confidence: "unverified",
    summary: "Conversation, selection, and menu timings are the pin's unverified macTransitions. No native switch capture is in the repo.",
  },
  {
    id: "screen-effect",
    confidence: "unverified",
    summary: "ScreenEffect durations are a well-known look, not a capture. The foundation compiler does not drive them.",
  },
  {
    id: "facetime-card",
    confidence: "catalogue-only",
    summary: "FaceTimeCard is standalone. It is not a MessageKind and is not inserted into the transcript.",
  },
  {
    id: "system-message",
    confidence: "catalogue-only",
    summary: "SystemMessage is standalone. The pinned MessageKind has no system variant.",
  },
  {
    id: "edit-unsend",
    confidence: "catalogue-only",
    summary: "EditedLabel and UndoSendPoof are catalogue visuals. edited on a message is the transcript field; unsend is not a new kind.",
  },
  {
    id: "arrival-reply-stub",
    confidence: "source-export",
    summary: "useArrivalAnimation selects the first [data-slot=message-bubble] inside the row. A reply stub is that node, so a reply message is not given a send or receive flight.",
  },
  {
    id: "icloud-footer",
    confidence: "unsupported",
    summary: "No sync-status footer is rendered unless a fixture sets scene.footer.",
  },
  {
    id: "polls-mini-apps",
    confidence: "unsupported",
    summary: "Polls and Photon mini apps are absent from the pin.",
  },
];
