import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith("_test") || !["127.0.0.1", "localhost"].includes(new URL(database).hostname)) throw new Error("E2E requires dedicated loopback *_test database");
export default defineConfig({
  testDir: "./tests/e2e", fullyParallel: false, workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: { baseURL: "http://localhost:3100", trace: "off", screenshot: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node apps/web/node_modules/next/dist/bin/next dev apps/web -p 3100",
    url: "http://localhost:3100/entrar", reuseExistingServer: false, timeout: 120000,
    env: { DATABASE_URL: database, APP_URL: "http://localhost:3100", MFA_ENCRYPTION_KEY: "a".repeat(64) },
  },
});
