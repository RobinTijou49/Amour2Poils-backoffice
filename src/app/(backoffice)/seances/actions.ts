"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { de, eurosToCents, parisToUtc } from "@/lib/format";
import { fieldErrors, formValues, isRealDay, isUniqueViolation, optional, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

// Actions des séances d'éducation et de petsitting.

const sessionInput = z.object({
  type: z.enum(["PRIVATE", "GROUP", "PUPPY_CLASS", "PETSITTING"], { message: "Choisissez le type de séance." }),
  title: z.string().trim().min(1, "Saisissez un titre.").max(100),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").refine(isRealDay, "Date invalide."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide."),
  durationMin: z.coerce.number({ message: "Saisissez une durée." }).int().min(15, "Au moins 15 minutes.").max(480, "8 heures maximum."),
  capacity: z.coerce.number({ message: "Saisissez le nombre de places." }).int().min(1, "Au moins 1 place.").max(30),
  price: z.coerce.number({ message: "Saisissez un tarif." }).min(0).max(1000),
  location: z.string().max(120).optional(),
});

export async function createSession(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const values = formValues(formData);
  const parsed = sessionInput.safeParse(values);
  if (!parsed.success) return { error: "Corrigez les champs signalés.", fieldErrors: fieldErrors(parsed.error), values };
  const s = parsed.data;
  const startsAt = parisToUtc(s.day, s.time);
  if (startsAt < new Date()) return { error: "Corrigez les champs signalés.", fieldErrors: { day: "La séance ne peut pas être dans le passé." }, values };
  const created = await prisma.trainingSession.create({
    data: {
      type: s.type,
      title: s.title,
      startsAt,
      durationMin: s.durationMin,
      capacity: s.type === "PETSITTING" ? 1 : s.capacity,
      priceCents: eurosToCents(s.price),
      location: optional(s.location),
    },
  });
  redirect(`/seances/${created.id}`);
}

/** Inscription d'un chien : refusée si la séance est complète ou si le chien est déjà inscrit. */
export async function enrollDog(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const sessionId = String(formData.get("sessionId") ?? "");
  const dogId = String(formData.get("dogId") ?? "");
  if (!dogId) return { error: "Choisissez un chien.", fieldErrors: { dogId: "Choisissez un chien." } };
  try {
    // Transaction : compter les places et inscrire sans qu'une autre inscription passe entre les deux.
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.trainingSession.findUnique({ where: { id: sessionId }, include: { _count: { select: { enrollments: true } } } });
      if (!session) return { error: "Séance introuvable." } satisfies FormState;
      if (session._count.enrollments >= session.capacity) return { error: `Séance complète (${session.capacity} place${session.capacity > 1 ? "s" : ""}).` } satisfies FormState;
      const e = await tx.enrollment.create({ data: { sessionId, dogId }, include: { dog: true } });
      return { success: `${e.dog.name} est inscrit.` } satisfies FormState;
    });
    if ("success" in result) refresh();
    return result;
  } catch (e) {
    // Contrainte @@unique([sessionId, dogId]) : le chien est déjà inscrit.
    if (isUniqueViolation(e)) return { error: "Ce chien est déjà inscrit à cette séance.", fieldErrors: { dogId: "Déjà inscrit." } };
    throw e;
  }
}

export async function unenroll(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const enrollment = await prisma.enrollment.findUnique({ where: { id: String(formData.get("id") ?? "") }, include: { dog: true, _count: { select: { invoiceLines: true } } } });
  if (!enrollment) return { error: "Inscription introuvable." };
  if (enrollment._count.invoiceLines > 0) return { error: `L'inscription ${de(enrollment.dog.name)} est facturée : elle ne peut plus être retirée.` };
  await prisma.enrollment.delete({ where: { id: enrollment.id } });
  refresh();
  return { success: `${enrollment.dog.name} est désinscrit.` };
}

/** Présence notée après la séance : un absent n'est pas facturé. */
export async function setAttendance(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const attended = formData.get("attended") === "yes";
  // Un identifiant inconnu (formulaire modifié à la main) donne une erreur claire plutôt qu'un plantage.
  const found = await prisma.enrollment.findUnique({ where: { id }, include: { dog: true } });
  if (!found) return { error: "Inscription introuvable." };
  const enrollment = await prisma.enrollment.update({ where: { id }, data: { attended }, include: { dog: true } });
  refresh();
  return { success: `${enrollment.dog.name} noté ${attended ? "présent" : "absent"}.` };
}
