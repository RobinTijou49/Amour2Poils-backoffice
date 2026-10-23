// Connexion à la base de TEST : jamais celle de développement ni de production.
// Même serveur Postgres que le développement (docker compose, port 5433), mais une base distincte.

const DEFAULT_URL = "postgresql://amour2poils:amour2poils@localhost:5433/amour2poils_test?schema=public";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? DEFAULT_URL;

/** Garde-fou : les tests d'intégration vident les tables (TRUNCATE). On refuse toute base dont le nom ne finit pas par `_test`. */
export function assertTestDatabase(url: string) {
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
  if (!/_test$/.test(name)) {
    throw new Error(`Refus : la base « ${name} » n'est pas une base de test (son nom doit finir par _test). Les tests vident les tables.`);
  }
  return name;
}
