import { z } from "zod";
import { apiError, guard, readJson, zodDetails } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const subscription = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** POST /api/push/abonnement : enregistre (ou réattribue) l'appareil qui vient de s'abonner. */
export async function POST(request: Request) {
  const g = await guard(request, { write: true });
  if (!g.ok) return g.response;
  const parsed = subscription.safeParse(await readJson(request));
  if (!parsed.success) return apiError("Abonnement invalide.", 422, zodDetails(parsed.error));
  const { endpoint, keys } = parsed.data;
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: g.user.id },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: g.user.id },
  });
  return Response.json({ ok: true }, { status: 201 });
}

/** DELETE /api/push/abonnement { endpoint } : désabonne l'appareil (seulement un abonnement de l'utilisateur connecté). */
export async function DELETE(request: Request) {
  const g = await guard(request, { write: true });
  if (!g.ok) return g.response;
  const parsed = z.object({ endpoint: z.string().min(1).max(2000) }).safeParse(await readJson(request));
  if (!parsed.success) return apiError("Abonnement invalide.", 422, zodDetails(parsed.error));
  await prisma.pushSubscription.deleteMany({ where: { endpoint: parsed.data.endpoint, userId: g.user.id } });
  return Response.json({ ok: true });
}
