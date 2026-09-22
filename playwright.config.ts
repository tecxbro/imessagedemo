import { readFileSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const profiles = JSON.parse(readFileSync(new URL("./src/contracts/render-profiles.json", import.meta.url), "utf8")) as {
  ios: { width: number; height: number };
  macos: { width: number; height: number };
};

const engines = ["chromium", "webkit"] as const;
const platforms = ["ios", "macos"] as const;
const themes = ["light", "dark"] as const;

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  outputDir: "artifacts/playwright-output",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "artifacts/playwright/report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/?foundation=ios",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}{ext}",
  projects: engines.flatMap((engine) =>
    platforms.flatMap((platform) =>
      themes.map((theme) => ({
        name: `${engine}-${platform}-${theme}`,
        testMatch: /foundation\/shell-smoke\.spec\.ts/,
        use: {
          browserName: engine,
          viewport: { width: profiles[platform].width, height: profiles[platform].height },
          deviceScaleFactor: 1,
          colorScheme: theme === "dark" ? "dark" as const : "light" as const,
        },
      })),
    ),
  ),
});
