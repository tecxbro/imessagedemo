import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { bubbleMetrics } from "@/components/imessage/tokens";
import type { AppCardMessage } from "../app-card/AppCardLayer";
import { resolveMiniApp } from "./config";
import "./mini-app.css";

/** Card metadata follows customizedMiniApp in photon-hq/miniapp-demo-agent.
 * The web sheet is a browser recreation, not the proprietary iMessage extension. */
export function MiniAppDock({ message, frameRef, onOpenSheet }: { message: AppCardMessage; frameRef: RefObject<HTMLElement | null>; onOpenSheet?: () => void }) {
  const spec = message.appCard.sheet;
  const layout = spec ? { caption: spec.title, subcaption: spec.description, summary: spec.experienceSummary, image: spec.hero.src, imageTitle: spec.hero.alt } : message.appCard.layout!;
  const [container] = useState(() => {
    const node = document.createElement("div");
    node.dataset.slot = "app-card";
    node.dataset.appCardId = message.id;
    node.style.width = `${bubbleMetrics.ios.maxWidth}px`;
    node.style.flex = "none";
    return node;
  });
  const [open, setOpen] = useState(false);
  const [visited, setVisited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [revision, setRevision] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const embed = resolveMiniApp(message.appCard.url, window.location.origin, import.meta.env.VITE_PHOTON_MINIAPP_ORIGINS);

  useEffect(() => {
    const dock = () => {
      const row = frameRef.current?.querySelector(`[data-slot="message-row"][data-message-id="${CSS.escape(message.id)}"]`);
      if (row && container.parentElement !== row) row.appendChild(container);
    };
    dock();
    const root = frameRef.current;
    const observer = new MutationObserver(dock);
    if (root) observer.observe(root, { childList: true, subtree: true });
    mounted.current = true;
    return () => {
      observer.disconnect();
      mounted.current = false;
      queueMicrotask(() => { if (!mounted.current) container.remove(); });
    };
  }, [container, frameRef, message.id]);

  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const disabled: Array<{ node: HTMLElement; inert: boolean }> = [];
    let node: HTMLElement | null = sheetRef.current;
    while (node?.parentElement && node !== frameRef.current) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) {
          disabled.push({ node: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      node = node.parentElement;
    }
    closeRef.current?.focus();
    // Keep keyboard navigation within the sheet. The sandbox cannot trap Escape while focus is in
    // a remote frame; the persistent close button remains the universal dismissal control.
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "Tab" && event.shiftKey && document.activeElement === closeRef.current) {
        event.preventDefault(); sheetRef.current?.querySelector<HTMLButtonElement>('[data-miniapp-last]')?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      for (const entry of disabled) entry.node.inert = entry.inert;
      if (buttonRef.current?.isConnected) buttonRef.current.focus();
    };
  }, [open]);

  return <>
    {createPortal(
      <button ref={buttonRef} type="button" className={`photon-mini-card${spec ? " sheet-app-card" : ""}`} data-slot="mini-app-card"
        aria-label={`Open ${layout.caption}`} onClick={() => { if (onOpenSheet) { onOpenSheet(); return; } setVisited(true); setOpen(true); }}>
        {layout.image ? <img className="photon-mini-art" src={layout.image} alt={layout.imageTitle} /> :
          <div className="photon-mini-art photon-mini-placeholder" aria-hidden="true"><span>✦</span></div>}
        <span className="photon-mini-copy"><strong>{layout.caption}</strong>{layout.subcaption && <span>{layout.subcaption}</span>}</span>
        {!spec && <span className="photon-mini-footer"><span className="photon-mini-icon" aria-hidden="true">✦</span> Spectrum <span aria-hidden="true">↗</span></span>}
      </button>, container)}
    {visited && <section ref={sheetRef} role="dialog" aria-modal={open ? true : undefined} aria-label={layout.caption}
      aria-describedby={`miniapp-summary-${message.id}`} data-slot="mini-app-sheet" className="photon-mini-sheet" hidden={!open}>
      <header className="photon-mini-toolbar">
        <button ref={closeRef} type="button" aria-label="Close mini app" onClick={close}>×</button>
        <div><strong>{layout.caption}</strong><span>Spectrum</span></div>
        <button type="button" aria-label="Reload mini app" onClick={() => { setLoaded(false); setRevision(value => value + 1); }}>↻</button>
      </header>
      <p id={`miniapp-summary-${message.id}`} className="photon-mini-sr">{layout.summary}</p>
      <div className="photon-mini-content">
        {embed.ok ? <>
          {!loaded && <div className="photon-mini-loading" role="status">Opening {layout.caption}…</div>}
          <iframe key={revision} data-slot="mini-app-frame" title={`${layout.caption} app`} src={embed.src}
            sandbox={embed.ok && new URL(embed.src).origin !== window.location.origin ? "allow-scripts allow-same-origin" : "allow-scripts"} referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
            onLoad={() => setLoaded(true)} />
        </> : <div className="photon-mini-error" role="alert">{embed.message}</div>}
      </div>
      <button type="button" data-miniapp-last className="photon-mini-done" onClick={close}
        onKeyDown={event => { if (event.key === "Tab" && !event.shiftKey) { event.preventDefault(); closeRef.current?.focus(); } }}>Done</button>
    </section>}
  </>;
}
