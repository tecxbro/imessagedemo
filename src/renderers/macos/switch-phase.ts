/** Two-step conversation switch. A fresh mount on the destination is not a mid-switch frame. */

export type SwitchPhase = {
  kind: "settled" | "prepared" | "switching";
  checkpoint: string;
};

export function initialSwitchPhase(checkpoint: string, hasSwitch: boolean): SwitchPhase {
  return { kind: hasSwitch ? "prepared" : "settled", checkpoint };
}

/**
 * One layout step. Call again after the returned phase commits.
 * A changed checkpoint always returns to the departing conversation before the destination is applied.
 */
export function nextSwitchPhase(current: SwitchPhase, checkpoint: string, hasSwitch: boolean): SwitchPhase {
  if (!hasSwitch) {
    if (current.kind === "settled" && current.checkpoint === checkpoint) return current;
    return { kind: "settled", checkpoint };
  }
  if (current.kind === "switching" && current.checkpoint === checkpoint) return current;
  if (current.kind === "prepared" && current.checkpoint === checkpoint) return { kind: "switching", checkpoint };
  return { kind: "prepared", checkpoint };
}

export function isSwitchAligned(phase: SwitchPhase, checkpoint: string, hasSwitch: boolean): boolean {
  return phase.checkpoint === checkpoint && phase.kind === (hasSwitch ? "switching" : "settled");
}
