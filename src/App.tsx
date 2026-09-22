import { ShellPreview } from "@/foundation/ShellPreview";

export function App() {
  const params = new URLSearchParams(window.location.search);
  const foundation = params.get("foundation");
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  if (foundation === "ios" || foundation === "macos") {
    return <ShellPreview platform={foundation} theme={theme} />;
  }
  return (
    <main style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", padding: 24 }}>
      <h1>iMessage demo maker</h1>
      <p>Foundation shells mount the pinned components directly. Lane entry points are not implemented.</p>
      <ul>
        <li><a href="/?foundation=ios">iOS shell</a></li>
        <li><a href="/?foundation=macos">macOS shell</a></li>
        <li><a href="/?foundation=ios&theme=dark">iOS shell, dark</a></li>
        <li><a href="/?foundation=macos&theme=dark">macOS shell, dark</a></li>
      </ul>
    </main>
  );
}
