/** Pin the log to the end of the authored transcript. A short log stays at 0. */
export function checkpointScrollTop(list: HTMLElement): number {
  return Math.max(0, list.scrollHeight - list.clientHeight);
}

/**
 * Write the checkpoint after layout. `overflow-anchor: none` stops the browser from keeping a stale
 * offset when a reverse seek does not change the message count.
 */
export function applyCheckpointScroll(root: ParentNode): number {
  const list = root.querySelector<HTMLElement>('[data-slot="message-list"]');
  if (!list) return 0;
  list.style.overflowAnchor = "none";
  const target = checkpointScrollTop(list);
  if (list.scrollTop !== target) list.scrollTop = target;
  return list.scrollTop;
}
