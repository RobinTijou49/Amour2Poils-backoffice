"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession, deleteSession } from "@/lib/session";

export type LoginState = { error?: string; email?: string };

const credentials = z.object({
  email: z.email("Saisissez une adresse e-mail valide.").max(254),
  password: z.string().min(1, "Saisissez votre mot de passe.").max(200),
});

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
// Empreinte argon2 factice : on vérifie quand même un mot de passe quand le compte n'existe pas,
// pour que le temps de réponse ne révèle pas si l'e-mail est connu.
const dummyHash = Bun.password.hash("mot-de-passe-factice");

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // Nettoyage AVANT validation : un clavier de téléphone ajoute souvent une espace après l'adresse, que Zod refuserait.
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parsed = credentials.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const since = new Date(Date.now() - WINDOW_MS);
  const failures = await prisma.loginAttempt.count({ where: { email, createdAt: { gte: since } } });
  if (failures >= MAX_FAILURES) {
    return { error: "Trop de tentatives. Réessayez dans 15 minutes.", email };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await Bun.password.verify(parsed.data.password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) {
    await prisma.loginAttempt.create({ data: { email } });
    // Message identique dans les deux cas : on ne révèle pas si le compte existe.
    return { error: "Adresse e-mail ou mot de passe incorrect.", email };
  }

  await prisma.loginAttempt.deleteMany({ where: { email } });
  // Ménage à chaque connexion réussie : sessions expirées et anciennes tentatives de tous les comptes
  // (sinon ces tables grossissent sans fin et gardent des adresses e-mail saisies par des inconnus).
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: since } } }),
  ]);
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/connexion");
}
