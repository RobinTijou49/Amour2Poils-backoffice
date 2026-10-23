import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// Sessions stockées en base. Le navigateur garde un jeton aléatoire dans un cookie HttpOnly ;
// la base ne garde que son empreinte SHA-256.
export const SESSION_COOKIE = "a2p_session";
const DURATION_MS = 7 * 24 * 60 * 60 * 1000;

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Buffer.from(digest).toString("hex");
}

/** À appeler depuis une Server Action : on ne peut pas écrire de cookie pendant le rendu. */
export async function createSession(userId: string) {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  const expiresAt = new Date(Date.now() + DURATION_MS);
  await prisma.session.create({ data: { id: await hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // inaccessible au JavaScript de la page (limite l'impact d'une faille XSS)
    secure: process.env.NODE_ENV === "production", // HTTPS uniquement en production
    sameSite: "lax", // non envoyé par les formulaires POST d'un autre site (CSRF)
    path: "/",
    expires: expiresAt,
  });
}

/** Lit la session courante, ou `null` si absente ou expirée. */
export async function getSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: await hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: await hashToken(token) } });
  store.delete(SESSION_COOKIE);
}
