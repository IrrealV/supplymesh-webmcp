import { defineConfig, devices } from "@playwright/test";

const previewPort = Number(process.env.PLAYWRIGHT_PREVIEW_PORT ?? 4173);
if (!Number.isInteger(previewPort) || previewPort < 1 || previewPort > 65_535) throw new Error("PLAYWRIGHT_PREVIEW_PORT must be a valid TCP port.");
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: previewUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `VITE_WEBMCP_LOCAL_BYPASS=true bun run build && bun run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: previewUrl,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
