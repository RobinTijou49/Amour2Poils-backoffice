import { expect, type Page } from "@playwright/test";
import type { Account } from "./accounts";

/** Connexion par la vraie page (aucune session fabriquée) : ce qu'un utilisateur fait. */
export async function login(page: Page, account: Account) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse e-mail").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

/** Aujourd'hui + `offset` jours au format AAAA-MM-JJ (les champs date des formulaires). */
export function isoDay(offset = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export type Stay = { dog: string; start: string; end: string; box?: string; rate?: string };

/** Remplit et envoie le formulaire « Nouvelle réservation » comme le ferait la personne à l'accueil. */
export async function fillBooking(page: Page, stay: Stay) {
  await page.goto("/reservations/nouvelle");
  const chien = page.getByLabel("Chien");
  await chien.selectOption((await chien.locator("option", { hasText: stay.dog }).first().getAttribute("value")) ?? "");
  await page.getByLabel("Arrivée").fill(stay.start);
  await page.getByLabel("Départ").fill(stay.end);
  if (stay.box) await page.getByLabel("Box").selectOption({ label: stay.box });
  if (stay.rate) await page.getByLabel("Tarif par nuit (€)").fill(stay.rate);
  await page.getByRole("button", { name: "Créer la réservation" }).click();
}

/** Crée une réservation qui doit aboutir, et renvoie l'adresse de sa fiche. */
export async function createBooking(page: Page, stay: Stay) {
  await fillBooking(page, stay);
  await expect(page).toHaveURL(/\/reservations\/[a-z0-9]{20,}$/);
  return new URL(page.url()).pathname;
}
