import { defineConfig, devices } from "@playwright/test";
import { E2E_DATABASE_URL, E2E_PORT } from "./tests/e2e/accounts";

// Tests de bout en bout : un vrai navigateur (Chromium) pilote la VRAIE construction de production de l'application,
// branchée sur une base de test dédiée. Lancer : `bun run test:e2e` (construit puis teste) ou `bunx playwright test`
// si `bun run build` vient d'être fait. Rapport : `bunx playwright show-report`.
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Une seule base partagée : les fichiers de test s'exécutent l'un après l'autre.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `next start` sert la construction de production : c'est elle qui enregistre le service worker (inactif en `dev`).
    command: `bun --bun next start -p ${E2E_PORT}`,
    // /connexion et non /api/health : Playwright démarre le serveur AVANT globalSetup, donc avant que la base de test existe.
    url: `http://localhost:${E2E_PORT}/connexion`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NODE_ENV: "production",
      // Valeurs factices mais de forme valide : src/lib/env.ts les exige au démarrage en production.
      VAPID_PUBLIC_KEY: `B${"p".repeat(86)}`,
      VAPID_PRIVATE_KEY: "k".repeat(43),
      VAPID_SUBJECT: "mailto:e2e@test.local",
      CRON_SECRET: "secret-e2e-assez-long-pour-etre-valide",
    },
  },
});
