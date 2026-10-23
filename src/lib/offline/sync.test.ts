import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { OfflineBooking, OfflineSnapshot, QueuedAction } from "./types";

// IndexedDB est remplacé par une mémoire : on teste les règles de synchronisation, pas le navigateur.
let queue: QueuedAction[] = [];
let snapshot: OfflineSnapshot | undefined;
mock.module("./store", () => ({
  addToQueue: async (a: QueuedAction) => void queue.push(a),
  removeFromQueue: async (id: string) => void (queue = queue.filter((q) => q.id !== id)),
  loadQueue: async () => [...queue].sort((a, b) => a.at.localeCompare(b.at)),
  saveSnapshot: async (s: OfflineSnapshot) => void (snapshot = s),
  loadSnapshot: async () => snapshot,
  clearSnapshot: async () => void (snapshot = undefined),
}));

const { flushQueue, queueAction, refreshSnapshot, syncAll } = await import("./sync");

type Reply = number | "network";
let replies: Reply[];
let requests: { url: string; method?: string; body: unknown }[];
const realFetch = globalThis.fetch;

function stubFetch(body: unknown = {}) {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method, body: init?.body ? JSON.parse(init.body as string) : undefined });
    const reply = replies.shift() ?? 200;
    if (reply === "network") throw new TypeError("Failed to fetch");
    return new Response(JSON.stringify(body), { status: reply });
  }) as typeof fetch;
}

const item = (id: string, at: string, action: QueuedAction["action"] = "check-in", dogName = "Milo"): QueuedAction => ({ id, bookingId: `bk-${id}`, action, dogName, at });
const booking = (id: string, status: OfflineBooking["status"] = "CONFIRMED"): OfflineBooking => ({
  id,
  status,
  startDate: "2026-10-23",
  endDate: "2026-10-27",
  kennel: null,
  dog: { id: "d", name: "Milo", breed: null, allergies: null, diet: null, behaviorNotes: null, vetName: null, vetPhone: null, owner: { name: "L M", phone: "06" }, vaccinations: [] },
});

beforeEach(() => {
  queue = [];
  snapshot = undefined;
  replies = [];
  requests = [];
  stubFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("flushQueue : rejouer les gestes faits hors connexion", () => {
  test("envoie chaque geste (PATCH JSON avec l'heure réelle), dans l'ordre où ils ont eu lieu, et vide la file", async () => {
    // insérés dans le désordre : l'ordre d'exécution suit l'heure du geste
    queue = [item("2", "2026-10-23T10:05:00.000Z", "check-out"), item("1", "2026-10-23T10:00:00.000Z", "check-in")];
    const result = await flushQueue();
    expect(result).toEqual({ sent: 2, dropped: [], pending: 0, needsLogin: false });
    expect(requests.map((r) => [r.url, r.method, r.body])).toEqual([
      ["/api/reservations/bk-1", "PATCH", { action: "check-in", at: "2026-10-23T10:00:00.000Z" }],
      ["/api/reservations/bk-2", "PATCH", { action: "check-out", at: "2026-10-23T10:05:00.000Z" }],
    ]);
    expect(queue).toHaveLength(0);
  });

  test("file vide : aucune requête", async () => {
    expect(await flushQueue()).toEqual({ sent: 0, dropped: [], pending: 0, needsLogin: false });
    expect(requests).toHaveLength(0);
  });

  test("session expirée (401) : on s'arrête, TOUS les gestes restent en attente, l'utilisateur doit se reconnecter", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z"), item("2", "2026-10-23T10:01:00.000Z")];
    replies = [401];
    const result = await flushQueue();
    expect(result).toMatchObject({ sent: 0, needsLogin: true, pending: 2 });
    expect(requests).toHaveLength(1); // le deuxième n'est même pas tenté
    expect(queue).toHaveLength(2);
  });

  test("toujours hors connexion (erreur réseau) : on s'arrête sans rien perdre, sans demander de reconnexion", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z"), item("2", "2026-10-23T10:01:00.000Z")];
    replies = ["network"];
    const result = await flushQueue();
    expect(result).toMatchObject({ sent: 0, needsLogin: false, pending: 2 });
    expect(requests).toHaveLength(1);
  });

  test("erreur serveur (500) : le geste est conservé pour un prochain essai", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z")];
    replies = [500];
    expect(await flushQueue()).toMatchObject({ sent: 0, pending: 1, dropped: [] });
    expect(queue).toHaveLength(1);
  });

  test.each([409, 404])("geste devenu impossible (%i) : abandonné avec une explication, la suite continue", async (status) => {
    stubFetch({ error: "Cette action n'est plus possible pour cette réservation." });
    queue = [item("1", "2026-10-23T10:00:00.000Z", "check-in", "Milo"), item("2", "2026-10-23T10:01:00.000Z", "check-in", "Rex")];
    replies = [status, 200];
    const result = await flushQueue();
    expect(result.sent).toBe(1);
    expect(result.dropped).toEqual(["Milo : Cette action n'est plus possible pour cette réservation."]);
    expect(result.pending).toBe(0);
    expect(queue).toHaveLength(0);
  });

  test("geste abandonné sans message du serveur : texte par défaut", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z", "check-in", "Milo")];
    globalThis.fetch = (async () => new Response("pas du json", { status: 409 })) as unknown as typeof fetch;
    expect((await flushQueue()).dropped).toEqual(["Milo : geste ignoré"]);
  });

  test("un échec réseau au milieu de la file : les gestes déjà envoyés sont retirés, les autres restent", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z"), item("2", "2026-10-23T10:01:00.000Z"), item("3", "2026-10-23T10:02:00.000Z")];
    replies = [200, "network"];
    const result = await flushQueue();
    expect(result).toMatchObject({ sent: 1, pending: 2 });
    expect(queue.map((q) => q.id)).toEqual(["2", "3"]);
  });
});

describe("refreshSnapshot : copie locale de la journée", () => {
  const fresh: OfflineSnapshot = { generatedAt: "2026-10-23T08:00:00.000Z", today: "2026-10-23", bookings: [booking("b1")] };

  test("réponse correcte : copie enregistrée", async () => {
    stubFetch(fresh);
    expect(await refreshSnapshot()).toBe("ok");
    expect(snapshot).toEqual(fresh);
  });

  test("401 : la copie est EFFACÉE (session expirée ou déconnexion, les fiches clients ne restent pas sur l'appareil)", async () => {
    snapshot = fresh;
    replies = [401];
    expect(await refreshSnapshot()).toBe("unauthorized");
    expect(snapshot).toBeUndefined();
  });

  test("erreur serveur ou réseau : l'ancienne copie est conservée (mieux qu'une vieille copie que rien hors connexion)", async () => {
    snapshot = fresh;
    replies = [500];
    expect(await refreshSnapshot()).toBe("offline");
    replies = ["network"];
    expect(await refreshSnapshot()).toBe("offline");
    expect(snapshot).toEqual(fresh);
  });

  test("demande une réponse jamais mise en cache", async () => {
    let cache: RequestCache | undefined;
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      cache = init?.cache;
      return new Response(JSON.stringify(fresh));
    }) as typeof fetch;
    await refreshSnapshot();
    expect(cache).toBe("no-store");
  });
});

describe("queueAction : geste enregistré sur l'appareil", () => {
  test("ajoute le geste à la file avec l'heure réelle et le nom du chien", async () => {
    const before = Date.now();
    await queueAction(booking("b1"), "check-in");
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ bookingId: "b1", action: "check-in", dogName: "Milo" });
    expect(Date.parse(queue[0]!.at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(queue[0]!.at)).toBeLessThanOrEqual(Date.now());
    expect(queue[0]!.id.length).toBeGreaterThan(10); // identifiant unique
  });

  test("met la copie locale à jour : arrivée → CHECKED_IN, départ → COMPLETED, les autres séjours inchangés", async () => {
    snapshot = { generatedAt: "x", today: "2026-10-23", bookings: [booking("b1", "CONFIRMED"), booking("b2", "CHECKED_IN"), booking("b3", "CONFIRMED")] };
    await queueAction(booking("b1"), "check-in");
    await queueAction(booking("b2", "CHECKED_IN"), "check-out");
    expect(snapshot.bookings.map((b) => [b.id, b.status])).toEqual([
      ["b1", "CHECKED_IN"],
      ["b2", "COMPLETED"],
      ["b3", "CONFIRMED"],
    ]);
  });

  test("sans copie locale, le geste est quand même mis en file", async () => {
    await queueAction(booking("b1"), "check-in");
    expect(queue).toHaveLength(1);
    expect(snapshot).toBeUndefined();
  });

  test("deux gestes identiques ont des identifiants différents (pas d'écrasement)", async () => {
    await queueAction(booking("b1"), "check-in");
    await queueAction(booking("b1"), "check-in");
    expect(new Set(queue.map((q) => q.id)).size).toBe(2);
  });
});

describe("syncAll", () => {
  test("file vidée : la copie du jour est rafraîchie ensuite", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z")];
    stubFetch({ generatedAt: "n", today: "2026-10-23", bookings: [] });
    const result = await syncAll();
    expect(result).toMatchObject({ sent: 1, pending: 0, snapshot: "ok" });
    expect(requests.map((r) => r.url)).toEqual(["/api/reservations/bk-1", "/api/hors-ligne"]);
  });

  test("gestes encore en attente : on ne rafraîchit PAS la copie (elle écraserait les statuts locaux pas encore envoyés)", async () => {
    queue = [item("1", "2026-10-23T10:00:00.000Z")];
    replies = ["network"];
    const result = await syncAll();
    expect(result).toMatchObject({ pending: 1, snapshot: "offline" });
    expect(requests.map((r) => r.url)).toEqual(["/api/reservations/bk-1"]);
  });
});
