import { readFileSync } from "node:fs";
import path from "node:path";
import type { DemoPlatform, DemoTheme } from "@/contracts";

export type CaptureConstants = {
  locale: "en-US";
  timeZone: "UTC";
  reducedMotion: "reduce";
  dpr: Record<DemoPlatform, number>;
};

export function loadCaptureConstants(repoRoot: string): CaptureConstants {
  return JSON.parse(readFileSync(path.join(repoRoot, "scripts/capture/constants.json"), "utf8")) as CaptureConstants;
}

export function colorScheme(theme: DemoTheme): "light" | "dark" {
  return theme;
}
