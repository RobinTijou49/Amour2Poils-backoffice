import { timingSafeEqual } from "node:crypto";
import { apiError } from "@/lib/api";
import { utcDay } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sendToAll } from "@/lib/push";

/** Compare deux secrets sans révéler, par le temps de réponse, combien de caractères sont corrects. */
function sameSecret(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/push/rappels-vaccins : appelé chaque jour par un cron (pas de session : secret `CRON_SECRET`
 * en en-tête `Authorization: Bearer …`). Prévient si des vaccins expirent dans les 7 prochains jours.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret || !sameSecret(given, secret)) return apiError("Non autorisé.", 401);

  const today = utcDay(new Date());
  const due = await prisma.vaccination.findMany({
    where: { expiresAt: { gte: today, lt: utcDay(today, 7) } },
    include: { dog: { select: { name: true } } },
    orderBy: { expiresAt: "asc" },
  });
  if (due.length === 0) return Response.json({ due: 0, sent: 0 });
  const names = [...new Set(due.map((v) => v.dog.name))];
  const result = await sendToAll({
    title: "Vaccins à renouveler",
    body: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` et ${names.length - 3} autre(s)` : ""} : vaccin expirant sous 7 jours.`,
    url: "/chiens",
    tag: "rappel-vaccins",
  });
  return Response.json({ due: due.length, ...result });
}
