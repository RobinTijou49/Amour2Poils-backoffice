import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { ADMIN } from "../e2e/accounts";
import { login } from "../e2e/helpers";
import { reseed } from "../e2e/reseed";

// Enregistre la VIDÉO de démonstration du mode hors ligne : un « téléphone » (Chromium au format mobile, qui passe réellement
// hors ligne) à gauche, l'ordinateur sur la réservation à droite, puis les assemble avec des légendes sur la page studio.html.
// Ce n'est pas un test : `bun run demo:video` (build de production + base de test E2E, aucune donnée réelle).
test.describe.configure({ mode: "serial" });

const OUT = resolve("demo-video");
const RAW = join(OUT, "raw");
const PHONE = { width: 390, height: 844 };
const PC = { width: 1000, height: 844 };
const STUDIO = { width: 1440, height: 900 };

type Step = { t: number; text: string; net: "on" | "off" };

/** Rond rouge à l'endroit du toucher : une vidéo d'écran n'a pas de curseur, sans cela on ne voit pas ce qui est touché. */
async function tap(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box) {
    await page.evaluate(({ x, y }) => {
      const dot = document.createElement("div");
      dot.style.cssText = `position:fixed;left:${x - 28}px;top:${y - 28}px;width:56px;height:56px;border-radius:50%;background:rgba(220,38,38,.45);border:3px solid #dc2626;z-index:2147483647;pointer-events:none;transition:transform .5s,opacity .6s`;
      document.body.appendChild(dot);
      requestAnimationFrame(() => requestAnimationFrame(() => ((dot.style.transform = "scale(1.5)"), (dot.style.opacity = "0"))));
      setTimeout(() => dot.remove(), 900);
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await page.waitForTimeout(450);
  }
  await target.click();
}

test("enregistrer la démonstration hors ligne (téléphone + ordinateur)", async ({ browser }) => {
  test.setTimeout(240_000);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });
  await reseed();

  // Connexion hors enregistrement : on ne filme ni le mot de passe ni l'écran de connexion.
  const setup = await browser.newContext();
  const setupPage = await setup.newPage();
  await login(setupPage, ADMIN);
  const storageState = await setup.storageState();
  const list = await setupPage.request.get("/api/reservations?status=CONFIRMED");
  const { bookings } = (await list.json()) as { bookings: { id: string; dog: { name: string } }[] };
  const booking = bookings.find((b) => b.dog.name === "Milo");
  expect(booking, "la réservation confirmée de Milo (données de test)").toBeDefined();
  await setup.close();

  const phoneCtx = await browser.newContext({ storageState, viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", timezoneId: "Europe/Paris", recordVideo: { dir: RAW, size: PHONE } });
  const phone = await phoneCtx.newPage();
  const phoneT0 = Date.now();
  const pcCtx = await browser.newContext({ storageState, viewport: PC, locale: "fr-FR", timezoneId: "Europe/Paris", recordVideo: { dir: RAW, size: PC } });
  const pc = await pcCtx.newPage();
  const pcT0 = Date.now();

  const steps: Step[] = [];
  let net: "on" | "off" = "on";
  const say = (text: string) => steps.push({ t: Date.now() - phoneT0, text, net });
  const pause = (ms: number) => phone.waitForTimeout(ms);

  // 1. L'ordinateur montre la réservation : elle est « confirmée », personne n'est encore arrivé.
  say("1 · L'ordinateur affiche la réservation de Milo : arrivée prévue aujourd'hui");
  await pc.goto(`/reservations/${booking!.id}`);
  await expect(pc.getByRole("heading", { name: /Milo/ }).first()).toBeVisible();

  // 2. Le téléphone a du réseau : l'application copie la journée sur l'appareil.
  await phone.goto("/");
  await expect(phone.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  await expect.poll(() => phone.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? "aucun"), { timeout: 20_000 }).toBe("activated");
  await expect
    .poll(
      () =>
        phone.evaluate(async () => {
          const dbs = await indexedDB.databases();
          if (!dbs.some((d) => d.name === "a2p-offline")) return 0;
          return new Promise<number>((res) => {
            const open = indexedDB.open("a2p-offline", 1);
            open.onsuccess = () => {
              const get = open.result.transaction("kv").objectStore("kv").get("snapshot");
              get.onsuccess = () => res(get.result?.bookings?.length ?? 0);
            };
          });
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThan(0);
  say("2 · Avec du réseau, le téléphone garde une copie de la journée");
  await pause(3500);

  // 3. Mode avion : plus aucun réseau. L'application s'ouvre quand même (service worker + copie locale).
  net = "off";
  await phoneCtx.setOffline(true);
  say("3 · Mode avion : l'application s'ouvre sans réseau, avec les données de la journée");
  await phone.goto("/reservations");
  await expect(phone.getByRole("heading", { name: "Vous êtes hors connexion" })).toBeVisible();
  const milo = phone.getByRole("listitem").filter({ hasText: "Milo" });
  await expect(milo).toBeVisible();
  await pause(4000);

  // 4. L'arrivée est enregistrée sans réseau : dans la file d'attente de l'appareil.
  say("4 · Arrivée de Milo enregistrée sur le téléphone, sans réseau");
  await tap(phone, milo.getByRole("button", { name: "Enregistrer l'arrivée" }));
  await expect(phone.getByRole("status")).toContainText("synchronisée au retour du réseau");
  await expect(phone.getByText(/1 geste\(s\) en attente de synchronisation/)).toBeVisible();
  await pause(4500);

  // 5. Pendant ce temps, l'ordinateur ne sait encore rien.
  say("5 · Pendant ce temps, l'ordinateur ne sait rien : la réservation n'a pas changé");
  await pc.reload();
  await expect(pc.getByRole("heading", { name: /Milo/ }).first()).toBeVisible();
  await pause(4500);

  // 6. Le réseau revient : le geste est rejoué automatiquement, avec son heure réelle.
  net = "on";
  await phoneCtx.setOffline(false);
  say("6 · Le réseau revient : le geste en attente est envoyé automatiquement");
  await expect(phone.getByRole("status")).toContainText("1 geste(s) synchronisé(s)", { timeout: 20_000 });
  await pause(4000);

  // 7. Le téléphone retrouve l'application en ligne (le geste « Réessayer » de l'utilisateur).
  say("7 · Le téléphone retrouve l'application en ligne");
  await tap(phone, phone.getByRole("link", { name: "Réessayer" }));
  await expect(phone.getByRole("heading", { name: "Tableau de bord" })).toBeVisible({ timeout: 15_000 });
  await pause(4000);

  // 8. L'ordinateur montre l'arrivée.
  say("8 · Sur l'ordinateur : l'arrivée de Milo est enregistrée, avec le statut « En pension »");
  await pc.reload();
  await expect(pc.getByRole("heading", { name: /Milo/ }).first()).toBeVisible();
  await pause(6000);

  // Fin d'enregistrement : fermer les contextes écrit les fichiers vidéo.
  const phoneVideo = await phone.video()!.path();
  const pcVideo = await pc.video()!.path();
  await phoneCtx.close();
  await pcCtx.close();

  // Assemblage côte à côte sur la page studio, enregistrée à son tour.
  const studioCtx = await browser.newContext({ viewport: STUDIO, recordVideo: { dir: OUT, size: STUDIO } });
  const studio = await studioCtx.newPage();
  await studio.goto(pathToFileURL(resolve("tests/video/studio.html")).href);
  await studio.evaluate((cfg) => (window as unknown as { start(c: unknown): void }).start(cfg), {
    phone: pathToFileURL(phoneVideo).href,
    pc: pathToFileURL(pcVideo).href,
    pcDelayMs: pcT0 - phoneT0,
    events: steps,
  });
  // Une capture par étape, pour relire ce que montre la vidéo sans la visionner en entier.
  const framesStart = Date.now();
  mkdirSync(join(OUT, "frames"), { recursive: true });
  for (const [i, step] of steps.entries()) {
    const wait = framesStart + step.t + 2500 - Date.now();
    if (wait > 0) await studio.waitForTimeout(wait);
    await studio.screenshot({ path: join(OUT, "frames", `etape-${i + 1}.png`) });
  }
  await studio.waitForFunction(() => (window as unknown as { __done: boolean }).__done, undefined, { timeout: 150_000 });
  const studioVideo = await studio.video()!.path();
  await studioCtx.close();
  copyFileSync(studioVideo, join(OUT, "demo-hors-ligne.webm"));
  console.log(`Vidéo prête : ${join(OUT, "demo-hors-ligne.webm")}`);
});
