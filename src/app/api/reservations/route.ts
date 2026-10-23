import { z } from "zod";
import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { bookingInput, createBookingRecord, kennelHasRoom } from "@/lib/booking-service";
import { prisma } from "@/lib/prisma";

const status = z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED", "CANCELLED"]);

/** GET /api/reservations?status=CONFIRMED : liste des réservations. */
export async function GET(request: Request) {
  const g = await guard(request);
  if ("response" in g) return g.response;
  const parsed = status.optional().safeParse(new URL(request.url).searchParams.get("status") ?? undefined);
  if (!parsed.success) return apiError("Statut inconnu.", 422);
  const bookings = await prisma.booking.findMany({
    where: { status: parsed.data },
    orderBy: { startDate: "asc" },
    include: { dog: { select: { id: true, name: true } }, kennel: { select: { id: true, name: true } } },
  });
  return Response.json({ bookings });
}

/** POST /api/reservations : mêmes règles que le formulaire (validation, capacité de la box). */
export async function POST(request: Request) {
  const g = await guard(request, { write: true });
  if ("response" in g) return g.response;
  const parsed = bookingInput.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Données invalides.", 422, zodDetails(parsed.error));
  const d = parsed.data;
  if (!(await prisma.dog.findUnique({ where: { id: d.dogId }, select: { id: true } }))) return apiError("Chien introuvable.", 422, { dogId: "Chien introuvable." });
  if (d.kennelId && !(await kennelHasRoom(d.kennelId, d.startDate, d.endDate))) {
    return apiError("Box complète sur ces dates.", 409, { kennelId: "Box complète sur ces dates." });
  }
  const booking = await createBookingRecord(d);
  return Response.json({ booking }, { status: 201, headers: { Location: `/api/reservations/${booking.id}` } });
}
