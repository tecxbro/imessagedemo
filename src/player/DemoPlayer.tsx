import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DemoPlayerProps, DemoPlatform, DemoTheme, RendererHandle } from "@/contracts";
import profiles from "@/contracts/render-profiles.json";
import { createPlayer } from "@/runtime";
import { IosDemoRenderer } from "@/renderers/ios";
import { MacDemoRenderer, type MacRendererHandle } from "@/renderers/macos";
import { CatalogueRoute, CatalogueSceneById, isCatalogueSceneId } from "@/player/catalogue";
import { createRuntimeSession } from "@/player/controller";
import { playbackBarHeightPx, playbackControlLabel, runPlaybackControl } from "@/player/playback";
import type { DemoRunManifest, NamedCheckpoint } from "@/player/types";

export type DemoPlayerViewProps = DemoPlayerProps & {
  /** Minimal viewer: playback button only, no scenario/platform/theme toolbar. */
  clean?: boolean;
  /** Automated capture: no visible controls and no automatic playback. */
  capture?: boolean;
  checkpoints?: NamedCheckpoint[];
  scenarioId?: string;
  onScenario?: (id: string) => void;
  scenarios?: { id: string; title: string }[];
  initialTimeMs?: number;
  playbackBaseline?: number;
};

const noCheckpoints: NamedCheckpoint[] = [];

export function DemoPlayer({
  compiled,
  ref,
  clean = false,
  capture = false,
  checkpoints = noCheckpoints,
  scenarioId,
  onScenario,
  scenarios,
  initialTimeMs = 0,
  playbackBaseline = 0,
}: DemoPlayerViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RendererHandle>(null);
  const bindMacRenderer = useCallback((handle: MacRendererHandle | null) => {
    rendererRef.current = handle;
  }, []);
  const [platform, setPlatform] = useState<DemoPlatform>(compiled.platform);
  const [theme, setTheme] = useState<DemoTheme>(compiled.theme);
  const [tick, setTick] = useState(0);
  const player = useMemo(() => {
    const created = createPlayer(compiled);
    if (initialTimeMs !== 0) created.seek(initialTimeMs);
    return created;
  }, [compiled, initialTimeMs]);
  const session = useMemo(
    () =>
      createRuntimeSession({
        compiled,
        player,
        checkpoints,
        getRenderer: () => rendererRef.current,
        getFrameElement: () => frameRef.current,
      }),
    [compiled, player, checkpoints],
  );

  useEffect(() => {
    session.setView(platform, theme);
  }, [platform, session, theme]);

  useEffect(() => {
    const handle: RendererHandle = {
      seek(timeMs: number) {
        void session.seek(timeMs);
      },
      get element() {
        return rendererRef.current?.element ?? frameRef.current;
      },
    };
    if (typeof ref === "function") ref(handle);
    else if (ref) ref.current = handle;
    return () => {
      if (typeof ref === "function") ref(null);
      else if (ref) ref.current = null;
    };
  }, [ref, session]);

  if (typeof window !== "undefined") {
    window.IMESSAGE_DEMO = session;
    window.__demoPlayer = session;
  }

  useEffect(() => {
    window.IMESSAGE_DEMO = session;
    window.__demoPlayer = session;
    return () => {
      if (window.IMESSAGE_DEMO === session) delete window.IMESSAGE_DEMO;
      if (window.__demoPlayer === session) delete window.__demoPlayer;
    };
  }, [session]);

  useEffect(() => player.subscribe(() => setTick((value) => value + 1)), [player]);

  useEffect(() => {
    let frameId = 0;
    const loop = () => {
      if (player.state().playing) setTick((value) => value + 1);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [player]);

  useEffect(() => {
    const active = player;
    return () => {
      active.pause();
    };
  }, [player]);

  const state = player.state();
  const frame = { ...session.frame(), platform, theme };
  const profile = profiles[platform];
  const compiledView = { ...session.playbackCompiled(), platform, theme };
  const playbackLabel = playbackControlLabel(state);
  const onPlayback = () => {
    void runPlaybackControl(player.state(), session);
  };

  return (
    <div
      data-demo-player=""
      data-clean={clean ? "true" : "false"}
      data-capture={capture ? "true" : "false"}
      data-tick={tick}
    >
      {capture ? null : clean ? (
        <div
          data-playback-bar=""
          style={{
            boxSizing: "border-box",
            display: "flex",
            alignItems: "center",
            width: profile.width,
            height: playbackBarHeightPx,
            padding: "0 12px",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          <PlaybackButton label={playbackLabel} onClick={onPlayback} />
        </div>
      ) : (
        <PlayerChrome
          platform={platform}
          theme={theme}
          playbackLabel={playbackLabel}
          inspect={session.inspect().messageId}
          scenarioId={scenarioId ?? compiled.id}
          scenarios={scenarios ?? [{ id: compiled.id, title: compiled.id }]}
          onScenario={onScenario}
          onPlatform={setPlatform}
          onTheme={setTheme}
          onPlayback={onPlayback}
        />
      )}
      <div
        ref={frameRef}
        data-demo-frame=""
        data-platform={platform}
        data-theme={theme}
        data-playback-baseline={playbackBaseline}
        className={theme === "dark" ? "dark" : undefined}
        style={{ width: profile.width, height: profile.height }}
      >
        {platform === "macos" ? (
          <MacDemoRenderer ref={bindMacRenderer} compiled={compiledView} frame={frame} />
        ) : (
          <IosDemoRenderer ref={rendererRef} compiled={compiledView} frame={frame} />
        )}
      </div>
    </div>
  );
}

function PlaybackButton({ label, onClick }: { label: ReturnType<typeof playbackControlLabel>; onClick: () => void }) {
  return (
    <button type="button" data-playback-control="" onClick={onClick}>
      {label}
    </button>
  );
}

function PlayerChrome(props: {
  platform: DemoPlatform;
  theme: DemoTheme;
  playbackLabel: ReturnType<typeof playbackControlLabel>;
  inspect: string | null;
  scenarioId: string;
  scenarios: { id: string; title: string }[];
  onScenario?: (id: string) => void;
  onPlatform: (platform: DemoPlatform) => void;
  onTheme: (theme: DemoTheme) => void;
  onPlayback: () => void;
}) {
  return (
    <div data-player-chrome="">
      <label>
        Scenario
        <select aria-label="Scenario" value={props.scenarioId} onChange={(event) => props.onScenario?.(event.target.value)}>
          {props.scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.title}
            </option>
          ))}
        </select>
      </label>
      <div>
        <button type="button" aria-pressed={props.platform === "ios"} onClick={() => props.onPlatform("ios")}>
          iOS
        </button>
        <button type="button" aria-pressed={props.platform === "macos"} onClick={() => props.onPlatform("macos")}>
          macOS
        </button>
      </div>
      <div>
        <button type="button" aria-pressed={props.theme === "light"} onClick={() => props.onTheme("light")}>
          Light
        </button>
        <button type="button" aria-pressed={props.theme === "dark"} onClick={() => props.onTheme("dark")}>
          Dark
        </button>
      </div>
      <PlaybackButton label={props.playbackLabel} onClick={props.onPlayback} />
      {props.inspect ? <p data-inspect-id={props.inspect}>Inspect {props.inspect}</p> : null}
    </div>
  );
}

export function PlayerHost({ manifest }: { manifest: DemoRunManifest }) {
  const [scenarioId, setScenarioId] = useState(manifest.approvedScenarioId);
  const capture = manifest.mode === "capture";
  const clean = manifest.clean || capture;
  const catalogue = isCatalogueSceneId(scenarioId) || manifest.mode === "catalogue";

  if (catalogue) {
    return (
      <div data-demo-player="" data-clean={clean ? "true" : "false"} data-capture={capture ? "true" : "false"}>
        {clean ? null : (
          <div data-player-chrome="">
            <p>Catalogue</p>
          </div>
        )}
        <div data-demo-frame="" data-theme={manifest.theme} className={manifest.theme === "dark" ? "dark" : undefined}>
          {manifest.mode === "catalogue" && scenarioId === manifest.approvedScenarioId ? (
            <CatalogueRoute theme={manifest.theme} />
          ) : (
            <CatalogueSceneById id={scenarioId} theme={manifest.theme} />
          )}
        </div>
      </div>
    );
  }

  if (!manifest.compiled) {
    return <p data-player-error="">No compiled scenario is approved for this run.</p>;
  }

  if (scenarioId !== manifest.approvedScenarioId && !isCatalogueSceneId(scenarioId)) {
    return <p data-player-error="">Scenario is not approved for this run.</p>;
  }

  return (
    <DemoPlayer
      compiled={manifest.compiled}
      clean={clean}
      capture={capture}
      checkpoints={manifest.checkpoints}
      scenarioId={scenarioId}
      onScenario={setScenarioId}
      scenarios={[
        { id: manifest.approvedScenarioId, title: manifest.compiled.id },
        { id: "ios-text", title: "iOS text conversation" },
        { id: "macos-text", title: "macOS text conversation" },
      ]}
    />
  );
}
