import { useEffect, useLayoutEffect, useRef, type ReactNode, type RefObject, type PointerEvent } from 'react';
import { SHEET, type SheetSnapshot } from './motion';
import './sheet.css';

type Props = {
  title: string; snapshot: SheetSnapshot; frameRef: RefObject<HTMLElement | null>; children: ReactNode;
  onClose(): void; onExpand(): void; onCompact(): void; onReload(): void;
  onDragStart(): void; onDrag(top: number): void; onRelease(velocity: number): void; onCancel(): void;
  reference?: boolean;
  compactNavigation?: boolean;
};
/** Shared shell over the established iOS renderer. Content stays mounted while the viewport reflows. */
export function SheetSurface({ title, snapshot, frameRef, children, reference, compactNavigation = true, ...events }: Props) {
  const { pose, phase, content } = snapshot;
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; y: number; top: number; lastY: number; time: number; velocity: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const scale = (frameRef.current?.clientWidth ?? 402) / 512;
  const heightScale = (frameRef.current?.clientHeight ?? 874) / 1112;
  const active = phase !== 'closed';
  const hostTravel = useRef<number | null>(null);
  useLayoutEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    if (active && hostTravel.current === null && !reference) {
      // Reflow the actual thread to make room for the app. A short conversation must not
      // receive the same arbitrary translation as the reference's long conversation.
      const bounds = root.getBoundingClientRect();
      const last = Array.from(root.querySelectorAll<HTMLElement>('[data-slot="message-row"]')).at(-1);
      const lastBottom = last ? (last.getBoundingClientRect().bottom-bounds.top)/(bounds.height/1112) : 594;
      hostTravel.current = Math.max(0,lastBottom-594);
    }
    if (!active) hostTravel.current = null;
    const travelRatio = reference ? 1 : (hostTravel.current ?? 0)/SHEET.hostTravel;
    let composerOffset = pose.composerY * heightScale;
    const field = root.querySelector<HTMLElement>('[data-slot="ios-composer"] textarea');
    if (!reference && field && pose.visible && pose.composerVisible) {
      const bounds = root.getBoundingClientRect(), renderedScale=bounds.height/root.clientHeight;
      const oldOffset = parseFloat(root.style.getPropertyValue('--sheet-composer-y')) || 0;
      const fieldBottom = (field.getBoundingClientRect().bottom-bounds.top)/renderedScale-oldOffset;
      composerOffset = Math.min(composerOffset,pose.top*heightScale-fieldBottom-2*scale);
    }
    root.dataset.sheetActive = String(active);
    root.style.setProperty('--sheet-transcript-y', `${pose.transcriptY * heightScale * travelRatio}px`);
    root.style.setProperty('--sheet-composer-y', `${composerOffset}px`);
    root.style.setProperty('--sheet-composer-opacity', pose.composerVisible ? '1' : '0');
    const log = root.querySelector<HTMLElement>('[data-slot="message-list"]');
    const composer = root.querySelector<HTMLElement>('[data-slot="ios-composer"]');
    const nav = root.querySelector<HTMLElement>('[data-slot="ios-nav-bar"]');
    const nodes = [log, composer, nav].filter((node): node is HTMLElement => !!node);
    const old = nodes.map(node => node.inert);
    nodes.forEach(node => { node.inert = active && pose.visible && (node === composer ? !pose.composerVisible : pose.presentation === 'expanded'); });
    return () => { nodes.forEach((node, i) => { node.inert = old[i]; }); };
  }, [active, pose, frameRef, heightScale, scale, reference]);
  useLayoutEffect(() => () => {
    const root = frameRef.current;
    if (!root) return;
    delete root.dataset.sheetActive;
    for (const key of ['--sheet-transcript-y','--sheet-composer-y','--sheet-composer-opacity']) root.style.removeProperty(key);
  }, [frameRef]);
  useLayoutEffect(() => {
    if (active && !reference) panel.current?.focus({ preventScroll: true });
  }, [active, reference]);
  useEffect(() => {
    if (!active || !pose.visible || pose.presentation !== 'expanded' || reference) return;
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) panel.current?.focus({ preventScroll: true });
    };
    document.addEventListener('focusin', containFocus);
    return () => document.removeEventListener('focusin', containFocus);
  }, [active, pose.visible, pose.presentation, reference]);
  function down(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, y: event.clientY, top: pose.top, lastY: event.clientY, time: event.timeStamp, velocity: 0, moved: false };
    events.onDragStart();
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    // getBoundingClientRect accounts for preview scaling in addition to the logical frame size.
    const actualScale = (frameRef.current?.getBoundingClientRect().height ?? 874) / 1112;
    d.velocity = (event.clientY - d.lastY) / actualScale / Math.max(1, event.timeStamp - d.time);
    d.lastY = event.clientY; d.time = event.timeStamp;
    d.moved ||= Math.abs(event.clientY - d.y) > 3;
    events.onDrag(d.top + (event.clientY - d.y) / actualScale);
  }
  function up(event: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    // Native click is the activation event, including when WebKit suppresses pointerdown
    // after an iframe selection. A completed drag must not also activate the button.
    suppressClick.current = d.moved;
    if (!d.moved) return;
    events.onRelease(event.timeStamp - d.time > 100 ? 0 : d.velocity);
  }
  return <>
    {active && <div className="sheet-app-dim" data-slot="sheet-app-dim" style={{ opacity: pose.dim }} />}
    <section ref={panel} tabIndex={-1} role="dialog" aria-modal={active && pose.presentation === 'expanded' ? true : undefined}
      aria-label={title} data-slot="sheet-app-shell" data-phase={phase} data-content={content} data-presentation={pose.presentation}
      data-reference={reference || undefined} hidden={!pose.visible} className="sheet-app-shell"
      style={{ top: pose.top * heightScale, left: pose.inset * scale, right: pose.inset * scale, height: pose.height * heightScale,
        borderRadius: `${54 * scale}px`, '--sheet-scale': scale } as React.CSSProperties}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); events.onClose(); }
        if (event.key === 'Tab') {
          const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),iframe') ?? []).filter(el => el.offsetParent !== null);
          const first = targets[0], last = targets.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <button className="sheet-app-grabber" aria-label={pose.presentation === 'compact' ? 'Expand app' : 'Collapse app'}
        aria-description="Drag down to dismiss. Press Escape to close, or Enter to change size." aria-keyshortcuts="Escape Enter"
        onPointerDown={down} onPointerMove={move} onPointerUp={up}
        onPointerCancel={() => { drag.current = null; suppressClick.current = true; events.onCancel(); }}
        onLostPointerCapture={() => { if (drag.current) { drag.current = null; events.onCancel(); } }}
        onClick={event => {
          if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
          pose.presentation === 'compact' ? events.onExpand() : events.onCompact();
        }}>
        <span style={{ opacity: pose.handle }} />
      </button>
      <div className="sheet-app-content" aria-hidden={content !== 'ready'} style={{ visibility: content === 'ready' ? 'visible' : 'hidden' }}>{children}</div>
      {content === 'loading' && <div className="sheet-app-loading" role="status" aria-label={`Loading ${title}`}><span /></div>}
      {content === 'error' && <div className="sheet-app-error" role="alert"><p>This app could not load.</p><button onClick={events.onReload}>Try again</button><button onClick={events.onClose}>Close</button></div>}
      {pose.presentation === 'compact' && compactNavigation && !reference && content === 'ready' && <button className="sheet-app-expand" onClick={events.onExpand}>Expand</button>}
    </section>
  </>;
}
