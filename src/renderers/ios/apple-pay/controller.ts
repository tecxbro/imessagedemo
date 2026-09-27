import { cardById, defaultCardId, type PaymentCardId } from "./cards";
import { validateRequest, type ValidCheckoutRequest } from "./checkout";
import { closingStateAt, motionDuration, openStateAt, stateAt, type MotionState } from "./motion";

/**
 * The presentation's state machine, ported from the recreation package's `PayOverlay` without its DOM.
 *
 * - `interactive`: a manual open. Replays the first recorded presentation and holds on the pending pose.
 * - `selected`: a fixture card was chosen in the (unrecorded) picker extension; holds the 4.5 s pose.
 * - `closing`: leaving along the measured exit track from wherever the sheet is.
 * - `seek` / `play`: the recorded 13.933 s sequence, for deterministic captures and tests only.
 */
export type PresentationMode = "idle" | "interactive" | "selected" | "closing" | "seek" | "play";

export type PresentationView = {
  request: ValidCheckoutRequest | null;
  selectedCardId: PaymentCardId;
  pickerOpen: boolean;
};

export type FocusTarget = "other" | "picker-back";

export type ClosedDetail = { reason: "cancelled"; selectedCardId: PaymentCardId };

export type PresentationSink = {
  /** Every animation frame: geometry only. `becameVisible`/`becameHidden` mark the visibility edges. */
  frame(state: MotionState, edges: { becameVisible: boolean; becameHidden: boolean; mode: PresentationMode }): void;
  /** Low-frequency view changes: the request's text, the selected card, the picker. */
  view(view: PresentationView, focus?: FocusTarget): void;
  closed(detail: ClosedDetail): void;
  playEnded?(): void;
  cardSelected?(id: PaymentCardId): void;
};

export type PresentationClock = {
  now(): number;
  request(callback: (now: number) => void): number;
  cancel(handle: number): void;
};

export const browserClock: PresentationClock = {
  now: () => performance.now(),
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

const OPEN_MODES: readonly PresentationMode[] = ["interactive", "selected", "closing"];

export class PresentationController {
  mode: PresentationMode = "idle";
  visible = false;
  lastState: MotionState = stateAt(0);
  private view: PresentationView = { request: null, selectedCardId: defaultCardId, pickerOpen: false };
  private handle = 0;
  private destroyed = false;
  private readonly clock: PresentationClock;

  constructor(
    private readonly sink: PresentationSink,
    private readonly options: { reducedMotion: boolean; enablePicker: boolean; clock?: PresentationClock },
  ) {
    this.clock = options.clock ?? browserClock;
  }

  get request(): ValidCheckoutRequest | null {
    return this.view.request;
  }

  get selectedCardId(): PaymentCardId {
    return this.view.selectedCardId;
  }

  get pickerOpen(): boolean {
    return this.view.pickerOpen;
  }

  /** True while a manual presentation owns the sheet (a bridge request is active). */
  get presenting(): boolean {
    return OPEN_MODES.includes(this.mode);
  }

  /** Validates before touching any state; a rejected request leaves the current checkout as it was. */
  setRequest(value: unknown): ValidCheckoutRequest {
    const request = validateRequest(value);
    this.updateView({ request });
    return request;
  }

  setTime(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new TypeError("Time must be finite.");
    const wasPresenting = this.visible && this.presenting;
    this.stop();
    this.mode = "seek";
    this.updateView({ pickerOpen: false, selectedCardId: defaultCardId });
    this.render(stateAt(seconds));
    if (wasPresenting && !this.visible) this.emitClosed();
  }

  play(): void {
    this.setTime(0);
    this.stop();
    this.updateView({ pickerOpen: false, selectedCardId: defaultCardId });
    this.mode = "play";
    const start = this.clock.now();
    const tick = (now: number) => {
      if (this.destroyed || this.mode !== "play") return;
      const t = (now - start) / 1000;
      this.render(stateAt(t));
      if (t < motionDuration) {
        this.handle = this.clock.request(tick);
      } else {
        this.mode = "idle";
        this.handle = 0;
        this.sink.playEnded?.();
      }
    };
    this.handle = this.clock.request(tick);
  }

  /** Opens once. Duplicate taps or repeated bridge requests while open do not restart the sheet. */
  open(value?: unknown): boolean {
    if (this.destroyed || this.presenting) return false;
    const request = validateRequest(value === undefined ? this.view.request : value);
    this.stop();
    this.updateView({ request, selectedCardId: defaultCardId, pickerOpen: false });
    this.mode = "interactive";
    this.runOpenClock();
    return true;
  }

  close(): void {
    if (this.mode === "closing" || this.destroyed) return;
    if (!this.visible) {
      // Cancelled before the first frame was drawn.
      if (this.mode === "interactive" || this.mode === "selected") {
        this.stop();
        this.mode = "idle";
        this.render(stateAt(0));
        this.emitClosed();
      }
      return;
    }
    this.stop();
    this.mode = "closing";
    this.updateView({ pickerOpen: false });
    const from = { ...this.lastState };
    const start = this.clock.now();
    const tick = (now: number) => {
      if (this.destroyed || this.mode !== "closing") return;
      const { state, done } = closingStateAt(from, (now - start) / 1000, this.options.reducedMotion);
      this.render(state);
      if (!done) {
        this.handle = this.clock.request(tick);
        return;
      }
      this.mode = "idle";
      this.handle = 0;
      this.render(stateAt(0));
      this.emitClosed();
    };
    this.handle = this.clock.request(tick);
  }

  /**
   * Remove the sheet at once, without the exit track: the checkout that opened it has left the thread
   * (a replay or a seek before its arrival). The request is dropped so nothing stale is shown later.
   */
  dismiss(): void {
    if (this.destroyed) return;
    const wasShowing = this.visible || this.presenting;
    this.stop();
    this.mode = "idle";
    this.updateView({ request: null, selectedCardId: defaultCardId, pickerOpen: false });
    this.render(stateAt(0));
    if (wasShowing) this.emitClosed();
  }

  /** The card picker is a provisional extension: the recording never opens it. */
  openPicker(): boolean {
    if (!this.visible || this.mode === "closing" || !this.options.enablePicker) return false;
    this.updateView({ pickerOpen: true }, "picker-back");
    return true;
  }

  closePicker(): void {
    if (!this.view.pickerOpen) return;
    this.updateView({ pickerOpen: false }, "other");
  }

  selectCard(id: string): void {
    const card = cardById(id);
    if (!card) throw new TypeError(`Unknown card ${id}.`);
    if (this.mode === "closing" || this.destroyed) return;
    this.updateView({ selectedCardId: card.id, pickerOpen: false });
    if (this.mode === "seek" || this.mode === "idle" || this.mode === "play") {
      if (!this.view.request || !this.open()) return;
      this.updateView({ selectedCardId: card.id });
    }
    this.mode = "selected";
    this.updateView({}, "other");
    this.sink.cardSelected?.(card.id);
  }

  /** Escape: back out of the picker first, then close the sheet (or cancel one not yet drawn). */
  escape(): void {
    if (!this.visible && !this.presenting) return;
    if (this.view.pickerOpen) this.closePicker();
    else this.close();
  }

  destroy(): void {
    if (this.destroyed) return;
    const wasVisible = this.visible;
    this.destroyed = true;
    this.stop();
    if (wasVisible) this.sink.closed({ reason: "cancelled", selectedCardId: this.view.selectedCardId });
  }

  private runOpenClock(): void {
    const start = this.clock.now();
    const tick = (now: number) => {
      if (this.destroyed || (this.mode !== "interactive" && this.mode !== "selected")) return;
      const elapsed = (now - start) / 1000;
      this.render(openStateAt(elapsed, { selected: this.mode === "selected", reducedMotion: this.options.reducedMotion }));
      this.handle = this.clock.request(tick);
    };
    this.handle = this.clock.request(tick);
  }

  private stop(): void {
    if (this.handle) this.clock.cancel(this.handle);
    this.handle = 0;
  }

  private render(state: MotionState): void {
    const becameVisible = state.visible && !this.visible;
    const becameHidden = !state.visible && this.visible;
    this.lastState = state;
    this.visible = state.visible;
    this.sink.frame(state, { becameVisible, becameHidden, mode: this.mode });
  }

  private updateView(patch: Partial<PresentationView>, focus?: FocusTarget): void {
    const next = { ...this.view, ...patch };
    const changed = next.request !== this.view.request || next.selectedCardId !== this.view.selectedCardId || next.pickerOpen !== this.view.pickerOpen;
    this.view = next;
    if (changed || focus) this.sink.view(next, focus);
  }

  private emitClosed(): void {
    this.sink.closed({ reason: "cancelled", selectedCardId: this.view.selectedCardId });
  }
}
