import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.js",
      "src/**/*.test.jsx",
      "server/**/*.test.js",
      "scripts/**/*.test.mjs",
    ],
    setupFiles: ["./vitest.setup.js"],
  },
});
