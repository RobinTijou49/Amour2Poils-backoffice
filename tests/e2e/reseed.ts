import { spawnSync } from "node:child_process";
import { assertTestDatabase } from "../test-db";
import { ADMIN, E2E_DATABASE_URL, EMPLOYEE } from "./accounts";

// Playwright s'exécute sous Node, qui n'a pas `Bun.password` (argon2) : les scripts de base de données sont lancés
// dans un sous-processus Bun, comme l'application elle-même.
function bun(args: string[], env: Record<string, string>) {
  // Windows : bun est installé comme un script `bun.cmd` (npm), que Node ne peut lancer qu'avec un shell.
  const result = spawnSync("bun", args, { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "inherit"], encoding: "utf8", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error(`« bun ${args.join(" ")} » a échoué (code ${result.status}${result.error ? `, ${result.error.message}` : ""})`);
}

/** Crée la base de test si besoin et applique les migrations. */
export function prepareDatabase() {
  assertTestDatabase(E2E_DATABASE_URL);
  bun(["tests/db-setup.ts"], { TEST_DATABASE_URL: E2E_DATABASE_URL });
}

/** Remet la base dans son état de départ : le vrai script de données de démonstration (`prisma/seed.ts`), avec les comptes de test. */
export function reseed() {
  assertTestDatabase(E2E_DATABASE_URL); // le seed efface tout : jamais autre chose qu'une base de test
  bun(["prisma/seed.ts"], {
    DATABASE_URL: E2E_DATABASE_URL,
    SEED_ADMIN_EMAIL: ADMIN.email,
    SEED_ADMIN_PASSWORD: ADMIN.password,
    SEED_EMPLOYEE_EMAIL: EMPLOYEE.email,
    SEED_EMPLOYEE_PASSWORD: EMPLOYEE.password,
  });
}
