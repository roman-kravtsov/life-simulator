import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: "/life-simulator/",
  plugins: [react()],
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
});
