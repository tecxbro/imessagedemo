import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Message } from "@/components/imessage/message-list";
import { IosMessagesApp } from '@/components/imessage/ios-messages-app';
import { MiniAppDock } from '@/renderers/ios/mini-app/MiniAppDock';
import { AppCardLayer, type AppCardMessage } from '@/renderers/ios/app-card/AppCardLayer';
import { SheetSurface } from '@/renderers/ios/mini-app/sheet/SheetSurface';
import { referenceAt, type Clip } from './reference-motion';
import '@/styles.css';
import './reference.css';
const params = new URLSearchParams(location.search);
const noop = () => {};
const interactive = params.has('interactive');
const spec = { id:'jump-jump-reference', companyName:'Reference only', title:'Jump Jump', description:'Hop from block to block - hold to charge, release to land. How far can you go?', experienceSummary:'Reference start screen; no gameplay was recorded.', hero:{src:'/demo-assets/sheet-reference/jump-jump.png',alt:'Jump Jump reference crop',width:357,height:188},content:{entry:'/demo-apps/sheet-reference.html'} };
const cards: AppCardMessage[] = ['jump-1','jump-2'].map(id=>({id,atMs:0,direction:'incoming',text:'',kind:'app-card',appCard:{app:'sheet',url:spec.content.entry,live:true,sheet:spec}}));
// Text visible in A n009; rendered by the pinned MessageList, not a baked chat screenshot.
const history: Message[] = [
  { id:'history-1', direction:'outgoing', text:'this is still here btw', sentAt:0, gapBefore:0 },
  { id:'history-2', direction:'incoming', text:"It’s ok", sentAt:0, gapBefore:18 },
  { id:'history-3', direction:'outgoing', text:'can you open the door', sentAt:0, gapBefore:28 },
  { id:'history-4', direction:'outgoing', text:'fumbled the entire interview.\nthey liked the grokbot and muse\nmini apps.\nbut felt like i was not able to\ndescribe my thinking very well.', sentAt:0, gapBefore:34 },
  { id:'history-5', direction:'outgoing', text:'can you open the door', sentAt:0, status:'read', gapBefore:34 },
];
function Reference() {
  const frameRef=useRef<HTMLDivElement>(null);
  const contentFrame=useRef<HTMLIFrameElement>(null);
  const contentLoaded=useRef(false);
  const [viewScale,setViewScale]=useState(()=>Math.min(1,(innerHeight-32)/1112,(innerWidth-32)/512));
  useEffect(()=>{const resize=()=>setViewScale(Math.min(1,(innerHeight-32)/1112,(innerWidth-32)/512));window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  const [clip,setClip]=useState<Clip>(params.get('clip')==='B'?'B':'A');
  const [time,setTime]=useState(Number(params.get('n')??0)/30*1000);
  const snapshot=referenceAt(clip,time), pose=snapshot.pose;
  useEffect(()=>{const ready=(e:MessageEvent)=>{if(e.source===contentFrame.current?.contentWindow&&e.data?.type==='sheet-app:ready')contentLoaded.current=true;};window.addEventListener('message',ready);return()=>window.removeEventListener('message',ready);},[]);
  useEffect(()=>{contentFrame.current?.contentWindow?.postMessage({type:'sheet-reference:frame',clip,n:Math.round(time*.03)},'*');},[clip,time]);
  useEffect(()=>{
    (window as any).sheetReference={set:async(c:Clip,n:number)=>{setClip(c);setTime(n/30*1000);for(let i=0;!interactive&&!contentLoaded.current&&i<300;i++)await new Promise(requestAnimationFrame);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));contentFrame.current?.contentWindow?.postMessage({type:'sheet-reference:frame',clip:c,n},'*');await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}};
    return()=>{delete (window as any).sheetReference;};
  },[]);
  useLayoutEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    let aligned = false;
    const align = () => {
      if (interactive && aligned) return;
      const content = root.querySelector<HTMLElement>('[data-slot="message-list-content"]');
      const row = root.querySelector<HTMLElement>('[data-app-card-id="jump-1"]');
      if (!content || !row || !row.firstElementChild) return;
      const scale = root.getBoundingClientRect().width / 512;
      const target = (408 + pose.transcriptY) * scale;
      const actual = row.getBoundingClientRect().top - root.getBoundingClientRect().top;
      const logicalScale = root.getBoundingClientRect().width / root.clientWidth;
      const margin = parseFloat(content.style.marginTop || '0') || 0;
      content.style.marginTop = `${margin + (target - actual) / logicalScale}px`;
      if (root.querySelector('[data-app-card-id="jump-2"] button')) aligned = true;
    };
    align();
    const observer = new MutationObserver(align);
    observer.observe(root, { childList:true,subtree:true });
    return () => observer.disconnect();
  }, [pose.transcriptY]);
  return <main data-reference-frame data-interactive-reference={interactive || undefined} style={{width:512,height:1112,overflow:'hidden',...(interactive?{position:'absolute',left:'50%',top:16,transform:`translateX(-50%) scale(${viewScale})`,transformOrigin:'50% 0'}:{})}}>
    <div className="reference-phone dark" style={{width:402,height:874,transform:'scale(1.27363184)',transformOrigin:'top left'}}>
    <IosMessagesApp frameRef={frameRef} width={402} height={874} time="18:22" contact={{name:'Hermes',initials:'H'}} screen="conversation"
      now={0} messages={[...history,...cards.map(card=>({id:card.id,direction:'incoming' as const,text:' ',sentAt:0,gapBefore:card.id==='jump-2'?4:42}))]} composer={{value:'',onChange:noop}}
      overlay={interactive ? <AppCardLayer messages={cards} frameRef={frameRef}/> : <>
        <style>{'[data-message-id^="jump-"] > :not([data-slot="app-card"]){display:none!important}'}</style>
        {cards.map(card=><MiniAppDock key={card.id} message={card} frameRef={frameRef} onOpenSheet={noop}/>)}
        <SheetSurface title="Jump Jump reference" snapshot={snapshot} frameRef={frameRef} reference
          onClose={noop} onExpand={noop} onCompact={noop} onReload={noop} onDragStart={noop} onDrag={noop} onRelease={noop} onCancel={noop}>
          <iframe ref={contentFrame} data-slot="reference-app-frame" title="Jump Jump reference content" src="/demo-apps/sheet-reference.html?fixture=1" sandbox="allow-scripts"
            onLoad={()=>contentFrame.current?.contentWindow?.postMessage({type:'sheet-reference:frame',clip,n:Math.round(time*.03)},'*')}/>

        </SheetSurface>
      </>}/>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Reference/>);
