/* Shared local sheet presentation bridge. Gesture thresholds are product choices, not recorded input. */
(() => {
  const notify = (phase, y, time) => parent.postMessage({ type:'sheet-app:pan', version:1, phase, y, time }, '*');
  let gesture = null;
  let expandedScroll = 0;
  let presentation = 'expanded';
  const scrollTop = () => document.scrollingElement?.scrollTop ?? 0;
  const start = (target, y, clientY, time, id) => {
    if (target.closest('button,a,input,textarea,select,[contenteditable="true"]')) return;
    if (scrollTop() > 1 && presentation !== 'compact') return;
    gesture = { y, clientY, time, id, active:false, axis:0 };
  };
  const move = (y, clientY, time) => {
    if (!gesture) return false;
    // Some WebKit hosts report screen Y with an upward axis. Calibrate it from
    // the first local movement before the iframe itself begins moving.
    if (!gesture.axis && Math.abs(clientY-gesture.clientY)>1) gesture.axis=Math.sign((y-gesture.y)*(clientY-gesture.clientY)) || 1;
    const delta=(y-gesture.y)*(gesture.axis || 1);
    if (!gesture.active && delta < -6) { gesture=null; return false; }
    if (!gesture.active && delta > 6) {
      gesture.active=true;
      notify('start',0,gesture.time);
    }
    if (gesture.active) notify('move',delta,time);
    return gesture.active;
  };
  const end = (phase,y,time) => { if (gesture?.active) notify(phase,(y-gesture.y)*(gesture.axis || 1),time); gesture=null; };
  window.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    start(e.target,e.screenY,e.clientY,e.timeStamp,e.pointerId);
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' || !gesture) return;
    if (move(e.screenY,e.clientY,e.timeStamp)) {
      e.preventDefault();
      if (!document.body.hasPointerCapture(e.pointerId)) document.body.setPointerCapture(e.pointerId);
    }
  }, {passive:false});
  window.addEventListener('pointerup', e => { if(e.pointerType !== 'touch')end('end',e.screenY,e.timeStamp); });
  window.addEventListener('pointercancel', e => { if(e.pointerType !== 'touch')end('cancel',e.screenY,e.timeStamp); });
  window.addEventListener('touchstart', e => { if(e.touches.length===1)start(e.target,e.touches[0].screenY,e.touches[0].clientY,e.timeStamp,0); },{passive:true});
  window.addEventListener('touchmove', e => { if(e.touches.length===1 && move(e.touches[0].screenY,e.touches[0].clientY,e.timeStamp))e.preventDefault(); },{passive:false});
  window.addEventListener('touchend', e => end('end',e.changedTouches[0]?.screenY ?? 0,e.timeStamp));
  window.addEventListener('touchcancel', e => end('cancel',0,e.timeStamp));
  window.addEventListener('message', e => {
    if (e.source!==parent || e.data?.type!=='sheet-app:presentation' || e.data.version!==1) return;
    if (presentation===e.data.presentation) return;
    const compact = e.data.presentation==='compact';
    if (compact) expandedScroll=scrollTop();
    presentation=e.data.presentation;
    document.body.dataset.presentation=presentation;
    window.scrollTo(0,compact ? 0 : expandedScroll);
    requestAnimationFrame(()=>window.scrollTo(0,compact ? 0 : expandedScroll));
  });
})();
