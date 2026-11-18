import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Enregistrement de la vidéo de démonstration (pas un test de non-régression) : même serveur de production et même base de
// test que les tests de bout en bout, mais un seul scénario, dans tests/video. Lancer : `bun run demo:video`.
export default defineConfig({
  ...base,
  testDir: "./tests/video",
  testMatch: "*.spec.ts",
  timeout: 240_000,
  reporter: [["list"]],
});
