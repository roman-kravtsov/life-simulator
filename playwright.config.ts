import { defineConfig, devices } from "@playwright/test";

// Cloud sandboxes ship Chromium at a fixed path; CI installs its own.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "e2e",
  use: {
    baseURL: "http://localhost:4173/life-simulator/",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], viewport: { width: 360, height: 740 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173/life-simulator/",
    reuseExistingServer: !process.env.CI,
  },
});
