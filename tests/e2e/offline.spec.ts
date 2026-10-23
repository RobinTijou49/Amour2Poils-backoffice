import { expect, test, type Page } from "@playwright/test";
import { EMPLOYEE } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";

// Le cœur du PWA, dans un vrai navigateur : service worker, IndexedDB, coupure du réseau, synchronisation au retour.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

/** Copie locale de la journée dans IndexedDB (ou null). On n'ouvre la base que si elle existe : l'ouvrir vide la créerait sans ses magasins. */
const readSnapshot = (page: Page) =>
  page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "a2p-offline")) return null;
    return new Promise<{ today: string; bookings: { id: string; status: string; dog: { name: string } }[] } | null>((resolve, reject) => {
      const open = indexedDB.open("a2p-offline", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.close();
          return resolve(null);
        }
        const get = db.transaction("kv").objectStore("kv").get("snapshot");
        get.onsuccess = () => {
          db.close();
          resolve(get.result ?? null);
        };
        get.onerror = () => reject(get.error);
      };
    });
  });

/** Gestes en attente dans la file IndexedDB. */
const readQueue = (page: Page) =>
  page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "a2p-offline")) return [] as unknown[];
    return new Promise<unknown[]>((resolve, reject) => {
      const open = indexedDB.open("a2p-offline", 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains("queue")) {
          db.close();
          return resolve([]);
        }
        const all = db.transaction("queue").objectStore("queue").getAll();
        all.onsuccess = () => {
          db.close();
          resolve(all.result);
        };
        all.onerror = () => reject(all.error);
      };
    });
  });

/** Attend que le service worker soit actif ET que la copie du jour soit enregistrée : l'application est « prête pour le hors ligne ». */
async function waitUntilReadyOffline(page: Page) {
  await expect
    .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? "aucun"), { message: "service worker actif", timeout: 15_000 })
    .toBe("activated");
  await expect.poll(async () => (await readSnapshot(page))?.bookings.length ?? 0, { message: "copie locale de la journée", timeout: 15_000 }).toBeGreaterThan(0);
  // la page /offline doit être en cache (précachée à l'installation du service worker)
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length > 0 && Boolean(await caches.match("/offline"))), { message: "page /offline en cache" })
    .toBe(true);
}

test.describe("installable", () => {
  test("le manifeste est valide et ses icônes se chargent (sans être connecté)", async ({ page, request }) => {
    await page.goto("/connexion");
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest).toMatchObject({ name: "Amour 2 Poils · Back-office", display: "standalone", start_url: "/", lang: "fr" });
    expect(manifest.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes}/${i.purpose}`).sort()).toEqual(["192x192/any", "512x512/any", "512x512/maskable"]);
    for (const icon of manifest.icons as { src: string }[]) {
      const res = await request.get(icon.src);
      expect(res.status(), icon.src).toBe(200);
      expect(res.headers()["content-type"]).toBe("image/png");
    }
  });

  test("le service worker s'enregistre en HTTPS-équivalent (localhost) et prend le contrôle de la page", async ({ page }) => {
    await page.goto("/connexion");
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? "aucun"), { timeout: 15_000 }).toBe("activated");
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope);
    expect(scope).toMatch(/\/$/);
    // /sw.js n'est jamais mis en cache par le navigateur : une mise à jour est vue tout de suite
    const res = await page.request.get("/sw.js");
    expect(res.headers()["cache-control"]).toContain("no-store");
    expect(res.headers()["content-type"]).toContain("javascript");
  });
});

test.describe("sans réseau", () => {
  test("hors connexion, n'importe quelle page affiche la journée gardée sur l'appareil", async ({ page, context }) => {
    await login(page, EMPLOYEE);
    await waitUntilReadyOffline(page);

    await context.setOffline(true);
    await page.goto("/reservations");
    await expect(page.getByRole("heading", { name: "Vous êtes hors connexion" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Journée du/ })).toBeVisible();
    // les séjours du jour du jeu de données, lus dans IndexedDB (la page est hydratée sans serveur)
    for (const dog of ["Milo", "Oslo", "Rex"]) await expect(page.getByText(dog, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Arrivée attendue").first()).toBeVisible();
    await expect(page.getByText("Présent", { exact: true }).first()).toBeVisible();
    await context.setOffline(false);
  });

  test("la fiche d'un chien (propriétaire, allergies, vétérinaire) se lit hors connexion", async ({ page, context }) => {
    await login(page, EMPLOYEE);
    await waitUntilReadyOffline(page);
    await context.setOffline(true);
    await page.goto("/");
    await page.getByText("Fiche de Milo").click();
    const fiche = page.locator("details", { hasText: "Fiche de Milo" });
    await expect(fiche.getByText("Propriétaire")).toBeVisible();
    await expect(fiche.getByText("Vaccins")).toBeVisible();
    await context.setOffline(false);
  });

  test("une arrivée enregistrée hors connexion est synchronisée, avec l'heure du geste, au retour du réseau", async ({ page, context }) => {
    await login(page, EMPLOYEE);
    await waitUntilReadyOffline(page);

    await context.setOffline(true);
    await page.goto("/reservations");
    const gesteA = Date.now();
    const milo = page.getByRole("listitem").filter({ hasText: "Milo" });
    await milo.getByRole("button", { name: "Enregistrer l'arrivée" }).click();
    await expect(page.getByRole("status")).toHaveText("Arrivée de Milo enregistrée sur cet appareil, synchronisée au retour du réseau.");
    await expect(page.getByText(/1 geste\(s\) en attente de synchronisation/)).toBeVisible();
    await expect(milo.getByText("Présent", { exact: true })).toBeVisible(); // l'écran reflète déjà le geste
    expect(await readQueue(page)).toHaveLength(1);

    // le temps passe hors connexion, puis le réseau revient : la file est rejouée toute seule
    await page.waitForTimeout(1_500);
    await context.setOffline(false);
    await expect(page.getByRole("status")).toContainText("1 geste(s) synchronisé(s).", { timeout: 15_000 });
    await expect(page.getByText(/geste\(s\) en attente/)).toHaveCount(0);
    expect(await readQueue(page)).toHaveLength(0);

    // côté serveur : Milo est bien en pension, et l'heure d'arrivée est celle du geste (pas celle de la synchronisation)
    const res = await page.request.get("/api/reservations?status=CHECKED_IN");
    const { bookings } = (await res.json()) as { bookings: { dog: { name: string }; checkedInAt: string }[] };
    const enregistre = bookings.find((b) => b.dog.name === "Milo");
    expect(enregistre).toBeDefined();
    const heure = Date.parse(enregistre!.checkedInAt);
    expect(heure).toBeGreaterThanOrEqual(gesteA - 1_000);
    expect(heure).toBeLessThan(gesteA + 1_400); // ~1,5 s avant le retour du réseau : bien avant la synchronisation
  });

  test("après la synchronisation, le tableau de bord montre Milo accueilli", async ({ page }) => {
    await login(page, EMPLOYEE);
    await expect(page.getByRole("row", { name: /Milo/ }).getByText("Fait")).toBeVisible();
  });

  test("un geste devenu impossible pendant la coupure est signalé, pas rejoué : le séjour est déjà terminé côté serveur", async ({ page, context }) => {
    await login(page, EMPLOYEE);
    await waitUntilReadyOffline(page);
    await context.setOffline(true);
    await page.goto("/reservations");
    // Oslo : arrivée enregistrée hors connexion…
    const oslo = page.getByRole("listitem").filter({ hasText: "Oslo" });
    await oslo.getByRole("button", { name: "Enregistrer l'arrivée" }).click();
    await expect(page.getByText(/1 geste\(s\) en attente/)).toBeVisible();
    // …pendant ce temps quelqu'un d'autre l'a déjà fait depuis un poste connecté : on le simule par l'API, hors du contexte coupé
    const autre = await page.context().browser()!.newContext({ baseURL: test.info().project.use.baseURL });
    const poste = await autre.newPage();
    await login(poste, EMPLOYEE);
    const dashboard = await poste.request.get("/api/reservations?status=CONFIRMED");
    const { bookings } = (await dashboard.json()) as { bookings: { id: string; dog: { name: string } }[] };
    const id = bookings.find((b) => b.dog.name === "Oslo")!.id;
    const done = await poste.request.patch(`/api/reservations/${id}`, { data: { action: "check-in" } });
    expect(done.status()).toBe(200);
    await autre.close();

    await context.setOffline(false);
    await expect(page.getByRole("status")).toContainText("Ignoré : Oslo", { timeout: 15_000 });
    expect(await readQueue(page)).toHaveLength(0); // abandonné, pas bloqué à jamais dans la file
  });
});

test.describe("déconnexion", () => {
  test("les fiches des clients ne restent pas sur l'appareil après la déconnexion", async ({ page }) => {
    await login(page, EMPLOYEE);
    await waitUntilReadyOffline(page);
    expect((await readSnapshot(page))?.bookings.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL("/connexion");
    await expect.poll(() => readSnapshot(page), { message: "copie locale effacée" }).toBeNull();
  });
});
