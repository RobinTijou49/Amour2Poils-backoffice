"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { BookingStatus } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { bookingInput, createBookingRecord, kennelHasRoom } from "@/lib/booking-service";
import { canTransition } from "@/lib/bookings";
import { de } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Actions d'écriture des réservations. Chacune : session → validation Zod → règle métier → écriture.

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> };

export async function createBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  // Valeurs renvoyées en cas d'erreur : React vide le formulaire après l'envoi.
  const values = Object.fromEntries([...formData].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const parsed = bookingInput.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Corrigez les champs signalés.", fieldErrors, values };
  }
  const d = parsed.data;
  if (d.kennelId && !(await kennelHasRoom(d.kennelId, d.startDate, d.endDate))) {
    return { error: "Cette box est complète sur ces dates.", fieldErrors: { kennelId: "Box complète sur ces dates : choisissez-en une autre ou laissez « à attribuer »." }, values };
  }
  const booking = await createBookingRecord(d);
  redirect(`/reservations/${booking.id}`);
}

const idSchema = z.string().min(1);

/** Charge la réservation et vérifie que la transition est permise. */
async function loadFor(id: unknown, to: BookingStatus) {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { error: "Réservation introuvable." } as const;
  const booking = await prisma.booking.findUnique({ where: { id: parsed.data }, include: { dog: true } });
  if (!booking) return { error: "Réservation introuvable." } as const;
  if (!canTransition(booking.status, to)) return { error: "Cette action n'est plus possible pour cette réservation." } as const;
  return { booking } as const;
}

export async function confirmBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const r = await loadFor(formData.get("id"), "CONFIRMED");
  if ("error" in r) return { error: r.error };
  const kennelId = String(formData.get("kennelId") ?? "");
  if (!kennelId) return { error: "Choisissez une box.", fieldErrors: { kennelId: "Choisissez une box." } };
  if (!(await kennelHasRoom(kennelId, r.booking.startDate, r.booking.endDate, r.booking.id))) {
    return { error: "Cette box est complète sur ces dates.", fieldErrors: { kennelId: "Box complète sur ces dates." } };
  }
  await prisma.booking.update({ where: { id: r.booking.id }, data: { status: "CONFIRMED", kennelId } });
  refresh();
  return { success: `Réservation ${de(r.booking.dog.name)} confirmée.` };
}

export async function checkIn(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const r = await loadFor(formData.get("id"), "CHECKED_IN");
  if ("error" in r) return { error: r.error };
  await prisma.booking.update({ where: { id: r.booking.id }, data: { status: "CHECKED_IN", checkedInAt: new Date() } });
  refresh();
  return { success: `Arrivée ${de(r.booking.dog.name)} enregistrée.` };
}

export async function checkOut(_prev: FormState, formData: FormData): Promise<FormState> {
  await getCurrentUser();
  const r = await loadFor(formData.get("id"), "COMPLETED");
  if ("error" in r) return { error: r.error };
  await prisma.booking.update({ where: { id: r.booking.id }, data: { status: "COMPLETED", checkedOutAt: new Date() } });
  refresh();
  return { success: `Départ ${de(r.booking.dog.name)} enregistré.` };
}

export async function cancelBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  // Vérification du rôle côté serveur : masquer le bouton ne suffit pas.
  const user = await getCurrentUser();
  if (user.role !== "ADMIN") return { error: "Seule la gérance peut annuler une réservation." };
  const r = await loadFor(formData.get("id"), "CANCELLED");
  if ("error" in r) return { error: r.error };
  await prisma.booking.update({ where: { id: r.booking.id }, data: { status: "CANCELLED" } });
  refresh();
  return { success: `Réservation ${de(r.booking.dog.name)} annulée.` };
}
