/** Source coordinates are encoded pixels (512 × 1112), not native iOS points.
 * Geometry follows the 30-fps samples; live gesture decisions remain explicit product choices. */
export type SheetPhase = 'closed' | 'opening' | 'expanded' | 'dragging' | 'settling' | 'compact' | 'dismissing' | 'restoring';
export type ContentStatus = 'idle' | 'loading' | 'blank' | 'ready' | 'error';
export type SheetPose = { top: number; inset: number; height: number; transcriptY: number; composerY: number; composerVisible: boolean; dim: number; handle: number; presentation: 'expanded' | 'compact'; visible: boolean };
export const SHEET = { width: 512, height: 1112, top: 79, compactTop: 661, compactHeight: 441, hostTravel: 408, collapseAt: 437, expandAt: 395, dismissAt: 850, releaseVelocity: .65, openingMs: 500, settleMs: 320, dismissMs: 41/30*1000, restoreMs: 28/30*1000 } as const;
type Track = readonly (readonly [number, number])[];
export function sampleTrack(track: Track, x: number): number {
  const hi = track.findIndex(([at]) => at >= x);
  if (hi < 0) return track.at(-1)![1];
  if (hi === 0) return track[0][1];
  const [a, from] = track[hi - 1], [b, to] = track[hi];
  return from + (to - from) * (x - a) / (b - a);
}
// B n082–123. The last offscreen y1112 point is an extrapolation at the observed exit.
const closingTops = [79,91,110,129,149,172,194,219,245,273,309,351,395,437,474,507,536,563,590,616,640,661,680,700,719,737,753,768,783,798,814,831,848,867,891,911,930,949,980,1023,1076,1112];
const closingTrack: Track = closingTops.map((top, index) => [index / 30 * 1000, top]);
const closingClock: Track = closingTops.map((top, index) => [top, index / 30 * 1000]);
export function closingTop(elapsedMs: number) { return sampleTrack(closingTrack, elapsedMs); }
// Geometry is parameterized by panel position so a real pointer can move in either direction.
const insets: Track = [[79,0],[110,1],[194,2],[245,3],[309,4],[395,5],[437,6],[474,7],[536,8],[590,9],[640,10]];
const heights: Track = [[79,1033],[640,462],[661,441],[680,422],[700,409]];
// Composer positions are separately estimated from source images, not a recorded pointer trace.
const composerTrack: Track = [[79,-419],[640,-410],[680,-410],[700,-408],[753,-363],[848,-243],[949,-147],[1076,-40],[1112,-28]];
const hostTrack: Track = [[79,-408],[680,-408],[700,-435],[719,-455],[753,-461],[814,-435],[848,-400],[949,-332],[1076,-349],[1112,-315]];
export const closedPose = (): SheetPose => ({ top: 1112, inset: 0, height: 1033, transcriptY: 0, composerY: 0, composerVisible: true, dim: 0, handle: 1, presentation: 'expanded', visible: false });
export function poseAtTop(top: number, presentation: SheetPose['presentation']): SheetPose {
  return { top, inset: sampleTrack(insets,top), height: sampleTrack(heights,top), transcriptY: sampleTrack(hostTrack,top), composerY: sampleTrack(composerTrack,top), composerVisible: top >= 640, dim: Math.max(0, Math.min(.30, (437-top)/1193)), handle: 1, presentation, visible: top < 1112 };
}
export const expandedPose = (): SheetPose => poseAtTop(79, 'expanded');
export function mixPose(a: SheetPose, b: SheetPose, t: number): SheetPose {
  const p = Math.max(0, Math.min(1, t)), out = { ...b };
  for (const key of ['top','inset','height','transcriptY','composerY','dim','handle'] as const) out[key] = a[key] + (b[key] - a[key]) * p;
  return out;
}
// A n020 offscreen extrapolation followed by n021–035 measured top edges.
const openingTops = [1112,984,733,525,370,261,194,150,122,104,94,86,84,82,81,79];
export function openingTop(progress: number): number { return sampleTrack(openingTops.map((y,i)=>[i/15,y]),progress); }
export type SheetSnapshot = { phase: SheetPhase; content: ContentStatus; pose: SheetPose };
type Animation = { start: number; duration: number; from: SheetPose; to: SheetPose; phase: SheetPhase; next: SheetPhase; opening: boolean; closingClock?: number };
const presentationAt = (top: number, previous: SheetPose['presentation']) => top >= SHEET.collapseAt ? 'compact' : top <= SHEET.expandAt ? 'expanded' : previous;
/** Event-driven live state machine; the recordings' idle/loading delays are never used here. */
export class SheetMachine {
  snapshot: SheetSnapshot = { phase: 'closed', content: 'idle', pose: closedPose() };
  private animation: Animation | null = null;
  private prior: 'compact' | 'expanded' = 'expanded';
  constructor(public reducedMotion = false) {}
  private animate(to: SheetPose, phase: SheetPhase, next: SheetPhase, now: number, duration: number, opening = false, closingClock?: number) {
    this.animation = { start: now, duration: this.reducedMotion ? 0 : duration, from: this.snapshot.pose, to, phase, next, opening, closingClock };
    this.snapshot = { ...this.snapshot, phase, pose: { ...this.snapshot.pose, visible: phase !== 'restoring' } };
    this.tick(now);
  }
  adopt(snapshot: SheetSnapshot) { this.animation = null; this.snapshot = { ...snapshot, pose: { ...snapshot.pose } }; }
  open(now: number) {
    if (['expanded','opening'].includes(this.snapshot.phase)) return;
    if (this.snapshot.content === 'idle') this.snapshot = { ...this.snapshot, content: 'loading' };
    this.animate(expandedPose(), 'opening', 'expanded', now, SHEET.openingMs, this.snapshot.phase === 'closed');
  }
  expand(now: number) { this.animate(expandedPose(), 'settling', 'expanded', now, SHEET.settleMs); }
  compact(now: number) { this.animate(poseAtTop(SHEET.compactTop,'compact'), 'settling', 'compact', now, SHEET.settleMs); }
  close(now: number) {
    if (['closed','dismissing','restoring'].includes(this.snapshot.phase)) return;
    const clock = sampleTrack(closingClock,this.snapshot.pose.top);
    this.animate(poseAtTop(1112,'compact'), 'dismissing', 'restoring', now, SHEET.dismissMs-clock, false, clock);
  }
  ready() { this.snapshot = { ...this.snapshot, content: 'ready' }; }
  fail() { this.snapshot = { ...this.snapshot, content: 'error' }; }
  reload() { this.snapshot = { ...this.snapshot, content: 'loading' }; }
  beginDrag() { this.prior = this.snapshot.pose.presentation; this.animation = null; this.snapshot = { ...this.snapshot, phase:'dragging' }; }
  drag(top: number) {
    if (this.snapshot.phase !== 'dragging') return;
    // Keep the captured element mounted until pointerup, including a drag below the phone.
    this.snapshot = { ...this.snapshot, pose: { ...poseAtTop(Math.max(79,top),presentationAt(top,this.snapshot.pose.presentation)), visible:true } };
  }
  cancel(now: number) { this.prior === 'compact' ? this.compact(now) : this.expand(now); }
  release(velocity: number, now: number) {
    if (velocity > SHEET.releaseVelocity || this.snapshot.pose.top > SHEET.dismissAt) this.close(now);
    else if (velocity < -SHEET.releaseVelocity || this.snapshot.pose.presentation === 'expanded') this.expand(now);
    else this.compact(now);
  }
  tick(now: number): boolean {
    const a = this.animation;
    if (!a) return false;
    const p = a.duration === 0 || now >= a.start+a.duration-1e-6 ? 1 : Math.max(0,(now-a.start)/a.duration);
    // Chosen settle deceleration; it is not presented as an Apple spring.
    let pose = mixPose(a.from,a.to,1-(1-p)**3);
    if (a.opening) pose = { ...pose, top: openingTop(p), height:1033 };
    else if (a.phase === 'dismissing') {
      pose = poseAtTop(closingTop(a.closingClock! + (SHEET.dismissMs-a.closingClock!)*p),'compact');
      const nominalStart = poseAtTop(a.from.top,a.from.presentation);
      // Interruptions begin at the currently displayed host pose, without a discontinuity.
      for (const key of ['transcriptY','composerY','inset','height'] as const) pose[key] += (a.from[key]-nominalStart[key])*(1-p)**3;
      pose.presentation = presentationAt(pose.top,this.snapshot.pose.presentation);
    } else if (a.phase === 'settling' || a.phase === 'opening') {
      const geometry = poseAtTop(pose.top,presentationAt(pose.top,this.snapshot.pose.presentation));
      pose = { ...pose, inset:geometry.inset, height:geometry.height, presentation:geometry.presentation, composerVisible:geometry.composerVisible };
    } else if (a.phase === 'restoring') {
      // Measured post-exit chat displacement, normalized to the remaining live travel.
      const remaining = sampleTrack([[0,315],[1/28,259],[3/28,175],[7/28,81],[12/28,32],[17/28,12],[22/28,5],[27/28,2],[1,0]],p)/315;
      pose.transcriptY = remaining === 0 ? 0 : a.from.transcriptY*remaining;
      pose.visible = false;
    }
    this.snapshot = { ...this.snapshot, pose, phase:p === 1 ? a.next : a.phase };
    if (p === 1) {
      this.animation = null;
      if (a.next === 'restoring') {
        this.animate(closedPose(),'restoring','closed',a.start+a.duration,SHEET.restoreMs);
        if (now > a.start+a.duration) this.tick(now);
      }
    }
    return this.animation !== null;
  }
}
