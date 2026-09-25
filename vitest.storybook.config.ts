import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [
    storybookTest({
      configDir: path.join(__dirname, ".storybook")
    })
  ],
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: "playwright",
      instances: [
        {
          browser: "chromium"
        }
      ]
    },
    setupFiles: [".storybook/vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  }
});
