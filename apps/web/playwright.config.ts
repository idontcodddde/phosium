import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const appUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const workspaceRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    baseURL: appUrl,
    browserName: "chromium",
    headless: true,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
      command: "pnpm dev",
      cwd: workspaceRoot,
      url: appUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
});
