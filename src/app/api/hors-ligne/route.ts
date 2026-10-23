import { guard } from "@/lib/api";
import { utcDay } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { OfflineSnapshot } from "@/lib/offline/types";

/**
 * GET /api/hors-ligne : instantané de la journée pour le mode hors connexion.
 * Volontairement limité au strict nécessaire sur le terrain : séjours en cours ou qui arrivent / partent
 * aujourd'hui et fiches des chiens concernés (pas d'historique, pas de facturation, pas d'adresse ni d'e-mail).
 */
export async function GET(request: Request) {
  const g = await guard(request);
  if ("response" in g) return g.response;
  const today = utcDay(new Date());
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "CHECKED_IN"] }, startDate: { lte: utcDay(today, 1) }, endDate: { gte: today } },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    take: 200,
    include: { kennel: { select: { name: true } }, dog: { include: { owner: true, vaccinations: { orderBy: { expiresAt: "asc" } } } } },
  });
  const snapshot: OfflineSnapshot = {
    generatedAt: new Date().toISOString(),
    today: today.toISOString().slice(0, 10),
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status === "CHECKED_IN" ? "CHECKED_IN" : "CONFIRMED",
      startDate: b.startDate.toISOString().slice(0, 10),
      endDate: b.endDate.toISOString().slice(0, 10),
      kennel: b.kennel?.name ?? null,
      dog: {
        id: b.dog.id,
        name: b.dog.name,
        breed: b.dog.breed,
        allergies: b.dog.allergies,
        diet: b.dog.diet,
        behaviorNotes: b.dog.behaviorNotes,
        vetName: b.dog.vetName,
        vetPhone: b.dog.vetPhone,
        owner: { name: `${b.dog.owner.firstName} ${b.dog.owner.lastName}`, phone: b.dog.owner.phone },
        vaccinations: b.dog.vaccinations.map((v) => ({ name: v.name, expiresAt: v.expiresAt.toISOString().slice(0, 10) })),
      },
    })),
  };
  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
