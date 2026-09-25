import type { CompiledDemo, CompiledEvent, DemoMessage, RenderFrame } from "@/contracts";
import { frameAt } from "@/runtime/project";

export function frameKey(frame: RenderFrame): string {
  return JSON.stringify({
    timeMs: frame.timeMs,
    platform: frame.platform,
    theme: frame.theme,
    screen: frame.screen,
    contact: frame.contact,
    nowMs: frame.nowMs,
    typing: frame.typing,
    draft: frame.draft,
    messages: frame.messages,
  });
}

/**
 * View of the canonical runtime projection.
 * Semantic timeline state stays in src/runtime/project.ts.
 */
export function projectFrame(compiled: CompiledDemo, timeMs: number): RenderFrame {
  const frame = frameAt(compiled, timeMs);
  return {
    timeMs: frame.timeMs,
    platform: frame.platform,
    theme: frame.theme,
    screen: frame.screen,
    contact: frame.contact,
    nowMs: frame.nowMs,
    messages: frame.messages,
    typing: frame.typing,
    draft: frame.draft,
  };
}

/** Build compiled events so a direct RenderFrame can be seeked without the compiler lane. */
export function compileFrame(frame: RenderFrame, messageAt: (message: DemoMessage, index: number) => number = () => 0): CompiledDemo {
  const events: CompiledEvent[] = [
    ...frame.messages.map((message, index) => ({ type: "message" as const, atMs: messageAt(message, index), message })),
    { type: "draft" as const, atMs: 0, value: frame.draft },
    { type: "typing" as const, atMs: 0, typing: frame.typing },
  ];
  const durationMs = events.reduce((max, event) => Math.max(max, event.atMs), frame.timeMs);
  return {
    id: "ios-frame",
    platform: frame.platform,
    theme: frame.theme,
    durationMs,
    contact: frame.contact,
    nowMs: frame.nowMs,
    screen: frame.screen,
    events,
  };
}
