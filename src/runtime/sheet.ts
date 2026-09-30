import type { CompiledEvent } from '@/contracts';
import { SheetMachine, SHEET } from '@/renderers/ios/mini-app/sheet/motion';
export type SheetEvent = Extract<CompiledEvent, { type: 'sheet-app' }>;
/** Seek/play/pause all sample the same state. Recording timestamps are never inserted here. */
export function sheetAt(events: readonly SheetEvent[], timeMs: number) {
  let machine = new SheetMachine();
  let messageId: string | null = null;
  let closeAt: number | null = null;
  const advance = (time: number) => {
    if (closeAt !== null && time >= closeAt + SHEET.dismissMs) machine.tick(closeAt + SHEET.dismissMs);
    machine.tick(time);
  };
  for (const event of events) {
    if (event.atMs > timeMs) break;
    advance(event.atMs);
    if (event.action === 'open') {
      if (messageId !== event.messageId) { machine = new SheetMachine(); closeAt = null; }
      messageId = event.messageId;
      machine.open(event.atMs);
    } else if (messageId === event.messageId) {
      if (event.action === 'close') { machine.close(event.atMs); closeAt = event.atMs; }
      if (event.action === 'compact') { machine.compact(event.atMs); closeAt = null; }
      if (event.action === 'expand') { machine.expand(event.atMs); closeAt = null; }
    }
  }
  advance(timeMs);
  return { messageId, snapshot: machine.snapshot };
}
