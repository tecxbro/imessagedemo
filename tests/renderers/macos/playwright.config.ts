import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  outputDir: "../../../artifacts/macos-playwright-output",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "../../../artifacts/macos-playwright/report.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    viewport: { width: 1100, height: 800 },
    deviceScaleFactor: 1,
    trace: "off",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4174",
    url: "http://127.0.0.1:4174/",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
