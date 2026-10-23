// Comptes et base des tests de bout en bout. Valeurs jetables : elles n'existent que dans la base `amour2poils_e2e_test`,
// recréée à chaque lancement, et ne donnent accès à rien d'autre (ni développement ni production).

export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgresql://amour2poils:amour2poils@localhost:5433/amour2poils_e2e_test?schema=public";

export type Account = { email: string; password: string; name: string };

/** Gérance : accès complet (le seed la nomme « Claire Morel »). */
export const ADMIN: Account = { email: "gerant@e2e.test", password: "e2e-gerant-mot-de-passe-12", name: "Claire Morel" };
/** Employé : planning, arrivées, stock ; ni facturation ni annulation (le seed le nomme « Hugo Lefèvre »). */
export const EMPLOYEE: Account = { email: "employe@e2e.test", password: "e2e-employe-mot-de-passe-12", name: "Hugo Lefèvre" };

/** Port du serveur de test (différent de 3000, utilisé par `bun run dev`, et de 3100, utilisé à la main). */
export const E2E_PORT = 3300;
