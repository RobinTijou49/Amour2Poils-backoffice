import { beforeEach, describe, expect, test } from "bun:test";
import { login, logout } from "@/app/connexion/actions";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { cookieJar } from "./fakes";
import { formData, prisma, redirectedTo, resetDb, signIn } from "./helpers";

beforeEach(resetDb);

const PASSWORD = "un-vrai-mot-de-passe-12";
const GENERIC = "Adresse e-mail ou mot de passe incorrect.";

async function makeUser(email = "gerant@test.local", role: "ADMIN" | "EMPLOYEE" = "ADMIN") {
  return prisma.user.create({ data: { email, name: "Gérant", role, passwordHash: await Bun.password.hash(PASSWORD) } });
}
const attempt = (email: string, password = PASSWORD) => login({}, formData({ email, password }));
const failures = (email: string) => prisma.loginAttempt.count({ where: { email } });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);

describe("connexion", () => {
  test("bon mot de passe : session créée, cookie posé, redirection vers l'accueil", async () => {
    const user = await makeUser();
    expect(await redirectedTo(() => attempt("gerant@test.local"))).toBe("/");
    const token = cookieJar.get("a2p_session");
    expect(token).toBeDefined();
    const session = await prisma.session.findFirstOrThrow();
    expect(session.userId).toBe(user.id);
    // La base ne garde que l'empreinte SHA-256 du jeton : une fuite de la base ne donne pas de cookie utilisable.
    expect(session.id).not.toBe(token);
    expect(session.id).toMatch(/^[0-9a-f]{64}$/);
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  test("le mot de passe n'est jamais stocké en clair (argon2id)", async () => {
    const user = await makeUser();
    expect(user.passwordHash).toStartWith("$argon2id$");
    expect(user.passwordHash).not.toContain(PASSWORD);
  });

  test("mauvais mot de passe et compte inconnu : exactement le même message, et une tentative enregistrée chaque fois", async () => {
    await makeUser();
    const wrong = await attempt("gerant@test.local", "mauvais");
    const unknown = await attempt("inconnu@test.local");
    expect(wrong.error).toBe(GENERIC);
    expect(unknown.error).toBe(GENERIC);
    expect(await failures("gerant@test.local")).toBe(1);
    expect(await failures("inconnu@test.local")).toBe(1);
    expect(cookieJar.size).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  test("l'adresse est comparée sans tenir compte de la casse ni des espaces", async () => {
    await makeUser("gerant@test.local");
    expect(await redirectedTo(() => attempt("  GERANT@Test.Local  "))).toBe("/");
  });

  test("l'adresse saisie est renvoyée pour re-remplir le formulaire", async () => {
    const state = await attempt("Quelqu'un@Test.Local", "x");
    expect(state.email).toBe("quelqu'un@test.local");
  });

  test("adresse mal formée ou champs vides : erreur de saisie, sans compter comme un échec de connexion", async () => {
    expect((await attempt("pas-un-email")).error).toContain("adresse e-mail valide");
    expect((await attempt("a@b.fr", "")).error).toContain("mot de passe");
    expect(await prisma.loginAttempt.count()).toBe(0);
  });

  test("un mot de passe démesuré est refusé avant tout calcul de hash", async () => {
    expect((await attempt("a@b.fr", "x".repeat(201))).error).toBeDefined();
    expect(await prisma.loginAttempt.count()).toBe(0);
  });
});

describe("verrouillage après des échecs répétés", () => {
  test("après 5 échecs, même le BON mot de passe est refusé", async () => {
    await makeUser();
    for (let i = 0; i < 5; i++) expect((await attempt("gerant@test.local", "mauvais")).error).toBe(GENERIC);
    const locked = await attempt("gerant@test.local");
    expect(locked.error).toBe("Trop de tentatives. Réessayez dans 15 minutes.");
    expect(cookieJar.size).toBe(0);
  });

  test("4 échecs ne verrouillent pas encore", async () => {
    await makeUser();
    for (let i = 0; i < 4; i++) await attempt("gerant@test.local", "mauvais");
    expect(await redirectedTo(() => attempt("gerant@test.local"))).toBe("/");
  });

  test("le verrouillage se lève après 15 minutes", async () => {
    await makeUser();
    for (let i = 0; i < 5; i++) await attempt("gerant@test.local", "mauvais");
    await prisma.loginAttempt.updateMany({ data: { createdAt: minutesAgo(16) } });
    expect(await redirectedTo(() => attempt("gerant@test.local"))).toBe("/");
  });

  test("il est propre à chaque adresse : un compte verrouillé ne bloque pas les autres", async () => {
    await makeUser("a@test.local");
    await makeUser("b@test.local");
    for (let i = 0; i < 5; i++) await attempt("a@test.local", "mauvais");
    expect((await attempt("a@test.local")).error).toContain("Trop de tentatives");
    expect(await redirectedTo(() => attempt("b@test.local"))).toBe("/");
  });

  test("une connexion réussie remet le compteur de cet utilisateur à zéro", async () => {
    await makeUser();
    for (let i = 0; i < 4; i++) await attempt("gerant@test.local", "mauvais");
    await redirectedTo(() => attempt("gerant@test.local"));
    expect(await failures("gerant@test.local")).toBe(0);
  });

  test("un inconnu qui martèle une adresse inexistante est lui aussi freiné", async () => {
    for (let i = 0; i < 5; i++) await attempt("fantome@test.local", "x");
    expect((await attempt("fantome@test.local", "x")).error).toContain("Trop de tentatives");
  });
});

describe("ménage à la connexion", () => {
  test("supprime les sessions expirées et les vieilles tentatives de tous les comptes, garde le reste", async () => {
    const user = await makeUser();
    const other = await makeUser("autre@test.local", "EMPLOYEE");
    await prisma.session.create({ data: { id: "expiree", userId: other.id, expiresAt: minutesAgo(5) } });
    await prisma.session.create({ data: { id: "valide", userId: other.id, expiresAt: new Date(Date.now() + 3_600_000) } });
    await prisma.loginAttempt.create({ data: { email: "ancien@test.local", createdAt: minutesAgo(60) } });
    await prisma.loginAttempt.create({ data: { email: "recent@test.local", createdAt: minutesAgo(2) } });
    await redirectedTo(() => attempt(user.email));
    expect(await prisma.session.findUnique({ where: { id: "expiree" } })).toBeNull();
    expect(await prisma.session.findUnique({ where: { id: "valide" } })).not.toBeNull();
    expect(await prisma.loginAttempt.count({ where: { email: "ancien@test.local" } })).toBe(0);
    expect(await prisma.loginAttempt.count({ where: { email: "recent@test.local" } })).toBe(1);
  });
});

describe("déconnexion", () => {
  test("supprime la session en base, efface le cookie et renvoie vers /connexion", async () => {
    await signIn();
    expect(await prisma.session.count()).toBe(1);
    expect(await redirectedTo(() => logout())).toBe("/connexion");
    expect(await prisma.session.count()).toBe(0);
    expect(cookieJar.has("a2p_session")).toBe(false);
  });

  test("le jeton volé avant la déconnexion ne sert plus à rien", async () => {
    const user = await signIn();
    const stolen = cookieJar.get("a2p_session")!;
    await redirectedTo(() => logout());
    cookieJar.set("a2p_session", stolen);
    expect(await redirectedTo(() => getCurrentUser())).toBe("/connexion");
    expect(user.id).toBeDefined();
  });
});

describe("getCurrentUser / requireRole", () => {
  test("session valide : renvoie l'utilisateur, SANS son hash de mot de passe", async () => {
    const user = await signIn("ADMIN");
    const current = await getCurrentUser();
    expect(current.id).toBe(user.id);
    expect(Object.keys(current).sort()).toEqual(["email", "id", "name", "role"]);
  });

  test("sans cookie, avec un jeton inventé, ou une session expirée : renvoi vers /connexion", async () => {
    expect(await redirectedTo(() => getCurrentUser())).toBe("/connexion");
    cookieJar.set("a2p_session", "jeton-invente");
    expect(await redirectedTo(() => getCurrentUser())).toBe("/connexion");
    await signIn();
    await prisma.session.updateMany({ data: { expiresAt: minutesAgo(1) } });
    expect(await redirectedTo(() => getCurrentUser())).toBe("/connexion");
  });

  test("requireRole : la gérance passe, un employé est refusé", async () => {
    await signIn("ADMIN");
    expect((await requireRole("ADMIN")).role).toBe("ADMIN");
    await signIn("EMPLOYEE");
    await expect(requireRole("ADMIN")).rejects.toThrow();
  });
});
