import type { CompiledDemo, CompiledEvent, DemoMessage, RenderFrame } from "@/contracts";

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

function orderedEvents(events: CompiledEvent[]): CompiledEvent[] {
  return events.map((event, index) => ({ event, index })).sort((a, b) => a.event.atMs - b.event.atMs || a.index - b.index).map((entry) => entry.event);
}

/** Project a frame from frozen compiled events. This does not call the runtime lane. */
export function projectFrame(compiled: CompiledDemo, timeMs: number): RenderFrame {
  const messages: DemoMessage[] = [];
  let draft = "";
  let typing = false;
  for (const event of orderedEvents(compiled.events)) {
    if (event.atMs > timeMs) continue;
    if (event.type === "message") messages.push(event.message);
    if (event.type === "draft") draft = event.value;
    if (event.type === "typing") typing = event.typing;
  }
  return {
    timeMs,
    platform: compiled.platform,
    theme: compiled.theme,
    screen: compiled.screen,
    contact: compiled.contact,
    nowMs: compiled.nowMs,
    messages,
    typing,
    draft,
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
