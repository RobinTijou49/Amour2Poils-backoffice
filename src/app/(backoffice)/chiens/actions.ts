"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrors, formValues, isUniqueViolation, optional, type FormState } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

// Actions d'écriture des fiches clients et chiens. Même patron que les réservations :
// session → validation Zod → règles (unicité…) → écriture → redirection ou rafraîchissement.

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
  .transform((s) => new Date(`${s}T00:00:00Z`));
const optionalDay = z.union([z.literal(""), isoDay]).optional().transform((v) => (v instanceof Date ? v : null));

const ownerInput = z.object({
  ownerFirstName: z.string().trim().min(1, "Saisissez le prénom.").max(80),
  ownerLastName: z.string().trim().min(1, "Saisissez le nom.").max(80),
  ownerPhone: z.string().trim().regex(/^[0-9+ .()-]{6,20}$/, "Numéro de téléphone invalide."),
  ownerEmail: z.union([z.literal(""), z.email("Adresse e-mail invalide.")]).optional(),
  ownerAddress: z.string().max(200).optional(),
});

const dogInput = z.object({
  name: z.string().trim().min(1, "Saisissez le nom du chien.").max(60),
  breed: z.string().max(80).optional(),
  sex: z.enum(["MALE", "FEMALE"], { message: "Choisissez le sexe." }),
  birthDate: optionalDay.refine((d) => !d || d <= new Date(), "La date de naissance est dans le futur."),
  weightKg: z
    .union([z.literal(""), z.coerce.number().positive("Le poids doit être positif.").max(120, "Poids trop élevé.")])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  sterilized: z.literal("on").optional(),
  chipNumber: z.string().max(30).optional(),
  allergies: z.string().max(300).optional(),
  diet: z.string().max(300).optional(),
  behaviorNotes: z.string().max(1000).optional(),
  vetName: z.string().max(120).optional(),
  vetPhone: z.string().max(30).optional(),
  ownerId: z.string().optional(),
});

/** Création ou modification d'un chien (et de son propriétaire si « nouveau propriétaire »). */
export async function saveDog(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const values = formValues(formData);
  const dogId = values.id || null;
  const dog = dogInput.safeParse(values);
  const newOwner = values.ownerId === "__new__";
  const owner = newOwner ? ownerInput.safeParse(values) : null;

  const errors = { ...(dog.success ? {} : fieldErrors(dog.error)), ...(owner && !owner.success ? fieldErrors(owner.error) : {}) };
  if (!newOwner && !values.ownerId) errors.ownerId = "Choisissez un propriétaire.";
  if (!dog.success || (owner && !owner.success) || Object.keys(errors).length) {
    return { error: "Corrigez les champs signalés.", fieldErrors: errors, values };
  }
  const d = dog.data;
  const chip = optional(d.chipNumber);

  // Unicité vérifiée avant l'écriture pour afficher l'erreur sur le bon champ.
  if (chip && (await prisma.dog.findFirst({ where: { chipNumber: chip, id: dogId ? { not: dogId } : undefined } }))) {
    return { error: "Corrigez les champs signalés.", fieldErrors: { chipNumber: "Ce numéro de puce est déjà enregistré." }, values };
  }
  const ownerEmail = owner?.success ? optional(owner.data.ownerEmail)?.toLowerCase() ?? null : null;
  if (ownerEmail && (await prisma.owner.findUnique({ where: { email: ownerEmail } }))) {
    return { error: "Corrigez les champs signalés.", fieldErrors: { ownerEmail: "Un client utilise déjà cette adresse e-mail." }, values };
  }

  const data = {
    name: d.name,
    breed: optional(d.breed),
    sex: d.sex,
    birthDate: d.birthDate,
    weightKg: d.weightKg,
    sterilized: d.sterilized === "on",
    chipNumber: chip,
    allergies: optional(d.allergies),
    diet: optional(d.diet),
    behaviorNotes: optional(d.behaviorNotes),
    vetName: optional(d.vetName),
    vetPhone: optional(d.vetPhone),
  };

  let savedId: string;
  try {
    // Transaction : le propriétaire et le chien sont créés ensemble, ou pas du tout.
    savedId = await prisma.$transaction(async (tx) => {
      let ownerId = values.ownerId;
      if (owner?.success) {
        const o = owner.data;
        const created = await tx.owner.create({
          data: { firstName: o.ownerFirstName, lastName: o.ownerLastName, phone: o.ownerPhone, email: ownerEmail, address: optional(o.ownerAddress) },
        });
        ownerId = created.id;
      }
      const saved = dogId
        ? await tx.dog.update({ where: { id: dogId }, data: { ...data, ownerId } })
        : await tx.dog.create({ data: { ...data, ownerId } });
      return saved.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Ces informations sont déjà utilisées par une autre fiche.", values };
    throw e;
  }
  redirect(`/chiens/${savedId}`);
}

const vaccineInput = z
  .object({ dogId: z.string().min(1), vaccineName: z.string().trim().min(1, "Saisissez le nom du vaccin.").max(60), administeredAt: isoDay, expiresAt: isoDay })
  .refine((v) => v.expiresAt > v.administeredAt, { path: ["expiresAt"], message: "L'expiration doit être après l'injection." });

export async function addVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const values = formValues(formData);
  const parsed = vaccineInput.safeParse(values);
  if (!parsed.success) return { error: "Corrigez les champs signalés.", fieldErrors: fieldErrors(parsed.error), values };
  const v = parsed.data;
  await prisma.vaccination.create({ data: { dogId: v.dogId, name: v.vaccineName, administeredAt: v.administeredAt, expiresAt: v.expiresAt } });
  refresh();
  return { success: `Vaccin « ${v.vaccineName} » ajouté.` };
}

export async function deleteVaccination(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  await prisma.vaccination.deleteMany({ where: { id } });
  refresh();
  return { success: "Vaccin supprimé." };
}

/** Suppression d'un chien : gérance uniquement, et seulement sans historique (séjours, séances). */
export async function deleteDog(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") return { error: "Seule la gérance peut supprimer une fiche." };
  const id = String(formData.get("id") ?? "");
  const dog = await prisma.dog.findUnique({ where: { id }, include: { _count: { select: { bookings: true, enrollments: true } } } });
  if (!dog) return { error: "Chien introuvable." };
  if (dog._count.bookings + dog._count.enrollments > 0) {
    return { error: `${dog.name} a un historique de séjours ou de séances : la fiche est conservée pour la facturation.` };
  }
  await prisma.$transaction([prisma.vaccination.deleteMany({ where: { dogId: id } }), prisma.dog.delete({ where: { id } })]);
  redirect("/chiens");
}
