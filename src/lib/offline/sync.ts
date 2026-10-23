import { addToQueue, clearSnapshot, loadQueue, loadSnapshot, removeFromQueue, saveSnapshot } from "./store";
import type { OfflineBooking, OfflineSnapshot, QueuedAction } from "./types";

// Synchronisation entre le serveur, IndexedDB et la file de gestes en attente.

export type FlushResult = { sent: number; dropped: string[]; pending: number; needsLogin: boolean };

/** Rejoue les gestes en attente, dans l'ordre. S'arrête au premier échec réseau ou à la perte de session. */
export async function flushQueue(): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, dropped: [], pending: 0, needsLogin: false };
  const queue = await loadQueue();
  for (const item of queue) {
    let res: Response;
    try {
      res = await fetch(`/api/reservations/${item.bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: item.action, at: item.at }),
      });
    } catch {
      break; // toujours hors connexion : on réessaiera au retour du réseau
    }
    if (res.status === 401) {
      result.needsLogin = true;
      break;
    }
    if (res.ok) result.sent++;
    else if (res.status === 409 || res.status === 404) {
      // Déjà fait ou réservation modifiée entre-temps : le geste n'a plus de sens, on ne le rejoue pas.
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      result.dropped.push(`${item.dogName} : ${body.error ?? "geste ignoré"}`);
    } else break; // erreur serveur : on garde le geste
    await removeFromQueue(item.id);
  }
  result.pending = (await loadQueue()).length;
  return result;
}

/** Télécharge l'instantané du jour. En cas de 401, les données locales sont effacées (session expirée). */
export async function refreshSnapshot(): Promise<"ok" | "offline" | "unauthorized"> {
  try {
    const res = await fetch("/api/hors-ligne", { cache: "no-store" });
    if (res.status === 401) {
      await clearSnapshot();
      return "unauthorized";
    }
    if (!res.ok) return "offline";
    await saveSnapshot((await res.json()) as OfflineSnapshot);
    return "ok";
  } catch {
    return "offline";
  }
}

/** Enregistre un geste hors ligne et met l'instantané local à jour pour que l'écran le reflète. */
export async function queueAction(booking: OfflineBooking, action: QueuedAction["action"]) {
  const at = new Date().toISOString();
  await addToQueue({ id: crypto.randomUUID(), bookingId: booking.id, action, dogName: booking.dog.name, at });
  const snapshot = await loadSnapshot();
  if (snapshot) {
    const next = action === "check-in" ? "CHECKED_IN" : "COMPLETED";
    await saveSnapshot({ ...snapshot, bookings: snapshot.bookings.map((b) => (b.id === booking.id ? { ...b, status: next } : b)) });
  }
}

/** Synchronisation complète : d'abord les gestes en attente, puis un instantané frais. */
export async function syncAll() {
  const flushed = await flushQueue();
  const snapshot = flushed.pending === 0 ? await refreshSnapshot() : ("offline" as const);
  return { ...flushed, snapshot };
}
