import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
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

type Db = Pick<typeof prisma, "kennel" | "booking">;

/** Vérifie la capacité d'une box sur toutes les nuits demandées. `db` : la transaction en cours (voir lockKennel). */
export async function kennelHasRoom(kennelId: string, start: Date, end: Date, excludeId?: string, db: Db = prisma) {
  const kennel = await db.kennel.findUnique({ where: { id: kennelId } });
  if (!kennel || !kennel.active) return false;
  const others = await db.booking.findMany({
    where: { kennelId, id: excludeId ? { not: excludeId } : undefined, status: { in: ["CONFIRMED", "CHECKED_IN"] }, startDate: { lt: end }, endDate: { gt: start } },
    select: { startDate: true, endDate: true },
  });
  return hasRoom(kennel.capacity, others.map((b) => ({ start: b.startDate, end: b.endDate })), { start, end });
}

/**
 * Verrouille la ligne de la box jusqu'à la fin de la transaction. Sans cela, « vérifier la place puis réserver » est une
 * course : deux requêtes simultanées voient toutes deux la box libre et la remplissent (révélé par le test de concurrence :
 * 5 réservations simultanées d'une box d'un seul chien passaient toutes). Avec le verrou, elles passent l'une après l'autre.
 */
async function lockKennel(tx: Prisma.TransactionClient, kennelId: string) {
  await tx.$queryRaw`SELECT id FROM "Kennel" WHERE id = ${kennelId} FOR UPDATE`;
}

/** Affecte une box à une réservation en attente et la confirme, sans qu'une requête simultanée ne prenne la dernière place. */
export async function confirmInKennel(booking: { id: string; startDate: Date; endDate: Date }, kennelId: string) {
  return prisma.$transaction(async (tx) => {
    await lockKennel(tx, kennelId);
    if (!(await kennelHasRoom(kennelId, booking.startDate, booking.endDate, booking.id, tx))) return false;
    await tx.booking.update({ where: { id: booking.id }, data: { status: "CONFIRMED", kennelId } });
    return true;
  });
}

const shortDay = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Crée la réservation : confirmée si une box est choisie, sinon en attente. Prévient l'équipe par notification.
 * Renvoie `null` si la box choisie est complète sur ces dates (vérifié et écrit dans la même transaction, box verrouillée).
 */
export async function createBookingRecord(d: z.output<typeof bookingInput>) {
  const booking = await prisma.$transaction(async (tx) => {
    if (d.kennelId) {
      await lockKennel(tx, d.kennelId);
      if (!(await kennelHasRoom(d.kennelId, d.startDate, d.endDate, undefined, tx))) return null;
    }
    return tx.booking.create({
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
  });
  if (!booking) return null;
  notify({
    title: "Nouvelle réservation",
    body: `${booking.dog.name} · du ${shortDay(d.startDate)} au ${shortDay(d.endDate)}${booking.status === "PENDING" ? " (box à attribuer)" : ""}.`,
    url: `/reservations/${booking.id}`,
    tag: `resa-${booking.id}`,
  });
  return booking;
}
