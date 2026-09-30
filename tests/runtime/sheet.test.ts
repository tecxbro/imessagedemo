import { describe,it,expect } from 'vitest';
import { SheetMachine, SHEET } from '@/renderers/ios/mini-app/sheet/motion';
import { sheetAt } from '@/runtime/sheet';
import { referenceAt } from '../e2e/fixtures/sheet-reference/reference-motion';
import geometry from '../fixtures/sheet-handoff/geometry-native.json';
describe('sheet lifecycle and independent readiness',()=>{
  it('opens from below while content can remain loading or already be ready',()=>{
    const m=new SheetMachine();m.open(0);m.tick(233.333);expect(m.snapshot.pose.top).toBeCloseTo(150,1);expect(m.snapshot.content).toBe('loading');m.tick(500);expect(m.snapshot.phase).toBe('expanded');m.ready();expect(m.snapshot.pose.top).toBe(79);
  });
  it('passes continuously through compact; continues chat restoration after visual exit',()=>{
    const m=new SheetMachine();m.open(0);m.tick(500);m.close(500);m.tick(1000);expect(m.snapshot.pose.presentation).toBe('compact');expect(m.snapshot.phase).toBe('dismissing');m.tick(500+SHEET.dismissMs);expect(m.snapshot.pose.visible).toBe(false);expect(m.snapshot.pose.transcriptY).toBe(-315);m.tick(500+SHEET.dismissMs+200);expect(m.snapshot.pose.transcriptY).toBeGreaterThan(-315);m.tick(500+SHEET.dismissMs+SHEET.restoreMs);expect(m.snapshot.phase).toBe('closed');expect(m.snapshot.pose.transcriptY).toBe(0);
  });
  it('cancels a drag, uses tested hysteresis, expands from compact without resetting content',()=>{
    const m=new SheetMachine(true);m.open(0);m.ready();m.beginDrag();m.drag(500);expect(m.snapshot.pose.presentation).toBe('compact');m.drag(410);expect(m.snapshot.pose.presentation).toBe('compact');m.drag(390);expect(m.snapshot.pose.presentation).toBe('expanded');m.cancel(1);expect(m.snapshot.phase).toBe('expanded');m.compact(2);m.beginDrag();m.drag(740);m.cancel(3);expect(m.snapshot.phase).toBe('compact');m.expand(4);expect(m.snapshot.content).toBe('ready');
  });
  it('a single velocity release dismisses; interruption and late readiness cannot reopen',()=>{
    const m=new SheetMachine();m.open(0);m.tick(200);m.close(200);m.tick(300);const top=m.snapshot.pose.top;m.open(300);expect(m.snapshot.pose.top).toBe(top);m.tick(800);m.beginDrag();m.drag(300);m.release(SHEET.releaseVelocity+.1,810);expect(m.snapshot.phase).toBe('dismissing');m.tick(4000);m.ready();expect(m.snapshot.phase).toBe('closed');m.open(4010);m.tick(4510);expect(m.snapshot.content).toBe('ready');
  });
  it('seeks consistently through event-driven timeline poses and restores after close',()=>{
    const events=[{type:'sheet-app' as const,messageId:'app',atMs:1000,action:'open' as const},{type:'sheet-app' as const,messageId:'app',atMs:2000,action:'compact' as const},{type:'sheet-app' as const,messageId:'app',atMs:2500,action:'expand' as const},{type:'sheet-app' as const,messageId:'app',atMs:3000,action:'close' as const}];
    expect(sheetAt(events,1200).snapshot.phase).toBe('opening');expect(sheetAt(events,2400).snapshot.phase).toBe('compact');expect(sheetAt(events,2900).snapshot.phase).toBe('expanded');expect(sheetAt(events,4500).snapshot.phase).toBe('restoring');expect(sheetAt(events,5400).snapshot.phase).toBe('closed');expect(sheetAt(events,1200)).toEqual(sheetAt(events,1200));
  });
});
describe('live dismissal fidelity',()=>{
  it('keeps pointer capture geometry through an offscreen drag and then restores',()=>{
    const m=new SheetMachine();m.open(0);m.tick(500);m.beginDrag();m.drag(1200);
    expect(m.snapshot.pose.visible).toBe(true);expect(m.snapshot.phase).toBe('dragging');
    m.release(1,600);expect(m.snapshot.phase).toBe('restoring');m.tick(1600);expect(m.snapshot.phase).toBe('closed');
  });
  it('samples the production closing path at the original 30-fps panel positions',()=>{
    const m=new SheetMachine();m.open(0);m.tick(500);m.close(500);
    for(const row of geometry.filter(r=>r.clip==='clip_B'&&r.source_frame>=83&&r.source_frame<=122)){
      m.tick(500+(row.source_frame-82)/30*1000);
      expect(Math.abs(m.snapshot.pose.top-row.sheet_top_px!)).toBeLessThan(1);
      expect(m.snapshot.pose.presentation).toBe(row.source_frame>=95?'compact':'expanded');
    }
  });
});
describe('30-fps reference evidence',()=>{
  it('samples every measured shell edge within the specified three-pixel tolerance',()=>{
    for(const row of geometry) if(row.sheet_top_px!==undefined){const pose=referenceAt(row.clip==='clip_A'?'A':'B',row.source_frame/30*1000).pose;expect(Math.abs(pose.top-row.sheet_top_px)).toBeLessThan(3);expect(Math.abs(pose.inset-Math.min(10,row.sheet_left_px??0))).toBeLessThan(.01);}
  });
  it('keeps two white blanks, late light grabber, compact boundary, and post-exit host motion',()=>{
    for(const n of [33,34])expect(referenceAt('A',n/30*1000).content).toBe('blank');expect(referenceAt('A',35/30*1000).content).toBe('ready');expect(referenceAt('A',35/30*1000).pose.handle).toBe(0);expect(referenceAt('A',40/30*1000).pose.handle).toBeGreaterThan(0);
    expect(referenceAt('B',94/30*1000).pose.presentation).toBe('expanded');expect(referenceAt('B',95/30*1000).pose.presentation).toBe('compact');expect(referenceAt('B',102/30*1000).pose.composerVisible).toBe(true);expect(referenceAt('B',123/30*1000).pose.visible).toBe(false);expect(referenceAt('B',130/30*1000).pose.transcriptY).toBeLessThan(referenceAt('B',150/30*1000).pose.transcriptY);
  });
});
