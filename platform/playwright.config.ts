import { defineConfig } from "@playwright/test";

// The flow needs a Supabase project (see README). The dev server runs with the
// mock model and mock image provider so no AI key is spent.
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "AI_MOCK=1 IMAGE_PROVIDER=mock npm run dev",
        url: "http://localhost:3000/join",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
