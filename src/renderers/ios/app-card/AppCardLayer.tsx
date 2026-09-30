import { sheetAt, type SheetEvent } from "@/runtime/sheet";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { APP_CARD_DEFAULT_HEIGHT, type DemoMessage } from "@/contracts";
import { bubbleMetrics } from "@/components/imessage/tokens";
import { ApplePayOverlay, type ApplePayOverlayHandle } from "@/renderers/ios/apple-pay/ApplePayOverlay";
import { createCheckoutBridge, type BridgeDecision, type CheckoutBridge } from "@/renderers/ios/apple-pay/bridge";
import { CHECKOUT_ORIGINS_ENV, configuredCheckoutOrigins, resolveCheckoutEmbed, type CheckoutEmbed } from "./config";
import { SheetAppHost } from "../mini-app/sheet/SheetAppHost";
import { MiniAppDock } from "../mini-app/MiniAppDock";

/**
 * Live checkout and mini app cards (`kind: "app-card"`) in the iOS thread, plus the Apple Pay
 * presentation shared by checkout cards.
 *
 * The pinned message list has no slot for foreign content, so an app card is given to it as an
 * ordinary row (its clustering and gaps are the list's own) and this layer hides that row's
 * contents and docks a renderer-owned container in it. The iframe is portaled into that container,
 * which is never re-parented while the row lives, so opening and closing the sheet cannot reload it.
 */
export type AppCardMessage = DemoMessage & { kind: "app-card"; appCard: NonNullable<DemoMessage["appCard"]> };

export function isAppCardMessage(message: DemoMessage): message is AppCardMessage {
  return message.kind === "app-card" && message.appCard !== undefined;
}

export type PhotonPayTestHook = {
  setTime(seconds: number): void;
  play(): void;
  close(): void;
  openPicker(): boolean;
  selectCard(id: string): void;
  state(): { mode: string; visible: boolean; presenting: boolean; request: unknown; active: { frameId: string; requestId: string } | null; decisions: BridgeDecision[] };
};

declare global {
  interface Window {
    /** Test/capture hook for the Apple Pay presentation; no visible control uses it. */
    __photonPay?: PhotonPayTestHook;
  }
}

const cardWidth = bubbleMetrics.ios.maxWidth;
const cardRadius = bubbleMetrics.ios.radius;

function rowSelector(id: string): string {
  return `[data-slot="message-row"][data-message-id="${CSS.escape(id)}"]`;
}

export function AppCardLayer({ messages, frameRef, playing = false, finished = false, timeMs = 0, finalMessageId, sheetEvents = [] }: {
  messages: readonly DemoMessage[]; frameRef: RefObject<HTMLElement | null>;
  playing?: boolean; finished?: boolean; timeMs?: number; finalMessageId?: string; sheetEvents?: readonly SheetEvent[];
}) {
  const [activeSheet, setActiveSheet] = useState<{ id: string; revision: number } | null>(null);
  const previousTime = useRef(timeMs);
  const replayGeneration = useRef(0);
  const sheetGeneration = useRef(0);
  if (timeMs === 0 && previousTime.current > 0) replayGeneration.current += 1;
  if (timeMs < previousTime.current) { sheetGeneration.current += 1; if (activeSheet) setActiveSheet(null); }
  previousTime.current = timeMs;
  const overlayRef = useRef<ApplePayOverlayHandle>(null);
  const decisions = useRef<BridgeDecision[]>([]);
  const [bridge] = useState<CheckoutBridge>(() =>
    createCheckoutBridge({
      present: (request) => overlayRef.current?.open(request) ?? false,
      isBusy: () => Boolean(overlayRef.current?.presenting || overlayRef.current?.visible),
      onActiveFrameRemoved: () => overlayRef.current?.dismiss(),
      onDecision: (decision) => {
        decisions.current.push(decision);
        if (decisions.current.length > 50) decisions.current.shift();
      },
    }),
  );

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      bridge.handleMessage(event);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [bridge]);

  useEffect(() => {
    const hook: PhotonPayTestHook = {
      setTime: (seconds) => overlayRef.current?.setTime(seconds),
      play: () => overlayRef.current?.play(),
      close: () => overlayRef.current?.close(),
      openPicker: () => overlayRef.current?.openPicker() ?? false,
      selectCard: (id) => overlayRef.current?.selectCard(id),
      state: () => ({
        mode: overlayRef.current?.mode ?? "idle",
        visible: overlayRef.current?.visible ?? false,
        presenting: overlayRef.current?.presenting ?? false,
        request: overlayRef.current?.request ?? null,
        active: bridge.active(),
        decisions: [...decisions.current],
      }),
    };
    window.__photonPay = hook;
    return () => {
      if (window.__photonPay === hook) delete window.__photonPay;
    };
  }, [bridge]);

  const cards = messages.filter(isAppCardMessage);
  const timeline = sheetAt(sheetEvents, timeMs);
  const sheetId = activeSheet?.id ?? timeline.messageId;
  const sheetMessage = cards.find(card => card.id === sheetId && card.appCard.app === 'sheet');
  useEffect(() => { if (activeSheet && !sheetMessage) setActiveSheet(null); }, [activeSheet, sheetMessage]);
  const allowed = configuredCheckoutOrigins();
  const hideRule = cards.map((card) => `${rowSelector(card.id)} > :not([data-slot="app-card"])`).join(",");

  return (
    <>
      {hideRule ? <style data-slot="app-card-style">{`${hideRule}{display:none !important}`}</style> : null}
      {cards.map((card) => card.appCard.app === "miniapp" || card.appCard.app === "sheet" ? (
        <MiniAppDock key={`${card.id}:${replayGeneration.current}`} message={card} frameRef={frameRef}
          onOpenSheet={card.appCard.app === 'sheet' ? () => setActiveSheet(previous => ({ id: card.id, revision: (previous?.revision ?? 0) + 1 })) : undefined} />
      ) : (
        <AppCardDock key={`${card.id}:${replayGeneration.current}`} message={card} frameRef={frameRef} bridge={bridge} allowed={allowed}
          playing={playing} finished={finished} automatic={card.id === finalMessageId} />
      ))}
      {sheetMessage && <SheetAppHost key={`${sheetMessage.id}:${sheetGeneration.current}`} message={sheetMessage}
        frameRef={frameRef} openRevision={activeSheet?.revision ?? 0} scripted={activeSheet ? undefined : timeline.snapshot} scriptedTimeMs={timeMs} onClosed={() => {}} />}
      <ApplePayOverlay ref={overlayRef} onClosed={() => bridge.closed()} />
    </>
  );
}

function AppCardDock({
  message,
  frameRef,
  bridge,
  allowed,
  playing,
  finished,
  automatic,
}: {
  message: AppCardMessage;
  frameRef: RefObject<HTMLElement | null>;
  bridge: CheckoutBridge;
  allowed: readonly string[];
  playing: boolean;
  finished: boolean;
  automatic: boolean;
}) {
  const height = message.appCard.height ?? APP_CARD_DEFAULT_HEIGHT;
  const [container] = useState(() => {
    const element = document.createElement("div");
    element.dataset.slot = "app-card";
    element.dataset.loadCount = "0";
    return element;
  });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loads = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const armed = useRef(false);
  const presented = useRef(false);
  const mounted = useRef(false);
  const embed: CheckoutEmbed = useMemo(
    () => resolveCheckoutEmbed(message.appCard.url, allowed, window.location.origin),
    [message.appCard.url, allowed],
  );

  useLayoutEffect(() => {
    container.dataset.appCardId = message.id;
    container.dataset.direction = message.direction;
    container.dataset.embed = embed.ok ? "ready" : embed.reason;
    Object.assign(container.style, {
      position: "relative",
      width: `${cardWidth}px`,
      height: `${height}px`,
      borderRadius: `${cardRadius}px`,
      overflow: "hidden",
      background: "rgba(120, 120, 128, 0.16)",
      flex: "none",
    });
  }, [container, embed, height, message.direction, message.id]);

  // Dock into the list's row after every commit, and whenever the list mutates underneath (a screen
  // push re-creating the conversation layer). A container already in its row is left alone.
  const dock = useRef(() => {});
  dock.current = () => {
    const row = frameRef.current?.querySelector(rowSelector(message.id));
    if (row && container.parentElement !== row) row.appendChild(container);
  };
  useLayoutEffect(() => dock.current());
  useLayoutEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    const observer = new MutationObserver(() => dock.current());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [frameRef]);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode re-runs effects at once; only a real unmount leaves the container undocked.
      queueMicrotask(() => {
        if (!mounted.current) container.remove();
      });
    };
  }, [container]);

  useEffect(() => {
    if (!embed.ok) {
      console.error(`app card ${message.id}: checkout origin ${embed.origin ?? message.appCard.url} is not embeddable (${embed.reason})`);
      return;
    }
    return bridge.register({ id: message.id, origin: embed.origin, window: () => iframeRef.current?.contentWindow ?? null });
  }, [bridge, embed, message.id, message.appCard.url]);

  const title = message.text.trim() || "Checkout";
  useEffect(() => {
    if (playing) armed.current = true;
    else if (!finished) armed.current = false;
    if (!automatic || !loaded || !armed.current || presented.current || !embed.ok) return;
    // Let the last card settle before presenting. Cancellation never re-arms this mount.
    const timer = setTimeout(() => {
      if (presented.current) return;
      presented.current = true;
      iframeRef.current?.contentWindow?.postMessage({ type: "photon-pay:present", version: 1 }, embed.origin);
    }, 700);
    return () => clearTimeout(timer);
  }, [automatic, loaded, playing, finished, embed]);
  return createPortal(
    embed.ok ? (
      <iframe
        ref={iframeRef}
        data-slot="app-card-frame"
        title={title}
        src={embed.src}
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        onLoad={() => {
          loads.current += 1;
          container.dataset.loadCount = String(loads.current);
          setLoaded(true);
        }}
        style={{ display: "block", width: "100%", height: "100%", border: 0, background: "transparent", colorScheme: "normal" }}
      />
    ) : (
      <div data-slot="app-card-error" role="alert" style={{ padding: 16, font: "13px/1.35 -apple-system, BlinkMacSystemFont, sans-serif", color: "#8a8a8e" }}>
        {embed.reason === "origin-not-allowed"
          ? `Checkout origin ${embed.origin} is not in ${CHECKOUT_ORIGINS_ENV}.`
          : "This checkout URL cannot be embedded."}
      </div>
    ),
    container,
  );
}
