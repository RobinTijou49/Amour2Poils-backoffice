import "server-only";
import { z } from "zod";
import { hasRoom } from "@/lib/bookings";
import { utcDay } from "@/lib/format";
import { prisma } from "@/lib/prisma";

// Règles d'écriture des réservations partagées par les Server Actions (formulaires) et les Route Handlers (API).

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.").transform((s) => new Date(`${s}T00:00:00Z`));

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

/** Crée la réservation : confirmée si une box est choisie, sinon en attente. */
export function createBookingRecord(d: z.output<typeof bookingInput>) {
  return prisma.booking.create({
    data: {
      dogId: d.dogId,
      kennelId: d.kennelId,
      startDate: d.startDate,
      endDate: d.endDate,
      nightlyRateCents: Math.round(d.nightlyRate * 100),
      notes: d.notes || null,
      status: d.kennelId ? "CONFIRMED" : "PENDING",
    },
  });
}
