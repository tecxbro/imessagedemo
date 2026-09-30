import motion from '../../../fixtures/sheet-handoff/motion.json';
import geometry from '../../../fixtures/sheet-handoff/geometry-native.json';
import { closedPose, type SheetSnapshot } from '@/renderers/ios/mini-app/sheet/motion';
export type Clip = 'A' | 'B';
// Geometry is linearly interpolated between native 30-fps samples. This is an approximation,
// not new 60-fps evidence. Readiness/presentation changes occur at the first observed native frame.
const sample = (track: Array<[number, number]>, n: number) => {
  const hi = track.findIndex(([frame]) => frame >= n);
  if (hi === -1) return track.at(-1)![1];
  if (hi === 0) return track[0][1];
  const [f0,v0] = track[hi-1], [f1,v1] = track[hi];
  return v0 + (v1-v0) * ((n-f0)/(f1-f0));
};
export function referenceAt(clip: Clip, timeMs: number): SheetSnapshot {
  const n = timeMs * .03;
  const rows = clip === 'A' ? motion.opening.track : motion.closing.track;
  const track: Array<[number,number]> = rows.map(r => [r.time_ms * .03, r.top_px ?? 1112]);
  const top = sample(track,n);
  const inset = clip === 'A' ? 0 : sample(motion.closing.track.map(r => [r.time_ms * .03, Math.min(10,r.left_px ?? 10)]),n);
  const opening = clip === 'A';
  let hostTrack: Array<[number,number]>;
  if (opening) hostTrack = [[0,408],[8,408],[9,764],[10,650],[11,543],[12,443],[13,354],[14,278],[15,214],[16,162],[17,121],[18,102],[19,82],[20,-300],[21,-177],[22,-80],[23,12],[24,92],[25,45],[26,0],[35,-3]];
  else hostTrack = [[0,-3],[94,-3], ...geometry.filter(r => r.clip === 'clip_B' && r.source_frame >= 95).map(r => [r.source_frame, (r.hero_candidates?.[0]?.hero_top_px ?? 297) - (r.source_frame < 123 ? 300 : 0)] as [number,number])];
  // Composer bounds are visually estimated from the supplied PNGs, not part of geometry-native.json.
  const composerY = opening ? sample([[0,0],[8,0],[9,-426],[19,-419],[20,-419],[35,-419]],n)
    : sample([[0,-419],[101,-410],[102,-410],[104,-410],[105,-408],[108,-363],[114,-243],[119,-147],[122,-40],[123,-28],[130,-4],[150,0]],n);
  const visible = opening ? n >= 20 && n < 129 : n < 123;
  const compact = !opening && n + .00002 >= 95;
  const content = opening ? n < 33 ? 'loading' : n + .00002 < 35 ? 'blank' : 'ready' : 'ready';
  const height = opening ? 1033 : Math.max(409,1112-inset-top);
  return { phase: !visible ? opening && n < 9 ? 'closed' : opening && n < 20 ? 'opening' : n < 151 ? 'restoring' : 'closed' : opening && n < 35 ? 'opening' : opening || n < 83 ? 'expanded' : 'dismissing', content,
    pose: { ...closedPose(), top, inset, height, visible, transcriptY: sample(hostTrack,n)-408, composerY,
      composerVisible: opening ? n < 24 : n >= 102, dim: opening && n >= 21 ? .30 : !opening && n < 95 ? .30 : 0,
      handle: opening && n >=33 ? Math.min(1,Math.max(0,(n-39)/5)) : 1, presentation: compact ? 'compact' : 'expanded' } };
}
export function contentBounds(clip: Clip, timeMs: number) {
  const n = Math.round(timeMs * .03);
  const row = geometry.find(r => r.clip === `clip_${clip}` && r.source_frame === n);
  return { title: row?.title_bbox_px ?? (clip === 'B' && n >=102 ? [159, referenceAt(clip,timeMs).pose.top+84,354,referenceAt(clip,timeMs).pose.top+121] : [65,247,449,317]), control: row?.control_bbox_px };
}
export const bounceY = (timeMs: number) => sample([[35,266],[36,345],[37,412],[38,465],[39,487],[40,462],[41,440],[42,432],[43,443],[44,469],[45,496],[46,493],[47,493],[49,493]], timeMs*.03)-493;
