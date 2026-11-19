import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests drive a real browser (the installed Chrome) against a real Laravel API and MySQL database
 * (`cineora_e2e`, never the development database). Everything runs on separate ports: API 8010, site 3110.
 */
const API = "http://localhost:8010";
const SITE = "http://localhost:3110";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: SITE, channel: "chrome", headless: true, trace: "retain-on-failure" },
  webServer: [
    {
      // Fresh schema + demo catalogue first: the API's throttle/session tables must exist before it can answer.
      command: "php artisan migrate:fresh --seed --force && php artisan serve --port=8010",
      cwd: "backend",
      url: `${API}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        APP_ENV: "local",
        APP_URL: API,
        DB_DATABASE: "cineora_e2e",
        FRONTEND_URL: SITE,
        SANCTUM_STATEFUL_DOMAINS: "localhost:3110",
        MAIL_MAILER: "log",
        LOG_CHANNEL: "single",
        REQUIRE_STAFF_MFA: "false",
      },
    },
    {
      command: "npm run build && npm run start -- -p 3110",
      url: SITE,
      reuseExistingServer: false,
      timeout: 240_000,
      env: { NEXT_PUBLIC_API_BASE_URL: API, NEXT_DIST_DIR: ".next-e2e", ALLOW_LOCAL_IMAGE_HOST: "true" },
    },
  ],
});
