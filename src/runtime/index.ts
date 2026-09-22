import { notImplemented, type CompiledDemo, type PlaybackState, type Player, type RenderFrame } from "@/contracts";

export function stateAt(_compiled: CompiledDemo, _timeMs: number): PlaybackState {
  return notImplemented("stateAt");
}

export function frameAt(_compiled: CompiledDemo, _timeMs: number): RenderFrame {
  return notImplemented("frameAt");
}

export function createPlayer(_compiled: CompiledDemo): Player {
  return notImplemented("createPlayer");
}
