import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import { cardById, defaultCardId, paymentCards, presentationAssets, type PaymentCardId } from "./cards";
import { amountFontSize, formatMoney, type ValidCheckoutRequest } from "./checkout";
import {
  PresentationController,
  type ClosedDetail,
  type FocusTarget,
  type PresentationClock,
  type PresentationMode,
  type PresentationView,
} from "./controller";
import { sheet as sheetBox, source, type MotionState } from "./motion";
import "./apple-pay.css";

export type ApplePayOverlayHandle = {
  /** Validates, then opens once. Returns false while a presentation is already showing. */
  open(request: unknown): boolean;
  close(): void;
  /** Remove the sheet at once and forget its checkout (its card left the thread). */
  dismiss(): void;
  /** Test/capture only: play the complete recorded sequence. */
  play(): void;
  /** Test/capture only: show the recorded state at `seconds` (0–13.933). */
  setTime(seconds: number): void;
  /** Test/capture only: validate and show a checkout's values without opening. */
  setRequest(request: unknown): void;
  openPicker(): boolean;
  closePicker(): void;
  selectCard(id: string): void;
  readonly presenting: boolean;
  readonly visible: boolean;
  readonly mode: PresentationMode;
  readonly request: ValidCheckoutRequest | null;
  readonly element: HTMLDivElement | null;
};

export type ApplePayOverlayProps = {
  /** Keep the provisional card-picker extension reachable from "Other Cards & Pay Later Options". */
  enablePicker?: boolean;
  /** Defaults to the `prefers-reduced-motion` media query. */
  reducedMotion?: boolean;
  clock?: PresentationClock;
  onClosed?: (detail: ClosedDetail) => void;
  onPlayEnded?: () => void;
  ref?: Ref<ApplePayOverlayHandle>;
};

/** The recorded front-card pose used whenever a card other than the captured red card is selected. */
const alternateCardRect = { x: 132, y: 208, w: 248, h: 157 } as const;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The recreated Apple Pay sheet. One instance covers the whole phone surface it is mounted in: it is an
 * absolutely positioned sibling above the conversation, and scales the recording's 512 × 1112 plane
 * into its host, bottom-aligned. It never calls ApplePaySession, opens windows, reads Wallet, or pays.
 */
export function ApplePayOverlay({ enablePicker = true, reducedMotion, clock, onClosed, onPlayEnded, ref }: ApplePayOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const otherRef = useRef<HTMLButtonElement>(null);
  const pickerBackRef = useRef<HTMLButtonElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLImageElement>(null);
  const rightRef = useRef<HTMLImageElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<PresentationController | null>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);
  const callbacks = useRef({ onClosed, onPlayEnded });
  callbacks.current = { onClosed, onPlayEnded };
  const [view, setView] = useState<PresentationView>({ request: null, selectedCardId: defaultCardId, pickerOpen: false });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const plane = planeRef.current;
    const sheet = sheetRef.current;
    if (!root || !plane || !sheet) return;
    const reduce = reducedMotion ?? prefersReducedMotion();
    let previousFocus: Element | null = null;
    const inerted: Array<{ element: HTMLElement; was: boolean }> = [];

    const setBackgroundInert = (inert: boolean) => {
      if (inert) {
        for (const element of Array.from(root.parentElement?.children ?? [])) {
          if (element === root || !(element instanceof HTMLElement)) continue;
          inerted.push({ element, was: element.inert });
          element.inert = true;
        }
        return;
      }
      for (const { element, was } of inerted.splice(0)) element.inert = was;
    };

    const applyFrame = (state: MotionState, edges: { becameVisible: boolean; becameHidden: boolean; mode: PresentationMode }) => {
      const controller = controllerRef.current;
      if (edges.becameVisible || edges.becameHidden) {
        root.dataset.visible = String(state.visible);
        sheet.setAttribute("aria-hidden", String(!state.visible));
        sheet.inert = !state.visible;
        if (state.visible) {
          previousFocus = document.activeElement;
          setBackgroundInert(true);
        } else {
          setBackgroundInert(false);
          if (previousFocus instanceof HTMLElement && previousFocus.isConnected && edges.mode !== "play") previousFocus.focus({ preventScroll: true });
          previousFocus = null;
        }
      }
      sheet.style.transform = `translate(${sheetBox.x}px, ${state.top}px)`;
      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.opacity = String(state.dim);
        scrim.hidden = state.dim < 0.0001;
      }
      sheet.hidden = !state.visible;
      if (homeRef.current) homeRef.current.hidden = !state.visible;
      // The tap arrives from the checkout's own document, so focusing the close control here would
      // paint a focus ring the recording does not have. Focus the dialog; Tab reaches Close first.
      if (edges.becameVisible && edges.mode === "interactive") sheet.focus({ preventScroll: true });
      closeRef.current?.classList.toggle("is-pressed", state.pressed);
      const alternate = (controller?.selectedCardId ?? defaultCardId) !== defaultCardId;
      const rect = alternate ? alternateCardRect : { x: state.cardX, y: state.cardY, w: state.cardW, h: state.cardH };
      const front = frontRef.current;
      if (front) Object.assign(front.style, { left: `${rect.x - sheetBox.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
      const p = alternate ? 1 : state.expand;
      // The side cards grow in height before receding behind the front card.
      // This fitted pose is an approximation, not a recovered native 3D transform.
      const retreat = 50 * Math.pow(p, 2.4);
      const leftH = 80 + 64 * p;
      const rightH = 81 + 64 * p;
      const leftW = (61 * leftH) / 80;
      const rightW = (61 * rightH) / 81;
      const left = leftRef.current;
      const right = rightRef.current;
      if (left) Object.assign(left.style, { left: `${85 + retreat}px`, top: `${247 - 32 * p}px`, width: `${leftW}px`, height: `${leftH}px`, opacity: p >= 0.99 ? "0" : "1" });
      if (right) Object.assign(right.style, { left: `${408 - retreat - rightW}px`, top: `${246 - 32 * p}px`, width: `${rightW}px`, height: `${rightH}px`, opacity: p >= 0.99 ? "0" : "1" });
      if (spinnerRef.current) spinnerRef.current.style.transform = `rotate(${reduce ? 0 : state.time * 360}deg)`;
      root.dataset.sourceFrame = state.sourceFrame === null ? "interactive" : String(state.sourceFrame);
      root.dataset.mode = edges.mode;
    };

    const controller = new PresentationController(
      {
        frame: applyFrame,
        view: (next, focus) => {
          if (focus) pendingFocus.current = focus;
          setView(next);
        },
        closed: (detail) => {
          root.dataset.mode = "idle";
          callbacks.current.onClosed?.(detail);
        },
        playEnded: () => {
          root.dataset.mode = "idle";
          callbacks.current.onPlayEnded?.();
        },
      },
      { reducedMotion: reduce, enablePicker, clock },
    );
    controllerRef.current = controller;

    const resize = () => {
      const w = root.clientWidth;
      const h = root.clientHeight;
      const s = Math.min(w / source.width, h / source.height);
      plane.style.transform = `translate(${(w - source.width * s) / 2}px, ${h - source.height * s}px) scale(${s})`;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!controller.visible && !controller.presenting) return;
      if (event.key === "Escape") {
        event.preventDefault();
        controller.escape();
        return;
      }
      if (event.key !== "Tab" || !controller.visible) return;
      const buttons = Array.from(sheet.querySelectorAll<HTMLButtonElement>("button:not([disabled])")).filter((button) => button.getClientRects().length > 0);
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      const focused = document.activeElement;
      if (event.shiftKey && (focused === first || !sheet.contains(focused))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (focused === last || !sheet.contains(focused))) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    root.dataset.visible = "false";
    sheet.hidden = true;
    sheet.inert = true;
    sheet.setAttribute("aria-hidden", "true");
    applyFrame(controller.lastState, { becameVisible: false, becameHidden: false, mode: controller.mode });

    return () => {
      const wasVisible = controller.visible;
      controller.destroy();
      controllerRef.current = null;
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown);
      setBackgroundInert(false);
      if (wasVisible && previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [clock, enablePicker, reducedMotion]);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element = target === "other" ? otherRef.current : pickerBackRef.current;
    element?.focus({ preventScroll: true });
  }, [view]);

  useImperativeHandle(
    ref,
    () => ({
      open: (request) => controllerRef.current?.open(request) ?? false,
      close: () => controllerRef.current?.close(),
      dismiss: () => controllerRef.current?.dismiss(),
      play: () => controllerRef.current?.play(),
      setTime: (seconds) => controllerRef.current?.setTime(seconds),
      setRequest: (request) => {
        controllerRef.current?.setRequest(request);
      },
      openPicker: () => controllerRef.current?.openPicker() ?? false,
      closePicker: () => controllerRef.current?.closePicker(),
      selectCard: (id) => controllerRef.current?.selectCard(id),
      get presenting() {
        return controllerRef.current?.presenting ?? false;
      },
      get visible() {
        return controllerRef.current?.visible ?? false;
      },
      get mode() {
        return controllerRef.current?.mode ?? "idle";
      },
      get request() {
        return controllerRef.current?.request ?? null;
      },
      get element() {
        return rootRef.current;
      },
    }),
    [],
  );

  const request = view.request;
  const formatted = request ? formatMoney(request) : "";
  const card = cardById(view.selectedCardId) ?? paymentCards[0];
  const selectCard = (id: PaymentCardId) => controllerRef.current?.selectCard(id);

  return (
    <div ref={rootRef} className="pp-host" data-photon-pay-overlay="" data-selected-card={card.id} data-picker={view.pickerOpen ? "open" : "closed"}>
      <div ref={scrimRef} className="pp-scrim" aria-hidden="true" />
      <div ref={planeRef} className="pp-plane">
        <section ref={sheetRef} className="pp-sheet" role="dialog" aria-modal="true" aria-label="Apple Pay checkout" tabIndex={-1}>
          <button ref={closeRef} type="button" className="pp-close" aria-label="Close Apple Pay" onClick={() => controllerRef.current?.close()}>
            <span />
            <span />
          </button>
          <img className="pp-logo" alt="Apple Pay" src={presentationAssets.lockup} />
          <div className="pp-content" hidden={view.pickerOpen}>
            <div className="pp-merchant" data-slot="apple-pay-merchant">{request ? `Pay ${request.merchantLabel}` : ""}</div>
            <div className="pp-amount" data-amount="primary" style={{ fontSize: `${amountFontSize(formatted)}px` }}>
              {formatted}
            </div>
            <div className="pp-fan">
              <img ref={leftRef} className="pp-side pp-side-left" alt="" src={presentationAssets.leftStrip} />
              <img ref={rightRef} className="pp-side pp-side-right" alt="" src={presentationAssets.rightStrip} />
              <div ref={frontRef} className="pp-front" data-partial={String(card.partial)} data-card={card.id}>
                <img className="pp-front-image" alt={card.label + (card.lastFour ? ` ending in ${card.lastFour}` : "")} src={card.asset} />
              </div>
            </div>
            <button ref={otherRef} type="button" className="pp-other" onClick={() => controllerRef.current?.openPicker()}>
              Other Cards &amp; Pay Later Options
            </button>
            <div className="pp-summary">
              <img className="pp-payment-icon" alt="" src={presentationAssets.paymentIcon} />
              <div className="pp-card-label">{card.label}</div>
              <div className="pp-pay-line" data-amount="pay-line">
                {formatted ? `Pay ${formatted}` : ""}
              </div>
            </div>
            <div className="pp-total">
              <span>Total</span>
              <span data-amount="total">{formatted}</span>
            </div>
            <div className="pp-domain" data-slot="apple-pay-domain">{request?.domain ?? ""}</div>
            <div ref={spinnerRef} className="pp-spinner" role="status" aria-label="Loading payment details">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeDasharray="72 16" />
              </svg>
            </div>
          </div>
          <div className="pp-picker" hidden={!view.pickerOpen}>
            <button ref={pickerBackRef} type="button" className="pp-picker-back" onClick={() => controllerRef.current?.closePicker()}>
              Back
            </button>
            <h2 className="pp-picker-heading">Cards</h2>
            <div className="pp-picker-list" role="group" aria-label="Choose a card">
              {paymentCards.map((item) => (
                <button key={item.id} type="button" className="pp-picker-card" data-card={item.id} aria-pressed={item.id === card.id} onClick={() => selectCard(item.id)}>
                  <img className={`pp-picker-thumb${item.partial ? " pp-partial" : ""}`} alt="" src={item.asset} />
                  <span>{item.label + (item.lastFour ? ` •••• ${item.lastFour}` : "")}</span>
                  <span className="pp-selection-mark" aria-hidden="true">
                    ✓
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
        {/* The recording's home indicator over the open sheet. The pinned iOS shell draws none, so this cannot double. */}
        <div ref={homeRef} className="pp-home" aria-hidden="true" />
      </div>
    </div>
  );
}
