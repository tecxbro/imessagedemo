import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PlayerHost } from "@/player/DemoPlayer";
import type { DemoRunManifest } from "@/player/types";
import "@/styles.css";

const mount = document.getElementById("root") ?? throwMissingRoot();

function throwMissingRoot(): never {
  throw new Error("Missing #root");
}

async function boot(): Promise<void> {
  const response = await fetch("/__demo/manifest.json");
  if (!response.ok) throw new Error("Demo run manifest is not available");
  const manifest = (await response.json()) as DemoRunManifest;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("scenario");
  if (requested && requested !== manifest.approvedScenarioId) {
    mount.textContent = "Scenario is not approved for this run.";
    return;
  }
  createRoot(mount).render(
    <StrictMode>
      <PlayerHost manifest={manifest} />
    </StrictMode>,
  );
}

void boot();
