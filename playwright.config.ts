import { defineConfig, devices } from "@playwright/test";

// Cloud sandboxes ship Chromium at a fixed path; CI installs its own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  // One retry on CI, with a trace of the retried run; locally a failure is a failure.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173/life-simulator/",
    trace: "on-first-retry",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 400, height: 860 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173/life-simulator/",
    reuseExistingServer: !process.env.CI,
  },
});
