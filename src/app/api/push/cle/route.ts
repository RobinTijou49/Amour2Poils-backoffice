import { apiError, guard } from "@/lib/api";

/** GET /api/push/cle : clé VAPID publique, nécessaire au navigateur pour s'abonner. La clé privée ne sort jamais du serveur. */
export async function GET(request: Request) {
  const g = await guard(request);
  if ("response" in g) return g.response;
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return apiError("Notifications non configurées.", 503);
  return Response.json({ key });
}
