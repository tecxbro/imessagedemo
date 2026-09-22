import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type { CompiledDemo, RenderFrame, RendererHandle, RendererProps } from "@/contracts";
import { useBubbleEffectOnMessage } from "@/components/imessage/message-effects";
import { IosMessagesApp, iosScreen, type IosMessagesAppProps } from "@/components/imessage/ios-messages-app";
import type { IosConversation } from "@/components/imessage/ios-conversation-list";
import { toUpstreamMessage } from "./adapt";
import { statusClock } from "./clock";
import { cueToken, deriveCues, typingFreezeDelay, type CueState } from "./cues";
import { frameKey, projectFrame } from "./project";
import { settleIosScene, type IosSettleReceipt } from "./readiness";
import { applyCheckpointScroll } from "./scroll";

export type { IosSettleReceipt };

export type IosRendererHandle = RendererHandle & {
  readonly revision: number;
  settle(revision: number): Promise<IosSettleReceipt>;
};

type Session = {
  revision: number;
  key: string;
  override: RenderFrame | null;
  shown: RenderFrame;
  cues: CueState;
};

const emptyCues: CueState = { bubbleEffect: null, typingElapsed: null, inkElapsed: [] };

function conversationsFor(frame: RenderFrame): IosConversation[] {
  const latest = frame.messages[frame.messages.length - 1];
  return [{
    id: "contact",
    name: frame.contact.name,
    initials: frame.contact.initials,
    preview: latest?.text || frame.draft || frame.contact.name,
    time: statusClock(frame.nowMs),
  }];
}

function freezeLoops(root: ParentNode, cues: CueState) {
  if (cues.typingElapsed !== null) {
    root.querySelectorAll<HTMLElement>('[data-slot="typing-indicator"] > span[data-dot]').forEach((dot) => {
      const index = Number(dot.dataset.dot ?? 0);
      dot.style.animationDelay = typingFreezeDelay(index, cues.typingElapsed ?? 0);
      dot.style.animationPlayState = "paused";
    });
  }
  for (const ink of cues.inkElapsed) {
    const row = root.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(ink.id)}"]`);
    row?.querySelectorAll<HTMLElement>('[data-slot="invisible-ink"] [data-slot="text"], [data-slot="invisible-ink"] [data-slot="ink-target"]').forEach((node) => {
      node.style.animationDelay = `-${ink.elapsed}ms`;
      node.style.animationPlayState = "paused";
    });
  }
}

export type IosFrameProps = RendererProps & {
  interactive?: boolean;
  onDraft?: (value: string) => void;
  overlay?: ReactNode;
  shell?: Partial<IosMessagesAppProps>;
};

export const IosFrame = forwardRef<RendererHandle, IosFrameProps>(function IosFrame({ compiled, frame, interactive = false, onDraft, overlay, shell }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const compiledRef = useRef(compiled);
  compiledRef.current = compiled;
  const session = useRef<Session>({
    revision: 0,
    key: "",
    override: null,
    shown: frame,
    cues: emptyCues,
  });
  const [, setTick] = useState(0);
  const propsKey = frameKey(frame);
  const propsKeyRef = useRef<string | null>(null);
  if (propsKeyRef.current !== propsKey) {
    propsKeyRef.current = propsKey;
    session.current.override = null;
    session.current.key = propsKey;
    session.current.revision += 1;
  }
  const shown = session.current.override ?? frame;
  session.current.shown = shown;
  const cues = useMemo(() => deriveCues(compiled, shown), [compiled, shown]);
  session.current.cues = cues;
  const token = cueToken(cues);
  const committedKey = session.current.key;
  const [poseKey, setPoseKey] = useState<string | null>(null);
  const posed = poseKey === committedKey;
  const bubbleEffect = useMemo(() => (posed ? cues.bubbleEffect : null), [posed, token, cues.bubbleEffect]);
  useBubbleEffectOnMessage(frameRef, bubbleEffect);

  useLayoutEffect(() => {
    const shellNode = frameRef.current;
    if (shellNode) {
      applyCheckpointScroll(shellNode);
      freezeLoops(shellNode, session.current.cues);
    }
    if (poseKey !== committedKey) setPoseKey(committedKey);
  }, [committedKey, poseKey, token]);

  const handleRef = useRef<IosRendererHandle | null>(null);
  if (!handleRef.current) {
    handleRef.current = {
      seek(timeMs: number) {
        const next = projectFrame(compiledRef.current, timeMs);
        session.current.override = next;
        session.current.key = frameKey(next);
        session.current.revision += 1;
        setTick((value) => value + 1);
      },
      get element() {
        return frameRef.current;
      },
      get revision() {
        return session.current.revision;
      },
      settle(revision: number) {
        const host = hostRef.current;
        if (!host) return Promise.reject(new Error("missing node: ios-demo-renderer"));
        return settleIosScene({
          host,
          shell: frameRef.current,
          frame: session.current.shown,
          cues: session.current.cues,
          revision: () => session.current.revision,
          expectedRevision: revision,
        });
      },
    };
  }
  useImperativeHandle(ref, () => handleRef.current as IosRendererHandle, []);

  const view = shellProps(shown, cues, posed, interactive, onDraft);
  return (
    <div
      ref={hostRef}
      data-slot="ios-demo-renderer"
      data-theme={shown.theme}
      data-posed={posed ? "true" : "false"}
      data-time={shown.timeMs}
      data-revision={session.current.revision}
      className={shown.theme === "dark" ? "dark" : undefined}
      style={{ width: iosScreen.width, height: iosScreen.height }}
      onClickCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("a")) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <IosMessagesApp
        {...view}
        {...(shell ?? {})}
        messages={shell?.messages ?? view.messages}
        frameRef={frameRef}
        width={iosScreen.width}
        height={iosScreen.height}
        time={view.time}
        now={view.now}
        screen={view.screen}
        screenTransition={view.screenTransition}
        typing={view.typing}
        composer={shell?.composer ?? view.composer}
        sendAnimation={view.sendAnimation}
        receiveAnimation={view.receiveAnimation}
        overlay={overlay ?? shell?.overlay}
        style={{ ...shell?.style, pointerEvents: interactive ? undefined : "none" }}
      />
    </div>
  );
});

function shellProps(frame: RenderFrame, cues: CueState, posed: boolean, interactive: boolean, onDraft?: (value: string) => void): IosMessagesAppProps {
  return {
    width: iosScreen.width,
    height: iosScreen.height,
    time: statusClock(frame.nowMs),
    screen: frame.screen,
    screenTransition: { from: frame.screen, progress: 1 },
    conversations: conversationsFor(frame),
    contact: frame.contact,
    group: false,
    messages: frame.messages.map(toUpstreamMessage),
    typing: frame.typing,
    now: frame.nowMs,
    composer: {
      value: frame.draft,
      onChange: interactive && onDraft ? onDraft : () => {},
    },
    sendAnimation: posed && cues.send ? cues.send : null,
    receiveAnimation: posed && cues.receive ? cues.receive : null,
  };
}

export const IosDemoRenderer = forwardRef<RendererHandle, RendererProps>(function IosDemoRenderer(props, ref) {
  return <IosFrame {...props} ref={ref} />;
});

export function IosInspectSession({ compiled, frame }: RendererProps) {
  const [draft, setDraft] = useState(frame.draft);
  const [mark, setMark] = useState(0);
  const [generation, setGeneration] = useState(0);
  const shown = { ...frame, draft };
  return (
    <div data-slot="ios-inspect">
      <div data-slot="inspect-labels">
        <span>Inspect</span>
        <button type="button" onClick={() => setMark((value) => value + 1)}>Mark</button>
        <span data-slot="inspect-mark">{mark}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(frame.draft);
            setMark(0);
            setGeneration((value) => value + 1);
          }}
        >
          Reset
        </button>
      </div>
      <IosFrame key={generation} compiled={compiled} frame={shown} interactive onDraft={setDraft} />
    </div>
  );
}

export function bindIosHandle(ref: Ref<RendererHandle> | null | undefined): IosRendererHandle | null {
  if (!ref || typeof ref === "function") return null;
  const current = ref.current;
  if (!current || !("settle" in current)) return null;
  return current as IosRendererHandle;
}
