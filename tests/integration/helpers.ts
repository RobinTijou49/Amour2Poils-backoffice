import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import type { Prisma, Role } from "@/generated/prisma/client";
import { cookieJar, pushCalls } from "./fakes";

export { prisma, pushCalls };

const day = (offset = 0) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
};
export { day };
export const isoDay = (offset = 0) => day(offset).toISOString().slice(0, 10);

/** Vide toutes les tables (sauf l'historique des migrations) et remet à zéro cookies et notifications. */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  cookieJar.clear();
  pushCalls.length = 0;
}

// Hash argon2 volontairement peu coûteux : ces comptes ne servent pas à tester la connexion, et le coût par défaut
// (~100 ms) multiplié par chaque test ralentirait la suite pour rien.
const cheapHash = Bun.password.hash("mot-de-passe-test-12", { algorithm: "argon2id", memoryCost: 8, timeCost: 1 });

let counter = 0;
const uid = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Crée un utilisateur et ouvre une VRAIE session (ligne en base + cookie), comme le fait la connexion. */
export async function signIn(role: Role = "EMPLOYEE") {
  const user = await prisma.user.create({
    data: { email: `${role.toLowerCase()}-${uid()}@test.local`, name: role === "ADMIN" ? "Gérant Test" : "Employé Test", role, passwordHash: await cheapHash },
  });
  cookieJar.clear();
  await createSession(user.id);
  return user;
}

export const signOut = () => cookieJar.clear();

// ---- Fabriques de données ---------------------------------------------------------------------------------------

export const makeOwner = (data: Partial<Prisma.OwnerUncheckedCreateInput> = {}) =>
  prisma.owner.create({ data: { firstName: "Camille", lastName: `Durand-${uid()}`, phone: "06 12 34 56 78", ...data } });

export async function makeDog(data: Partial<Prisma.DogUncheckedCreateInput> = {}) {
  const ownerId = data.ownerId ?? (await makeOwner()).id;
  return prisma.dog.create({ data: { name: `Rex-${uid()}`, sex: "MALE", ...data, ownerId } });
}

export const makeKennel = (data: Partial<Prisma.KennelCreateInput> = {}) =>
  prisma.kennel.create({ data: { name: `Box ${uid()}`, size: "MEDIUM", capacity: 1, ...data } });

export async function makeBooking(data: Partial<Prisma.BookingUncheckedCreateInput> = {}) {
  const dogId = data.dogId ?? (await makeDog()).id;
  return prisma.booking.create({ data: { startDate: day(1), endDate: day(4), nightlyRateCents: 2200, status: "CONFIRMED", ...data, dogId } });
}

export const makeProduct = (data: Partial<Prisma.ProductCreateInput> = {}) =>
  prisma.product.create({ data: { name: `Croquettes ${uid()}`, category: "FOOD", unit: "sac 15 kg", quantity: 10, alertThreshold: 3, ...data } });

export const makeTrainingSession = (data: Partial<Prisma.TrainingSessionCreateInput> = {}) =>
  prisma.trainingSession.create({
    data: { type: "GROUP", title: "Cours collectif", startsAt: new Date(Date.now() + 3 * 86_400_000), durationMin: 60, capacity: 3, priceCents: 3000, ...data },
  });

// ---- Appels ------------------------------------------------------------------------------------------------------

/** Requête vers un Route Handler, avec JSON par défaut (ce que la garde de l'API exige pour une écriture). */
export function apiRequest(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const withId = (id: string) => ({ params: Promise.resolve({ id }) });

/** FormData d'un formulaire (les Server Actions reçoivent ça). */
export function formData(fields: Record<string, string | undefined>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) fd.set(k, v);
  return fd;
}

/** Une Server Action qui se termine par `redirect()` lève une erreur spéciale : on en extrait l'adresse. */
export async function redirectedTo(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (e) {
    const digest = (e as { digest?: string }).digest;
    if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    throw e;
  }
  return null;
}
