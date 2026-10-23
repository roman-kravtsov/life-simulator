import { defineConfig } from "vitest/config";

// GitHub Pages serves the site from /<repo>/.
export default defineConfig({
  base: "/life-simulator/",
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
