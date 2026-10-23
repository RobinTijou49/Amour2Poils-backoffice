import "server-only";
import { z } from "zod";
import { hasRoom } from "@/lib/bookings";
import { eurosToCents, utcDay } from "@/lib/format";
import { isoDay } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/push";

// Règles d'écriture des réservations partagées par les Server Actions (formulaires) et les Route Handlers (API).


export const bookingInput = z
  .object({
    dogId: z.string().min(1, "Choisissez un chien."),
    kennelId: z.string().optional().transform((v) => v || null),
    startDate: isoDay,
    endDate: isoDay,
    nightlyRate: z.coerce
      .number({ message: "Saisissez un tarif." })
      .positive("Le tarif doit être positif.")
      .max(500, "Le tarif semble trop élevé."),
    notes: z.string().max(500).optional(),
  })
  .refine((d) => d.endDate > d.startDate, { path: ["endDate"], message: "Le départ doit être après l'arrivée." })
  .refine((d) => d.startDate >= utcDay(new Date()), { path: ["startDate"], message: "L'arrivée ne peut pas être dans le passé." });

/** Vérifie la capacité d'une box sur toutes les nuits demandées. */
export async function kennelHasRoom(kennelId: string, start: Date, end: Date, excludeId?: string) {
  const kennel = await prisma.kennel.findUnique({ where: { id: kennelId } });
  if (!kennel || !kennel.active) return false;
  const others = await prisma.booking.findMany({
    where: { kennelId, id: excludeId ? { not: excludeId } : undefined, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startDate: { lt: end }, endDate: { gt: start } },
    select: { startDate: true, endDate: true },
  });
  return hasRoom(kennel.capacity, others.map((b) => ({ start: b.startDate, end: b.endDate })), { start, end });
}

const shortDay = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Crée la réservation : confirmée si une box est choisie, sinon en attente. Prévient l'équipe par notification. */
export async function createBookingRecord(d: z.output<typeof bookingInput>) {
  const booking = await prisma.booking.create({
    data: {
      dogId: d.dogId,
      kennelId: d.kennelId,
      startDate: d.startDate,
      endDate: d.endDate,
      nightlyRateCents: eurosToCents(d.nightlyRate),
      notes: d.notes || null,
      status: d.kennelId ? "CONFIRMED" : "PENDING",
    },
    include: { dog: { select: { name: true } } },
  });
  notify({
    title: "Nouvelle réservation",
    body: `${booking.dog.name} · du ${shortDay(d.startDate)} au ${shortDay(d.endDate)}${booking.status === "PENDING" ? " (box à attribuer)" : ""}.`,
    url: `/reservations/${booking.id}`,
    tag: `resa-${booking.id}`,
  });
  return booking;
}
