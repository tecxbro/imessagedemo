import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: path.join(root, "artifacts/playwright-output-ios"),
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"], ["json", { outputFile: path.join(root, "artifacts/playwright-ios/report.json") }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    cwd: root,
    url: "http://127.0.0.1:4174/src/renderers/ios/harness.html",
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
