import {
  demoFlowSchema,
  type CompiledDemo,
  type DemoFlow,
  type PlaybackState,
  type Player,
  type RenderFrame,
  type ValidationIssue,
  type ValidationResult,
} from "@/contracts";

export function validateDemoDouble(input: unknown): ValidationResult {
  const parsed = demoFlowSchema.safeParse(input);
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    return { ok: false, issues };
  }
  return { ok: true, demo: parsed.data };
}

export function compileDemoDouble(demo: DemoFlow): CompiledDemo {
  const events = [
    ...demo.messages.map((message, index) => ({ type: "message" as const, atMs: index * 1000, message })),
    { type: "draft" as const, atMs: 0, value: demo.draft },
    { type: "typing" as const, atMs: 0, typing: demo.typing },
  ];
  const durationMs = events.reduce((max, event) => Math.max(max, event.atMs), 0);
  return {
    id: demo.id,
    platform: demo.platform,
    theme: demo.theme,
    durationMs,
    contact: demo.contact,
    nowMs: demo.nowMs,
    screen: demo.screen,
    events,
  };
}

export function frameAtDouble(compiled: CompiledDemo, timeMs: number): RenderFrame {
  const messages = compiled.events
    .filter((event) => event.type === "message" && event.atMs <= timeMs)
    .map((event) => (event.type === "message" ? event.message : null))
    .filter((message) => message !== null);
  const draft = [...compiled.events].reverse().find((event) => event.type === "draft" && event.atMs <= timeMs);
  const typing = [...compiled.events].reverse().find((event) => event.type === "typing" && event.atMs <= timeMs);
  return {
    timeMs,
    platform: compiled.platform,
    theme: compiled.theme,
    screen: compiled.screen,
    contact: compiled.contact,
    nowMs: compiled.nowMs,
    messages,
    typing: typing?.type === "typing" ? typing.typing : false,
    draft: draft?.type === "draft" ? draft.value : "",
  };
}

export function stateAtDouble(compiled: CompiledDemo, timeMs: number): PlaybackState {
  return { timeMs, playing: false, durationMs: compiled.durationMs };
}

export function createPlayerDouble(compiled: CompiledDemo): Player {
  let timeMs = 0;
  return {
    play() {},
    pause() {},
    seek(next) {
      timeMs = next;
    },
    state: () => stateAtDouble(compiled, timeMs),
    frame: () => frameAtDouble(compiled, timeMs),
  };
}
