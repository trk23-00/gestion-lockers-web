import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  timeout: 180000,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:3117",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: "list",
});
