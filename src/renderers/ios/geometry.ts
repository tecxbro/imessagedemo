export type Box = { left: number; top: number; width: number; height: number };
export type FrameRect = { x: number; y: number; width: number; height: number };

/**
 * Convert a viewport box into the device frame's unscaled coordinates.
 * A CSS transform on an ancestor changes getBoundingClientRect and must not change the frame's 402×874 metrics.
 */
export function viewportRectToFrame(host: Box, viewport: Box, layout: { width: number; height: number }): FrameRect {
  const scaleX = host.width / layout.width;
  const scaleY = host.height / layout.height;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX === 0 || scaleY === 0) {
    throw new Error("missing frame scale");
  }
  return {
    x: (viewport.left - host.left) / scaleX,
    y: (viewport.top - host.top) / scaleY,
    width: viewport.width / scaleX,
    height: viewport.height / scaleY,
  };
}
