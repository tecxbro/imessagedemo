export { MacDemoRenderer } from "@/renderers/macos/renderer";
export { MacCatalogueScene } from "@/renderers/macos/catalogue";
export { mapDemoMessage, previewFromMessage, resolveMacScene, macConversationId, macMotionDurations } from "@/renderers/macos/map-message";
export { macSourceLimitations, rejectMacFrame, rejectCatalogueScene } from "@/renderers/macos/limits";
export { initialSwitchPhase, nextSwitchPhase, isSwitchAligned } from "@/renderers/macos/switch-phase";
export type {
  MacDemoRendererProps,
  MacRendererHandle,
  MacSceneInput,
  MacConversationInput,
  MacArrival,
  ReadinessReceipt,
} from "@/renderers/macos/types";
