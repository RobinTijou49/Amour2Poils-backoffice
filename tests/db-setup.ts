// Prépare la base de test : la crée si elle n'existe pas, puis applique les migrations Prisma.
//   bun run test:db
// En CI le service Postgres crée déjà la base ; seule la migration s'exécute alors.
import { SQL } from "bun";
import { assertTestDatabase, TEST_DATABASE_URL } from "./test-db";

const name = assertTestDatabase(TEST_DATABASE_URL);

// On se connecte à la base d'administration « postgres » du même serveur pour pouvoir créer la nôtre.
const admin = new URL(TEST_DATABASE_URL);
admin.pathname = "/postgres";
admin.search = "";
const sql = new SQL(admin.toString());
try {
  const exists = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (exists.length === 0) {
    // Le nom a été validé par assertTestDatabase (lettres, chiffres, _ attendus) : on le contrôle encore avant de l'inclure.
    if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Nom de base inattendu : ${name}`);
    await sql.unsafe(`CREATE DATABASE "${name}"`);
    console.log(`Base « ${name} » créée.`);
  }
} finally {
  await sql.close();
}

const migrate = Bun.spawn(["bun", "--bun", "prisma", "migrate", "deploy"], {
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  stdout: "inherit",
  stderr: "inherit",
});
process.exit(await migrate.exited);
