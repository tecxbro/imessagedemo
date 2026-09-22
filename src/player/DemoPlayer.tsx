import { useEffect, useMemo, useRef, useState } from "react";
import type { DemoPlayerProps, DemoPlatform, DemoTheme, RendererHandle } from "@/contracts";
import profiles from "@/contracts/render-profiles.json";
import { createPlayer } from "@/runtime";
import { IosDemoRenderer } from "@/renderers/ios";
import { MacDemoRenderer } from "@/renderers/macos";
import { CatalogueRoute, CatalogueSceneById, isCatalogueSceneId } from "@/player/catalogue";
import { checkpointAt, createRuntimeSession } from "@/player/controller";
import type { DemoRunManifest, NamedCheckpoint } from "@/player/types";

export type DemoPlayerViewProps = DemoPlayerProps & {
  clean?: boolean;
  checkpoints?: NamedCheckpoint[];
  scenarioId?: string;
  onScenario?: (id: string) => void;
  scenarios?: { id: string; title: string }[];
};

export function DemoPlayer({ compiled, ref, clean = false, checkpoints = [], scenarioId, onScenario, scenarios }: DemoPlayerViewProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<RendererHandle>(null);
  const [platform, setPlatform] = useState<DemoPlatform>(compiled.platform);
  const [theme, setTheme] = useState<DemoTheme>(compiled.theme);
  const [tick, setTick] = useState(0);
  const player = useMemo(() => createPlayer(compiled), [compiled]);
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

  useEffect(() => {
    window.IMESSAGE_DEMO = session;
    return () => {
      if (window.IMESSAGE_DEMO === session) delete window.IMESSAGE_DEMO;
    };
  }, [session]);

  useEffect(() => {
    let frameId = 0;
    const loop = () => {
      if (player.state().playing) setTick((value) => value + 1);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [player]);

  const state = player.state();
  const frame = { ...session.frame(), platform, theme };
  const profile = profiles[platform];
  const Renderer = platform === "macos" ? MacDemoRenderer : IosDemoRenderer;

  return (
    <div data-demo-player="" data-clean={clean ? "true" : "false"} data-tick={tick}>
      {clean ? null : (
        <PlayerChrome
          compiledId={compiled.id}
          platform={platform}
          theme={theme}
          playing={state.playing}
          timeMs={state.timeMs}
          durationMs={state.durationMs}
          checkpoints={checkpoints}
          inspect={session.inspect().messageId}
          scenarioId={scenarioId ?? compiled.id}
          scenarios={scenarios ?? [{ id: compiled.id, title: compiled.id }]}
          onScenario={onScenario}
          onPlatform={setPlatform}
          onTheme={setTheme}
          onPlay={() => {
            void session.play();
            setTick((value) => value + 1);
          }}
          onPause={() => {
            void session.pause();
            setTick((value) => value + 1);
          }}
          onReset={() => {
            void session.reset();
            setTick((value) => value + 1);
          }}
          onSeek={(timeMs) => {
            void session.seek(timeMs);
            setTick((value) => value + 1);
          }}
        />
      )}
      <div
        ref={frameRef}
        data-demo-frame=""
        data-platform={platform}
        data-theme={theme}
        className={theme === "dark" ? "dark" : undefined}
        style={{ width: profile.width, height: profile.height }}
      >
        <Renderer ref={rendererRef} compiled={{ ...compiled, platform, theme }} frame={frame} />
      </div>
    </div>
  );
}

function PlayerChrome(props: {
  compiledId: string;
  platform: DemoPlatform;
  theme: DemoTheme;
  playing: boolean;
  timeMs: number;
  durationMs: number;
  checkpoints: NamedCheckpoint[];
  inspect: string | null;
  scenarioId: string;
  scenarios: { id: string; title: string }[];
  onScenario?: (id: string) => void;
  onPlatform: (platform: DemoPlatform) => void;
  onTheme: (theme: DemoTheme) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSeek: (timeMs: number) => void;
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
      <button type="button" onClick={props.onPlay} disabled={props.playing}>
        Play
      </button>
      <button type="button" onClick={props.onPause} disabled={!props.playing}>
        Pause
      </button>
      <button type="button" onClick={props.onReset}>
        Reset
      </button>
      <label>
        Seek
        <input
          aria-label="Seek"
          type="range"
          min={0}
          max={props.durationMs}
          value={props.timeMs}
          onChange={(event) => props.onSeek(Number(event.target.value))}
        />
      </label>
      <label>
        Checkpoint
        <select
          aria-label="Checkpoint"
          defaultValue=""
          onChange={(event) => {
            if (!event.target.value) return;
            props.onSeek(checkpointAt(props.checkpoints, event.target.value).atMs);
          }}
        >
          <option value="">Named checkpoints</option>
          {props.checkpoints.map((checkpoint) => (
            <option key={checkpoint.id} value={checkpoint.id}>
              {checkpoint.id}
            </option>
          ))}
        </select>
      </label>
      {props.inspect ? <p data-inspect-id={props.inspect}>Inspect {props.inspect}</p> : null}
    </div>
  );
}

export function PlayerHost({ manifest }: { manifest: DemoRunManifest }) {
  const [scenarioId, setScenarioId] = useState(manifest.approvedScenarioId);
  const clean = manifest.clean || manifest.mode === "capture";
  const catalogue = isCatalogueSceneId(scenarioId) || manifest.mode === "catalogue";

  if (catalogue) {
    return (
      <div data-demo-player="" data-clean={clean ? "true" : "false"}>
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
