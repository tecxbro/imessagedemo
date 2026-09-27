import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import type { CompiledDemo, RenderFrame, RendererHandle, RendererProps } from "@/contracts";
import { useBubbleEffectOnMessage } from "@/components/imessage/message-effects";
import { IosMessagesApp, iosScreen, type IosMessagesAppProps } from "@/components/imessage/ios-messages-app";
import type { IosConversation } from "@/components/imessage/ios-conversation-list";
import { ScreenEffect } from "@/components/imessage/screen-effects";
import { frameAt } from "@/runtime";
import type { VisualFrame } from "@/runtime";
import { toUpstreamMessage } from "./adapt";
import { statusClock } from "./clock";
import { cueToken, deriveCues, typingFreezeDelay, type CueState } from "./cues";
import { effectsPickerShellProps, screenEffectOverlayProps } from "./effects";
import { ImageViewerFromMedia, imageViewerFromFrame } from "./media";
import { screenTransitionShellProps } from "./navigation";
import { frameKey, projectFrame } from "./project";
import { settleIosScene, type IosSettleReceipt } from "./readiness";
import { applyCheckpointScroll } from "./scroll";
import { describeSelection, iosInteractionShell, type InteractionInput } from "./interaction-state";
import { iosInteractionView, undoSendOverlay, type OverlayRenderOptions } from "./overlays";
import { AppCardLayer } from "./app-card/AppCardLayer";

export type { IosSettleReceipt };

/** WT-06 assembly hook: derive shell + overlay nodes from a projected runtime frame. */
export function iosInteractionFromState(state: InteractionInput, options?: OverlayRenderOptions) {
  return {
    shell: iosInteractionShell(state),
    ...iosInteractionView(state, options),
  };
}


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

function demoIsPlaying(): boolean {
  return window.IMESSAGE_DEMO?.state().playing === true;
}

function freezeLoops(root: ParentNode, cues: CueState) {
  if (cues.typingElapsed !== null) {
    const elapsed = cues.typingElapsed ?? 0;
    const playing = demoIsPlaying();
    root.querySelectorAll<HTMLElement>('[data-slot="typing-indicator"] > span[data-dot]').forEach((dot) => {
      const index = Number(dot.dataset.dot ?? 0);
      const previous = Number(dot.dataset.typingElapsed);
      const jumped = !Number.isFinite(previous) || elapsed + 32 < previous || elapsed - previous > 80;
      dot.dataset.typingElapsed = String(elapsed);
      if (playing && !jumped && dot.style.animationPlayState === "running" && dot.dataset.typingDelay) {
        if (dot.style.animationDelay !== dot.dataset.typingDelay) dot.style.animationDelay = dot.dataset.typingDelay;
        return;
      }
      const delay = typingFreezeDelay(index, elapsed);
      dot.dataset.typingDelay = delay;
      dot.style.animationDelay = delay;
      dot.style.animationPlayState = playing ? "running" : "paused";
      if (!playing) {
        for (const animation of dot.getAnimations()) {
          animation.pause();
          try {
            animation.currentTime = 0;
          } catch {
            // The effect timing is not ready on the first layout.
          }
        }
      }
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
  const visual = useMemo(() => frameAt(compiled, shown.timeMs), [compiled, shown.timeMs]);
  const viewFrame: RenderFrame = {
    timeMs: visual.timeMs,
    platform: visual.platform,
    theme: visual.theme,
    screen: visual.screen,
    contact: visual.contact,
    nowMs: visual.nowMs,
    messages: visual.messages,
    typing: visual.typing,
    draft: visual.draft,
  };
  const cues = useMemo(() => deriveCues(compiled, viewFrame), [compiled, viewFrame]);
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

  const view = shellProps(visual, cues, posed, interactive, onDraft);
  const canonicalOverlay = canonicalOverlayNode(compiled, visual);
  const hostsAppCards = useMemo(() => compiledHasAppCards(compiled), [compiled]);
  const baseOverlay = overlay ?? shell?.overlay ?? canonicalOverlay;
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
        screenTransition={shell?.screenTransition ?? view.screenTransition}
        typing={view.typing}
        composer={shell?.composer ?? view.composer}
        sendAnimation={view.sendAnimation}
        receiveAnimation={view.receiveAnimation}
        longPress={shell?.longPress ?? view.longPress}
        thread={shell?.thread ?? view.thread}
        effectsPicker={shell?.effectsPicker ?? view.effectsPicker}
        audioControl={shell?.audioControl ?? view.audioControl}
        timeReveal={shell?.timeReveal ?? view.timeReveal}
        overlay={
          hostsAppCards ? (
            <>
              {baseOverlay}
              <AppCardLayer messages={visual.messages} frameRef={frameRef} />
            </>
          ) : (
            baseOverlay
          )
        }
        style={shell?.style}
      />
    </div>
  );
});

function shellProps(frame: VisualFrame, cues: CueState, posed: boolean, interactive: boolean, onDraft?: (value: string) => void): IosMessagesAppProps {
  const interaction = iosInteractionShell(frame);
  const selection = describeSelection(frame);
  const transition = screenTransitionShellProps(frame);
  return {
    width: iosScreen.width,
    height: iosScreen.height,
    time: statusClock(frame.nowMs),
    screen: frame.screen,
    screenTransition: transition ?? { from: frame.screen, progress: 1 },
    conversations: conversationsFor({
      timeMs: frame.timeMs,
      platform: frame.platform,
      theme: frame.theme,
      screen: frame.screen,
      contact: frame.contact,
      nowMs: frame.nowMs,
      messages: frame.messages,
      typing: frame.typing,
      draft: frame.draft,
    }),
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
    longPress: interaction.longPress,
    thread: interaction.thread,
    selection: selection
      ? { active: selection.open, progress: selection.progress, messageIds: selection.messageIds }
      : null,
    effectsPicker: effectsPickerShellProps(frame),
    audioControl: frame.audio,
    timeReveal: frame.timeReveal,
  };
}

/** Only a flow that authors a live app card mounts the card layer and its Apple Pay presentation. */
function compiledHasAppCards(compiled: CompiledDemo): boolean {
  return (
    compiled.events.some((event) => event.type === "message" && event.message.kind === "app-card") ||
    Boolean(compiled.initialState?.conversations?.some((conversation) => conversation.messages?.some((message) => message.kind === "app-card")))
  );
}

function canonicalOverlayNode(compiled: CompiledDemo, frame: VisualFrame): ReactNode {
  const interaction = iosInteractionView(frame, { contact: frame.contact, selectionInList: true });
  const viewer = imageViewerFromFrame(frame);
  const effect = screenEffectOverlayProps(frame);
  return (
    <>
      {interaction.notices}
      {interaction.overlays}
      {viewer.photos.length > 0 && (viewer.open || viewer.progress > 0) ? <ImageViewerFromMedia viewer={viewer} /> : null}
      {effect ? <ScreenEffect kind={effect.kind} progress={effect.progress} /> : null}
      {undoSendOverlay(compiled, frame.timeMs)}
    </>
  );
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
