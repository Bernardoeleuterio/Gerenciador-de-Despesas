import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de tela, no navegador de verdade, contra o build do modo demo (sem
 * backend: cada teste começa com a demo zerada no próprio navegador).
 * Rode depois de `NEXT_PUBLIC_MODO=demo npm run build`.
 */
export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
  },
});
