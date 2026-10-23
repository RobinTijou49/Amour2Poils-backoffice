import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// Envoi des notifications Web Push. Les clés VAPID viennent de .env (jamais côté client).

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;
function configure() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return true;
}

/** Envoie à tous les appareils abonnés. Supprime ceux que le service de push signale comme expirés (404 / 410). */
export async function sendToAll(payload: PushPayload) {
  if (!configure()) return { sent: 0, removed: 0 };
  const subscriptions = await prisma.pushSubscription.findMany();
  const body = JSON.stringify(payload);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { TTL: 60 * 60 * 24 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
      }
    }),
  );
  if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  return { sent, removed: gone.length };
}

/** Notification déclenchée par une action : envoyée après la réponse, sans jamais la ralentir ni la faire échouer. */
export function notify(payload: PushPayload) {
  after(() => sendToAll(payload).catch(() => undefined));
}
