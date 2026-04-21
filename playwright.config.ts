import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true
  },
  webServer: [
    {
      command: "npm.cmd run dev:backend",
      url: "http://127.0.0.1:3001/api/health",
      reuseExistingServer: true,
      timeout: 120000
    },
    {
      command: "npm.cmd run dev --workspace @scenaairo/frontend -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
});
