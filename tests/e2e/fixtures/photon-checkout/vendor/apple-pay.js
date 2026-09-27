/* Local visual presentation only. Does not call ApplePaySession, open popups,
   authenticate, inspect Wallet, collect payment credentials, or send money. */
(function (g, factory) {
  const motion = typeof module !== 'undefined' && module.exports ? require('./motion-data.js') : g.PhotonPayMotion;
  const api = factory(motion);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  g.PhotonPay = api;
})(globalThis, function (motion) {
  'use strict';
  if (!motion) throw new Error('Load motion-data.js before apple-pay.js.');
  const scriptURL = typeof document !== 'undefined' ? document.currentScript?.src : null;
  const DEFAULT_ASSETS = scriptURL ? new URL('assets/', scriptURL).href : './assets/';
  const CARDS = Object.freeze([
    Object.freeze({ id: 'bofa', label: 'Bank of America Visa Debit Card', lastFour: '5334', asset: 'bofa-5334.png', partial: false }),
    Object.freeze({ id: 'rho', label: 'Rho', lastFour: '0987', asset: 'rho-left-visible.png', partial: true }),
    Object.freeze({ id: 'other', label: 'Other card', lastFour: null, asset: 'other-right-visible.png', partial: true })
  ]);
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  function text(v, name, max) {
    if (typeof v !== 'string' || !v.trim() || v.length > max || /[\u0000-\u001f]/.test(v)) throw new TypeError(`${name} must be a non-empty string of at most ${max} characters.`);
    return v.trim();
  }
  function validateRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('A checkout request object is required.');
    const merchantLabel = text(value.merchantLabel, 'merchantLabel', 140);
    const currency = text(value.currency, 'currency', 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError('currency must be an ISO currency code.');
    if (typeof Intl.supportedValuesOf === 'function' && !Intl.supportedValuesOf('currency').includes(currency)) throw new TypeError(`Unsupported currency ${currency}.`);
    const digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    if (typeof value.amount !== 'string' || !/^(0|[1-9]\d{0,8})(\.\d{1,3})?$/.test(value.amount)) throw new TypeError('amount must be a non-negative decimal STRING, not a display price or a floating-point number.');
    const [whole, fraction = ''] = value.amount.split('.');
    if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) throw new TypeError(`Too many decimal places for ${currency}.`);
    const amount = digits ? `${whole}.${fraction.padEnd(digits, '0').slice(0, digits)}` : whole;
    const country = value.country === undefined ? 'US' : text(value.country, 'country', 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) throw new TypeError('country must contain two letters.');
    const domain = text(value.domain || 'checkout.example', 'domain', 160);
    if (/[^a-zA-Z0-9.:-]/.test(domain)) throw new TypeError('domain must be a hostname, not a URL or HTML.');
    const locale = value.locale || 'en-US';
    new Intl.NumberFormat(locale); // Validate locale before any UI mutation.
    return Object.freeze({ merchantLabel, amount, currency, country, domain, locale });
  }
  function formatMoney(input) {
    const request = validateRequest(input);
    // The exact decimal string remains authoritative. Number is used only for
    // presentation, after a bound that keeps all allowed minor units safe.
    return new Intl.NumberFormat(request.locale, { style: 'currency', currency: request.currency }).format(Number(request.amount));
  }
  function fromCheckoutSpec(spec, domain, locale = 'en-US') {
    return validateRequest({ merchantLabel: spec?.metadata?.applePayLabel, amount: spec?.item?.applePayAmount,
      currency: spec?.item?.applePayCurrencyCode || 'USD', country: spec?.item?.applePayCountryCode || 'US', domain, locale });
  }
  function sample(n) {
    const index = Math.max(0, Math.min(417, n));
    const f = motion.frames[index];
    const expanded = (index >= 121 && index < 299) || index >= 352;
    const top = f[0] === null ? 1114 : f[0] - 2; // Interior-fill threshold -> visible edge, ±2 px.
    const w = f[3] || (expanded ? 248 : 202);
    const h = f[4] && f[4] > 100 ? f[4] : w * 157 / 248;
    const x = f[1] ?? (512 - w) / 2;
    const cardTop = f[2] !== null && f[0] !== null ? f[2] - top : expanded ? 208 : 223;
    const chromeOpacity = (index >= 66 && index < 198) || (index >= 299 && index < 388) ? 1 : index >= 198 && index < 215 ? (215 - index) / 17 : index >= 388 && index < 405 ? (405 - index) / 17 : 0;
    return { top, dim: f[5], chromeOpacity, cardX: x, cardY: cardTop, cardW: w, cardH: h,
      expand: index < 100 ? 0 : index < 121 ? clamp((w - 202) / 46) : index < 299 ? 1 : index < 332 ? 0 : index < 352 ? clamp((w - 202) / 46) : 1,
      pressed: (index >= 182 && index <= 185) || (index >= 372 && index <= 375) };
  }
  function stateAt(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('Time must be finite.');
    const t = clamp(seconds, 0, motion.duration);
    const f = t * 30, n = Math.floor(f), p = f - n, a = sample(n), b = sample(n + 1), state = {};
    for (const key of ['top', 'dim', 'chromeOpacity', 'cardX', 'cardY', 'cardW', 'cardH', 'expand']) state[key] = lerp(a[key], b[key], p);
    return Object.assign(state, { visible: state.top < 1111, pressed: a.pressed, time: t, sourceFrame: Math.min(n, 417) });
  }
  function element(tag, className, attrs = {}) {
    const e = document.createElement(tag); e.className = className;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }
  class PayOverlay {
    constructor(root, request, options = {}) {
      if (!(root instanceof HTMLElement)) throw new TypeError('root must be a dedicated HTML overlay container.');
      this.root = root; this.options = options; this.request = validateRequest(request);
      this.reduceMotion = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.selectedId = 'bofa'; this.pickerOpen = false; this.visible = false;
      this.mode = 'idle'; this.raf = 0; this.destroyed = false; this.assets = options.assetsBase || DEFAULT_ASSETS;
      this.backgroundElement = options.backgroundElement || null; this.backgroundWasInert = false;
      this.root.classList.add('pp-host');
      this.scrim = element('div', 'pp-scrim', { 'aria-hidden': 'true' });
      this.plane = element('div', 'pp-plane');
      this.sheet = element('section', 'pp-sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Apple Pay checkout', tabindex: '-1' });
      this.closeButton = element('button', 'pp-close', { type: 'button', 'aria-label': 'Close Apple Pay' });
      this.closeButton.innerHTML = '<span></span><span></span>';
      this.logo = element('img', 'pp-logo', { alt: 'Apple Pay', src: this.asset('apple-pay-lockup.png') });
      this.content = element('div', 'pp-content');
      this.label = element('div', 'pp-merchant'); this.amount = element('div', 'pp-amount', { 'data-amount': 'primary' });
      this.fan = element('div', 'pp-fan');
      this.left = element('img', 'pp-side pp-side-left', { alt: '', src: this.asset('rho-left-visible.png') });
      this.right = element('img', 'pp-side pp-side-right', { alt: '', src: this.asset('other-right-visible.png') });
      this.front = element('div', 'pp-front');
      this.frontImage = element('img', 'pp-front-image', { alt: 'Bank of America card ending in 5334', src: this.asset('bofa-5334.png') });
      this.front.append(this.frontImage); this.fan.append(this.left, this.right, this.front);
      this.otherButton = element('button', 'pp-other', { type: 'button' }); this.otherButton.textContent = 'Other Cards & Pay Later Options';
      this.row = element('div', 'pp-summary');
      const icon = element('img', 'pp-payment-icon', { alt: '', src: this.asset('payment-icon.png') });
      this.cardLabel = element('div', 'pp-card-label'); this.payLine = element('div', 'pp-pay-line', { 'data-amount': 'pay-line' });
      this.row.append(icon, this.cardLabel, this.payLine);
      this.total = element('div', 'pp-total'); const totalLabel = element('span', ''); totalLabel.textContent = 'Total';
      this.totalAmount = element('span', '', { 'data-amount': 'total' }); this.total.append(totalLabel, this.totalAmount);
      this.domain = element('div', 'pp-domain');
      this.spinner = element('div', 'pp-spinner', { role: 'status', 'aria-label': 'Loading payment details' });
      this.spinner.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-dasharray="72 16"/></svg>';
      this.content.append(this.label, this.amount, this.fan, this.otherButton, this.row, this.total, this.domain, this.spinner);
      this.picker = element('div', 'pp-picker', { hidden: '' });
      this.pickerBack = element('button', 'pp-picker-back', { type: 'button' }); this.pickerBack.textContent = 'Back';
      const heading = element('h2', 'pp-picker-heading'); heading.textContent = 'Cards';
      this.pickerList = element('div', 'pp-picker-list', { role: 'group', 'aria-label': 'Choose a card' });
      this.cardButtons = CARDS.map(card => {
        const button = element('button', 'pp-picker-card', { type: 'button', 'data-card': card.id, 'aria-pressed': String(card.id === 'bofa') });
        const thumb = element('img', `pp-picker-thumb${card.partial ? ' pp-partial' : ''}`, { alt: '', src: this.asset(card.asset) });
        const label = element('span', ''); label.textContent = card.label + (card.lastFour ? ` •••• ${card.lastFour}` : '');
        const check = element('span', 'pp-selection-mark', { 'aria-hidden': 'true' }); check.textContent = '✓';
        button.append(thumb, label, check); button.addEventListener('click', () => this.selectCard(card.id)); return button;
      });
      this.pickerList.append(...this.cardButtons); this.picker.append(this.pickerBack, heading, this.pickerList);
      this.sheet.append(this.closeButton, this.logo, this.content, this.picker); this.plane.append(this.sheet);
      this.home = element('div', 'pp-home', { 'aria-hidden': 'true' });
      if (options.drawHomeIndicator) this.plane.append(this.home);
      this.root.replaceChildren(this.scrim, this.plane);
      this.closeButton.addEventListener('click', () => this.close());
      this.otherButton.addEventListener('click', () => this.openPicker());
      this.pickerBack.addEventListener('click', () => { this.pickerOpen = false; this.syncPicker(); this.otherButton.focus(); });
      this.keyHandler = e => {
        if (!this.visible) return;
        if (e.key === 'Escape') { e.preventDefault(); if (this.pickerOpen) { this.pickerOpen = false; this.syncPicker(); this.otherButton.focus(); } else this.close(); }
        if (e.key === 'Tab') {
          const all = [...this.sheet.querySelectorAll('button:not([disabled])')].filter(b => b.getClientRects().length);
          const first = all[0], last = all.at(-1), focus = document.activeElement;
          if (e.shiftKey && (focus === first || !this.sheet.contains(focus))) { e.preventDefault(); last?.focus(); }
          else if (!e.shiftKey && (focus === last || !this.sheet.contains(focus))) { e.preventDefault(); first?.focus(); }
        }
      };
      document.addEventListener('keydown', this.keyHandler);
      this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(root);
      this.setRequest(request); this.resize(); this.render(stateAt(0));
    }
    asset(name) { return this.assets.replace(/\/?$/, '/') + name; }
    resize() {
      const w = this.root.clientWidth, h = this.root.clientHeight;
      const s = Math.min(w / 512, h / 1112);
      this.plane.style.transform = `translate(${(w - 512 * s) / 2}px, ${h - 1112 * s}px) scale(${s})`;
    }
    setRequest(request) {
      this.request = validateRequest(request); const formatted = formatMoney(this.request);
      this.label.textContent = `Pay ${this.request.merchantLabel}`; this.amount.textContent = formatted;
      this.payLine.textContent = `Pay ${formatted}`; this.totalAmount.textContent = formatted; this.domain.textContent = this.request.domain;
      this.amount.style.fontSize = formatted.length > 15 ? '34px' : formatted.length > 12 ? '40px' : '48px';
      this.cardLabel.textContent = CARDS.find(c => c.id === this.selectedId).label;
      return this;
    }
    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
    setTime(seconds) {
      const wasInteractive = this.visible && ['interactive', 'selected', 'closing'].includes(this.mode);
      this.stop(); this.mode = 'seek'; this.pickerOpen = false; this.syncPicker(); this.selectedId = 'bofa'; this.syncCard();
      this.render(stateAt(seconds));
      if (wasInteractive && !this.visible) this.root.dispatchEvent(new CustomEvent('photon-pay:closed', { detail: { reason: 'cancelled', selectedCardId: this.selectedId } }));
      return this;
    }
    play() {
      this.setTime(0);
      this.stop(); this.selectedId = 'bofa'; this.syncCard(); this.pickerOpen = false; this.syncPicker(); this.mode = 'play';
      const start = performance.now();
      const tick = now => { if (this.destroyed || this.mode !== 'play') return; const t = (now - start) / 1000; this.render(stateAt(t));
        if (t < motion.duration) this.raf = requestAnimationFrame(tick); else { this.mode = 'idle'; this.raf = 0; this.root.dispatchEvent(new CustomEvent('photon-pay:play-ended')); }
      }; this.raf = requestAnimationFrame(tick); return this;
    }
    open(request = this.request) {
      // Duplicate pointer/click or bridge requests must not restart an open sheet.
      if (['interactive', 'selected', 'closing'].includes(this.mode)) return this;
      this.stop(); this.setRequest(request); this.selectedId = 'bofa'; this.syncCard(); this.pickerOpen = false; this.syncPicker(); this.mode = 'interactive';
      const start = performance.now();
      const tick = now => { if (this.destroyed || !['interactive', 'selected'].includes(this.mode)) return;
        const elapsed = (now - start) / 1000;
        const s = stateAt(this.mode === 'selected' || this.reduceMotion ? 4.5 : Math.min(181 / 30, 66 / 30 + elapsed));
        s.time = 66 / 30 + elapsed; this.render(s); this.raf = requestAnimationFrame(tick);
      }; this.raf = requestAnimationFrame(tick); return this;
    }
    close() {
      if (this.mode === 'closing' || this.destroyed) return this;
      if (!this.visible) {
        if (['interactive', 'selected'].includes(this.mode)) {
          this.stop(); this.mode = 'idle'; this.render(stateAt(0));
          const detail = { reason: 'cancelled', selectedCardId: this.selectedId };
          this.root.dispatchEvent(new CustomEvent('photon-pay:closed', { detail })); this.options.onClose?.(detail);
        }
        return this;
      }
      this.stop(); this.mode = 'closing'; this.pickerOpen = false; this.syncPicker();
      const from = { ...this.lastState }, start = performance.now();
      const tick = now => {
        if (this.destroyed || this.mode !== 'closing') return;
        const dt = (now - start) / 1000, native = stateAt(185 / 30 + dt);
        const progress = this.reduceMotion ? 1 : clamp((native.top - 254) / 860);
        this.render({ ...from, top: lerp(from.top, 1114, progress), dim: from.dim * (1 - progress), visible: progress < 1, pressed: dt < .07, time: from.time + dt });
        if (!this.reduceMotion && dt < 14 / 30) this.raf = requestAnimationFrame(tick);
        else { this.mode = 'idle'; this.raf = 0; this.render(stateAt(0));
          this.root.dispatchEvent(new CustomEvent('photon-pay:closed', { detail: { reason: 'cancelled', selectedCardId: this.selectedId } }));
          this.options.onClose?.({ reason: 'cancelled', selectedCardId: this.selectedId });
        }
      }; this.raf = requestAnimationFrame(tick); return this;
    }
    openPicker() {
      if (!this.visible || this.mode === 'closing' || this.options.enablePicker === false) return this;
      // This extension is NOT present in the recording. See EVIDENCE-LIMITS.md.
      this.pickerOpen = true; this.syncPicker(); this.pickerBack.focus(); return this;
    }
    syncPicker() { this.content.hidden = this.pickerOpen; this.picker.hidden = !this.pickerOpen; }
    selectCard(id) {
      if (!CARDS.some(c => c.id === id)) throw new TypeError(`Unknown card ${id}.`);
      this.selectedId = id; this.pickerOpen = false; this.syncPicker(); this.syncCard();
      if (['seek', 'idle', 'play'].includes(this.mode)) {
        const saved = id; this.open(this.request); this.selectedId = saved; this.syncCard();
      }
      this.mode = 'selected'; this.otherButton.focus();
      this.root.dispatchEvent(new CustomEvent('photon-pay:card-selected', { detail: { cardId: id } })); return this;
    }
    syncCard() {
      const card = CARDS.find(c => c.id === this.selectedId); this.cardLabel.textContent = card.label;
      this.frontImage.src = this.asset(card.asset); this.frontImage.alt = card.label + (card.lastFour ? ` ending in ${card.lastFour}` : '');
      this.front.dataset.partial = String(card.partial); this.front.dataset.card = card.id;
      for (const button of this.cardButtons) button.setAttribute('aria-pressed', String(button.dataset.card === card.id));
    }
    render(s) {
      const becomingVisible = s.visible && !this.visible;
      this.lastState = s;
      if (s.visible !== this.visible) {
        this.visible = s.visible; this.root.dataset.visible = String(s.visible); this.sheet.setAttribute('aria-hidden', String(!s.visible)); this.sheet.inert = !s.visible;
        if (s.visible) {
          this.previousFocus = document.activeElement;
          if (this.backgroundElement) { this.backgroundWasInert = this.backgroundElement.inert; this.backgroundElement.inert = true; }
        } else {
          if (this.backgroundElement) this.backgroundElement.inert = this.backgroundWasInert;
          if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected && this.mode !== 'play') this.previousFocus.focus({ preventScroll: true });
        }
      }
      this.sheet.style.transform = `translate(10px, ${s.top}px)`;
      this.scrim.style.opacity = String(s.dim); this.scrim.hidden = s.dim < .0001;
      this.sheet.hidden = !s.visible; this.home.hidden = !s.visible;
      if (becomingVisible && this.mode === 'interactive') this.closeButton.focus({ preventScroll: true });
      this.closeButton.classList.toggle('is-pressed', s.pressed);
      const alternate = this.selectedId !== 'bofa';
      const rect = alternate ? { x: 132, y: 208, w: 248, h: 157 } : { x: s.cardX, y: s.cardY, w: s.cardW, h: s.cardH };
      Object.assign(this.front.style, { left: `${rect.x - 10}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` });
      const p = alternate ? 1 : s.expand;
      // The side cards grow in height before receding behind the front card.
      // This fitted pose is an approximation, not a recovered native 3D transform.
      const retreat = 50 * Math.pow(p, 2.4), leftH = 80 + 64 * p, rightH = 81 + 64 * p;
      const leftW = 61 * leftH / 80, rightW = 61 * rightH / 81;
      Object.assign(this.left.style, { left: `${85 + retreat}px`, top: `${247 - 32 * p}px`, width: `${leftW}px`, height: `${leftH}px` });
      Object.assign(this.right.style, { left: `${408 - retreat - rightW}px`, top: `${246 - 32 * p}px`, width: `${rightW}px`, height: `${rightH}px` });
      this.left.style.opacity = this.right.style.opacity = p >= .99 ? '0' : '1';
      this.spinner.style.transform = `rotate(${this.reduceMotion ? 0 : s.time * 360}deg)`;
      this.root.dataset.sourceFrame = String(s.sourceFrame ?? 'interactive');
      this.options.onFrame?.(s);
    }
    destroy() {
      if (this.visible) this.root.dispatchEvent(new CustomEvent('photon-pay:closed', { detail: { reason: 'cancelled', selectedCardId: this.selectedId } }));
      this.destroyed = true; this.stop(); this.observer.disconnect(); document.removeEventListener('keydown', this.keyHandler);
      if (this.backgroundElement && this.visible) this.backgroundElement.inert = this.backgroundWasInert;
      if (this.visible && this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) this.previousFocus.focus({ preventScroll: true });
      this.root.replaceChildren(); this.root.classList.remove('pp-host'); delete this.root.dataset.visible;
    }
  }
  return { PayOverlay, validateRequest, formatMoney, fromCheckoutSpec, stateAt, cards: CARDS, duration: motion.duration };
});
