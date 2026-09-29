import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { AppCardMessage } from '../../app-card/AppCardLayer';
import { SheetSurface } from './SheetSurface';
import { SheetMachine, type SheetSnapshot } from './motion';

export function SheetAppHost({ message, frameRef, openRevision, onClosed, scripted, scriptedTimeMs }: {
  message: AppCardMessage; frameRef: RefObject<HTMLElement | null>; openRevision: number; onClosed(): void; scripted?: SheetSnapshot; scriptedTimeMs?: number;
}) {
  const spec = message.appCard.sheet!;
  const [machine] = useState(() => { const value = new SheetMachine(matchMedia('(prefers-reduced-motion: reduce)').matches); value.reload(); return value; });
  const [snapshot, setSnapshot] = useState(machine.snapshot);
  const [interactiveAt, setInteractiveAt] = useState<number | null>(null);
  const usingScript = scripted && interactiveAt !== scriptedTimeMs;
  const latestScript = useRef<SheetSnapshot | undefined>(undefined);
  latestScript.current = usingScript ? scripted : undefined;
  const takeControl = useCallback(() => {
    if (latestScript.current) {
      machine.adopt({ ...latestScript.current, content: machine.snapshot.content });
      latestScript.current = undefined;
      setInteractiveAt(scriptedTimeMs ?? 0);
    }
  }, [machine, scriptedTimeMs]);
  const [revision, setRevision] = useState(0);
  const [ownsCompactNavigation,setOwnsCompactNavigation] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const raf = useRef(0);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const appDrag = useRef<{ y:number; top:number; lastY:number; time:number; velocity:number } | null>(null);
  const onClosedRef = useRef(onClosed); onClosedRef.current = onClosed;
  const publish = useCallback(() => {
    setSnapshot({ ...machine.snapshot, pose: { ...machine.snapshot.pose } });
  }, [machine]);
  const run = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const tick = (now: number) => {
      const moving = machine.tick(now);
      publish();
      if (moving) raf.current = requestAnimationFrame(tick);
      else if (machine.snapshot.phase === 'closed') {
        onClosedRef.current();
      }
    };
    raf.current = requestAnimationFrame(tick);
    publish();
  }, [machine, publish]);
  const close = useCallback(() => { takeControl(); machine.close(performance.now()); run(); }, [machine, run, takeControl]);
  useLayoutEffect(() => {
    restoreFocus.current = frameRef.current?.querySelector<HTMLButtonElement>(`[data-app-card-id="${CSS.escape(message.id)}"] [data-slot="mini-app-card"]`) ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    if (!scripted) { machine.open(performance.now()); run(); }
  }, [openRevision, machine, run]);
  useLayoutEffect(() => {
    if (snapshot.phase === 'closed' && restoreFocus.current?.isConnected) restoreFocus.current.focus({ preventScroll: true });
  }, [snapshot.phase]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { machine.reducedMotion = media.matches; };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [machine]);
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      // Local app frames have an opaque sandbox origin. Source identity is mandatory.
      if (event.source !== iframe.current?.contentWindow || event.data?.version !== 1) return;
      if (event.data.type === 'sheet-app:ready') { setOwnsCompactNavigation(event.data.compactNavigation === true); machine.ready(); publish(); }
      if (event.data.type === 'sheet-app:error') { machine.fail(); publish(); }
      if (event.data.type === 'sheet-app:close') close();
      if (event.data.type === 'sheet-app:expand' && (latestScript.current ?? machine.snapshot).pose.visible) { takeControl(); machine.expand(performance.now()); run(); }
      if (event.data.type === 'sheet-app:pan' && (latestScript.current ?? machine.snapshot).pose.visible) {
        const { phase,y,time } = event.data;
        if (!Number.isFinite(y) || !Number.isFinite(time)) return;
        if (phase === 'start') {
          takeControl(); cancelAnimationFrame(raf.current);
          appDrag.current = { y,top:machine.snapshot.pose.top,lastY:y,time,velocity:0 };
          machine.beginDrag(); publish();
        } else if (appDrag.current) {
          const d = appDrag.current;
          const scale = (frameRef.current?.getBoundingClientRect().height ?? 874)/1112;
          if (phase === 'move') {
            d.velocity=(y-d.lastY)/scale/Math.max(1,time-d.time);d.lastY=y;d.time=time;
            machine.drag(d.top+(y-d.y)/scale);publish();
          } else if (phase === 'end' || phase === 'cancel') {
            appDrag.current=null;
            if (phase==='cancel') machine.cancel(performance.now());
            else machine.release(time-d.time>100 ? 0 : d.velocity,performance.now());
            run();
          }
        }
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [machine, publish, close, run, takeControl, frameRef]);
  useEffect(() => {
    if (snapshot.content !== 'loading') return;
    const timeout = setTimeout(() => { machine.fail(); publish(); }, 10000);
    return () => clearTimeout(timeout);
  }, [snapshot.content, revision, machine, publish]);
  useEffect(() => {
    iframe.current?.contentWindow?.postMessage({ type: 'sheet-app:presentation', version: 1, presentation: (usingScript ? scripted : snapshot).pose.presentation }, '*');
  }, [snapshot.pose.presentation, snapshot.content, scripted?.pose.presentation, usingScript]);
  const display = usingScript ? { ...scripted, content: snapshot.content } : snapshot;
  const command = (action: () => void) => { takeControl(); action(); run(); };
  return <SheetSurface title={spec.title} snapshot={display} frameRef={frameRef} compactNavigation={!ownsCompactNavigation}
    onClose={close} onExpand={() => command(() => machine.expand(performance.now()))}
    onCompact={() => command(() => machine.compact(performance.now()))}
    onReload={() => { machine.reload(); setRevision(v => v + 1); publish(); }}
    onDragStart={() => { takeControl(); cancelAnimationFrame(raf.current); machine.beginDrag(); publish(); }}
    onDrag={top => { machine.drag(top); publish(); }} onRelease={v => command(() => machine.release(v, performance.now()))}
    onCancel={() => command(() => machine.cancel(performance.now()))}>
    <iframe key={revision} ref={iframe} data-slot="sheet-app-frame" title={`${spec.title} app`} src={spec.content.entry}
      sandbox="allow-scripts" referrerPolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'"
      onError={() => { machine.fail(); publish(); }} />
  </SheetSurface>;
}
