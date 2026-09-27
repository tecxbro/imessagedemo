/* Versioned, origin-checked iframe bridge. Mount only in an explicitly selected
   visual presentation path. Never install this over an already-running native
   handler, and never fall back to native Apple Pay when the host is absent. */
(function (g) {
  'use strict';
  const PROTOCOL = 1;
  function exactOrigin(value) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value || value === 'null') throw new TypeError('Use an exact non-opaque http(s) origin, with no trailing slash.');
    return value;
  }
  function mountHost({ iframe, overlay, allowedOrigin }) {
    allowedOrigin = exactOrigin(allowedOrigin);
    if (!(iframe instanceof HTMLIFrameElement)) throw new TypeError('The concrete checkout iframe is required.');
    let active = null;
    const seen = new Map();
    const reply = (requestId, state) => iframe.contentWindow?.postMessage({ type: 'photon-pay:result', version: PROTOCOL, requestId, state }, allowedOrigin);
    const listener = event => {
      if (event.origin !== allowedOrigin || event.source !== iframe.contentWindow) return;
      const d = event.data;
      if (!d || d.type !== 'photon-pay:open' || d.version !== PROTOCOL || typeof d.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(d.requestId)) return;
      if (seen.has(d.requestId)) { reply(d.requestId, seen.get(d.requestId)); return; }
      if (active) { reply(d.requestId, 'busy'); return; }
      let request;
      try { request = g.PhotonPay.validateRequest(d.checkout); } catch { reply(d.requestId, 'invalid'); return; }
      active = d.requestId; seen.set(active, 'opened');
      if (seen.size > 100) seen.delete(seen.keys().next().value);
      overlay.open(request); reply(active, 'opened');
    };
    const closed = () => {
      if (!active) return;
      seen.set(active, 'cancelled'); reply(active, 'cancelled'); active = null;
    };
    window.addEventListener('message', listener); overlay.root.addEventListener('photon-pay:closed', closed);
    return () => { window.removeEventListener('message', listener); overlay.root.removeEventListener('photon-pay:closed', closed); seen.clear(); active = null; };
  }
  function mountCheckoutButtons({ parentOrigin, checkout, buttonIds = ['applepay', 'applepayfb'], onState = () => {} }) {
    parentOrigin = exactOrigin(parentOrigin);
    if (window.parent === window) throw new Error('Visual checkout requires its configured renderer host.');
    let activeId = null, timer = 0;
    const message = event => {
      if (event.origin !== parentOrigin || event.source !== window.parent) return;
      const d = event.data;
      if (!d || d.type !== 'photon-pay:result' || d.version !== PROTOCOL || d.requestId !== activeId) return;
      clearTimeout(timer); timer = 0; onState(d.state);
      if (d.state !== 'opened') activeId = null;
    };
    const tapped = event => {
      if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();
      if (activeId) return;
      activeId = crypto.randomUUID();
      window.parent.postMessage({ type: 'photon-pay:open', version: PROTOCOL, requestId: activeId, checkout: { ...checkout, domain: checkout.domain || location.hostname } }, parentOrigin);
      timer = window.setTimeout(() => { activeId = null; onState('host-unavailable'); }, 1500);
    };
    const buttons = buttonIds.map(id => document.getElementById(id)).filter(Boolean);
    if (!buttons.length) throw new Error('Checkout buttons were not found.');
    const events = ['click', 'pointerup', 'touchend'];
    for (const button of buttons) for (const event of events) button.addEventListener(event, tapped, { passive: false });
    window.addEventListener('message', message);
    return () => { clearTimeout(timer); window.removeEventListener('message', message); for (const button of buttons) for (const event of events) button.removeEventListener(event, tapped); };
  }
  g.PhotonPayBridge = { version: PROTOCOL, mountHost, mountCheckoutButtons };
})(globalThis);
