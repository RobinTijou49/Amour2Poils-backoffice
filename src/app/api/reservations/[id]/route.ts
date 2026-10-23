import { z } from "zod";
import type { BookingStatus } from "@/generated/prisma/client";
import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { kennelHasRoom } from "@/lib/booking-service";
import { canTransition } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";

const body = z.object({
  action: z.enum(["confirm", "check-in", "check-out", "cancel"]),
  kennelId: z.string().min(1).optional(),
  // Heure réelle d'un geste enregistré hors connexion puis rejoué (check-in / check-out).
  at: z.iso.datetime().optional(),
});

/** Heure du geste : celle fournie si elle est plausible (pas dans le futur, pas plus de 7 jours), sinon maintenant. */
function gestureTime(at: string | undefined) {
  const now = Date.now();
  const t = at ? Date.parse(at) : NaN;
  return new Date(t <= now && t > now - 7 * 86_400_000 ? t : now);
}
const target: Record<z.infer<typeof body>["action"], BookingStatus> = {
  confirm: "CONFIRMED",
  "check-in": "CHECKED_IN",
  "check-out": "COMPLETED",
  cancel: "CANCELLED",
};

/** PATCH /api/reservations/:id  { action: "confirm" | "check-in" | "check-out" | "cancel", kennelId? } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(request, { write: true });
  if ("response" in g) return g.response;
  const parsed = body.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Données invalides.", 422, zodDetails(parsed.error));
  const { action, kennelId, at } = parsed.data;
  if (action === "cancel" && g.user.role !== "ADMIN") return apiError("Seule la gérance peut annuler une réservation.", 403);

  const booking = await prisma.booking.findUnique({ where: { id: (await params).id } });
  if (!booking) return apiError("Réservation introuvable.", 404);
  const to = target[action];
  if (!canTransition(booking.status, to)) return apiError("Cette action n'est plus possible pour cette réservation.", 409);

  const data: { status: BookingStatus; kennelId?: string; checkedInAt?: Date; checkedOutAt?: Date } = { status: to };
  if (action === "confirm") {
    if (!kennelId) return apiError("Choisissez une box.", 422, { kennelId: "Choisissez une box." });
    if (!(await kennelHasRoom(kennelId, booking.startDate, booking.endDate, booking.id))) return apiError("Box complète sur ces dates.", 409, { kennelId: "Box complète sur ces dates." });
    data.kennelId = kennelId;
  }
  if (action === "check-in") data.checkedInAt = gestureTime(at);
  if (action === "check-out") data.checkedOutAt = gestureTime(at);
  return Response.json({ booking: await prisma.booking.update({ where: { id: booking.id }, data }) });
}
