import { z } from "zod";
import { demoFlowSchema, platformSchema, type CompiledEvent, type DemoFlow, type DemoMessage, type DemoPlatform } from "@/contracts";

export const checkpointSchema = z.object({
  id: z.string().min(1),
  atMs: z.number().int(),
});

export const authoringDocumentSchema = demoFlowSchema.extend({
  targets: z.array(platformSchema).min(1).optional(),
  checkpoints: z.array(checkpointSchema).optional(),
});

export type AuthoringDocument = z.infer<typeof authoringDocumentSchema>;

export function toDemoFlow(document: AuthoringDocument, platform: DemoPlatform): DemoFlow {
  return {
    id: document.id,
    title: document.title,
    platform,
    theme: document.theme,
    contact: document.contact,
    nowMs: document.nowMs,
    draft: document.draft,
    typing: document.typing,
    screen: document.screen,
    messages: document.messages as DemoMessage[],
    ...(document.events ? { events: document.events as CompiledEvent[] } : {}),
  };
}

export function declaredTargets(document: AuthoringDocument, constraint?: DemoPlatform): DemoPlatform[] {
  const declared = document.targets ?? [document.platform];
  if (!constraint) return [...declared];
  if (!declared.includes(constraint)) return [];
  return [constraint];
}
