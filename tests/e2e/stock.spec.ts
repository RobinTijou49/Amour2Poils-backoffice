import { expect, test, type Page } from "@playwright/test";
import { ADMIN, EMPLOYEE } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

// Données de départ (prisma/seed.ts) : « Croquettes adulte » 4 sacs (seuil 2), « Croquettes chiot » 1 sac (déjà sous son seuil de 2).
const kpi = (page: Page) => page.getByRole("region", { name: "Indicateurs" });

async function openProduct(page: Page, name: string) {
  await page.getByRole("link", { name: "Stock", exact: true }).click();
  // Le lien se lit « Croquettes adulte · sac 15 kg » (nom puis unité).
  await page.getByRole("table", { name: "Produits en stock" }).getByRole("link", { name: new RegExp(`^${name} ·`) }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

async function recordMovement(page: Page, type: "Sortie" | "Entrée" | "Inventaire", quantity: string, reason?: string) {
  await page.getByLabel("Type de mouvement").selectOption({ label: { Sortie: "Sortie (utilisation)", Entrée: "Entrée (livraison)", Inventaire: "Inventaire (quantité comptée)" }[type] });
  await page.getByLabel(/^Quantité \(/).fill(quantity);
  if (reason) await page.getByLabel("Motif (facultatif)").fill(reason);
  await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
}

test.describe("suivi du stock", () => {
  test("la liste montre l'état de chaque produit : « Stock bas » ou « Suffisant »", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.getByRole("link", { name: "Stock", exact: true }).click();
    const table = page.getByRole("table", { name: "Produits en stock" });
    await expect(table.getByRole("row", { name: /Croquettes chiot/ }).getByText("Stock bas")).toBeVisible();
    await expect(table.getByRole("row", { name: /Friandises au bœuf/ }).getByText("Suffisant")).toBeVisible();
  });

  test("une sortie supérieure au stock est refusée, et la quantité ne bouge pas", async ({ page }) => {
    await login(page, EMPLOYEE);
    await openProduct(page, "Croquettes adulte");
    await expect(kpi(page)).toContainText(/En stock\s*4/);
    await recordMovement(page, "Sortie", "10");
    await expect(page.getByText("Stock insuffisant : il reste 4 sac 15 kg.").first()).toBeVisible();
    await expect(page.getByLabel(/^Quantité \(/)).toHaveAttribute("aria-invalid", "true");
    await expect(kpi(page)).toContainText(/En stock\s*4/);
  });

  test("une sortie valide met à jour la quantité, l'historique (avec l'auteur) et prévient du seuil", async ({ page }) => {
    await login(page, EMPLOYEE);
    await openProduct(page, "Croquettes adulte");
    await recordMovement(page, "Sortie", "3", "Repas pension");
    await expect(page.getByRole("status").filter({ hasText: "Sous le seuil d'alerte." })).toContainText("Stock de « Croquettes adulte » : 1 sac 15 kg.");
    await expect(kpi(page)).toContainText(/En stock\s*1/);
    await expect(kpi(page)).toContainText("Stock bas : prévoir une commande");
    const dernier = page.getByRole("table", { name: /Derniers mouvements/ }).getByRole("row").nth(1);
    await expect(dernier).toContainText("Sortie");
    await expect(dernier).toContainText("3");
    await expect(dernier).toContainText(EMPLOYEE.name);
    await expect(dernier).toContainText("Repas pension");
  });

  test("le mouvement est conservé après rechargement", async ({ page }) => {
    await login(page, EMPLOYEE);
    await openProduct(page, "Croquettes adulte");
    await expect(kpi(page)).toContainText(/En stock\s*1/);
  });

  test("un produit sous son seuil apparaît dans « À traiter » du tableau de bord ; « Entrée » le réapprovisionne en un geste", async ({ page }) => {
    await login(page, EMPLOYEE);
    const alerte = page.getByRole("link", { name: /Stock bas Croquettes adulte/ });
    await expect(alerte).toBeVisible();
    const form = page.locator("form", { has: page.getByLabel("Quantité reçue pour Croquettes adulte") });
    await form.getByLabel("Quantité reçue pour Croquettes adulte").fill("5");
    await form.getByRole("button", { name: "Entrée" }).click();
    await expect(alerte).toHaveCount(0); // 1 + 5 = 6 : au-dessus du seuil, l'alerte disparaît
    await openProduct(page, "Croquettes adulte");
    await expect(kpi(page)).toContainText(/En stock\s*6/);
  });

  test("un inventaire fixe la quantité comptée, quelle que soit l'ancienne", async ({ page }) => {
    await login(page, EMPLOYEE);
    await openProduct(page, "Croquettes adulte");
    await recordMovement(page, "Inventaire", "20", "Comptage de fin de mois");
    await expect(kpi(page)).toContainText(/En stock\s*20/);
  });
});

test.describe("catalogue : réservé à la gérance", () => {
  test("la gérance crée un produit : stock initial tracé comme une entrée", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/stock/nouveau");
    await page.getByLabel("Nom du produit").fill("Brosse douce E2E");
    await page.getByLabel("Catégorie").selectOption({ label: "Hygiène" });
    await page.getByLabel("Unité").fill("pièce");
    await page.getByLabel("Quantité initiale").fill("6");
    await page.getByLabel("Seuil d'alerte").fill("2");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(page.getByRole("heading", { name: "Brosse douce E2E" })).toBeVisible();
    await expect(kpi(page)).toContainText(/En stock\s*6/);
    await expect(page.getByRole("table", { name: /Derniers mouvements/ })).toContainText("Stock initial");
  });

  test("un nom déjà pris est refusé, avec le message sous le champ", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/stock/nouveau");
    await page.getByLabel("Nom du produit").fill("Brosse douce E2E");
    await page.getByLabel("Catégorie").selectOption({ label: "Hygiène" });
    await page.getByLabel("Unité").fill("pièce");
    await page.getByRole("button", { name: "Créer le produit" }).click();
    await expect(page.getByText("Un produit porte déjà ce nom.")).toBeVisible();
    await expect(page.getByLabel("Nom du produit")).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL("/stock/nouveau");
  });

  test("l'employé n'a pas le bouton « Nouveau produit »", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.getByRole("link", { name: "Stock", exact: true }).click();
    await expect(page.getByRole("link", { name: /Nouveau produit|Ajouter un produit/ })).toHaveCount(0);
  });
});
