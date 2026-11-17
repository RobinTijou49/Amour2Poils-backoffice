import { expect, test } from "@playwright/test";
import { ADMIN } from "./accounts";
import { expectNoA11yViolations } from "./a11y";
import { isoDay, login } from "./helpers";
import { reseed } from "./reseed";
import { pageIds, SCREENS } from "./screens";

// Chaque écran du back-office passe axe (WCAG 2.2 A/AA) en clair, en sombre et sur un téléphone.
test.beforeAll(() => reseed());

const MODES = [
  ["clair, ordinateur", { colorScheme: "light" as const }],
  ["sombre, ordinateur", { colorScheme: "dark" as const }],
  ["clair, téléphone", { colorScheme: "light" as const, viewport: { width: 390, height: 844 }, hasTouch: true }],
] as const;

for (const [mode, options] of MODES) {
  test.describe(`axe : ${mode}`, () => {
    test.use(options);

    test("connexion (non connecté)", async ({ page }) => {
      await page.goto("/connexion");
      await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
      await expectNoA11yViolations(page, `connexion, ${mode}`);
    });

    for (const screen of SCREENS) {
      test(screen.name, async ({ page }) => {
        await login(page, ADMIN);
        await screen.open(page, await pageIds(page));
        await expect(page.locator("h1").first()).toBeVisible();
        await expectNoA11yViolations(page, `${screen.name}, ${mode}`);
      });
    }
  });
}

// Les états que l'on ne voit pas en ouvrant simplement la page : erreurs, messages, panneaux dépliés.
test.describe("axe : états d'erreur et panneaux ouverts", () => {
  test("connexion avec une erreur annoncée", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
    await page.getByLabel("Mot de passe").fill("mauvais");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(/incorrect/);
    await expectNoA11yViolations(page, "connexion en erreur");
  });

  test("formulaire de réservation avec des erreurs sous chaque champ", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/reservations/nouvelle");
    const chien = page.getByLabel("Chien");
    await chien.selectOption((await chien.locator("option", { hasText: "Pepper" }).first().getAttribute("value")) ?? "");
    await page.getByLabel("Arrivée").fill(isoDay(-2));
    await page.getByLabel("Départ").fill(isoDay(-3));
    await page.getByRole("button", { name: "Créer la réservation" }).click();
    await expect(page.getByLabel("Arrivée")).toHaveAttribute("aria-invalid", "true");
    await expectNoA11yViolations(page, "réservation en erreur");
  });

  test("formulaire de chien avec « nouveau propriétaire » déplié et des erreurs", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/chiens/nouveau");
    await page.getByLabel("Propriétaire").selectOption("__new__");
    await page.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(page.getByLabel("Prénom")).toHaveAttribute("aria-invalid", "true");
    await expectNoA11yViolations(page, "chien en erreur");
  });

  test("mouvement de stock refusé", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/stock");
    await page.getByRole("link", { name: /^Croquettes adulte ·/ }).click();
    await page.getByLabel(/^Quantité \(/).fill("999");
    await page.getByRole("button", { name: "Enregistrer le mouvement" }).click();
    await expect(page.getByText(/Stock insuffisant/).first()).toBeVisible();
    await expectNoA11yViolations(page, "stock en erreur");
  });

  test("fiche de réservation : demande de confirmation d'annulation dépliée", async ({ page }) => {
    await login(page, ADMIN);
    const { bookings } = (await (await page.request.get("/api/reservations?status=CONFIRMED")).json()) as { bookings: { id: string }[] };
    await page.goto(`/reservations/${bookings[0]!.id}`);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Annuler définitivement cette réservation ?")).toBeVisible();
    await expectNoA11yViolations(page, "annulation à confirmer");
  });

  test("facture : panneau « Ajouter une ligne » ouvert, avec une erreur", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/facturation");
    await page.getByRole("table", { name: "Liste des factures" }).getByRole("link", { name: "Brouillon" }).click();
    await page.getByText("Ajouter une ligne (supplément, remise…)").click();
    await page.getByLabel("Libellé").fill("Test");
    await page.getByLabel("Prix unitaire (€)").fill("-1");
    await page.getByRole("button", { name: "Ajouter la ligne" }).click();
    await expect(page.getByLabel("Prix unitaire (€)")).toHaveAttribute("aria-invalid", "true");
    await expectNoA11yViolations(page, "facture, ligne en erreur");
  });

  test("tableau de bord après une action rapide", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: /Enregistrer l'arrivée d'Oslo/ }).click();
    await expect(page.getByRole("row", { name: /Oslo/ }).getByText("Fait")).toBeVisible();
    await expectNoA11yViolations(page, "tableau de bord après arrivée");
  });
});

test.describe("axe : zoom et texte agrandi", () => {
  test("écran étroit (320 px, l'équivalent d'un zoom à 400 %) : toujours sans violation", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await login(page, ADMIN);
    for (const path of ["/", "/reservations", "/stock"]) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      await expectNoA11yViolations(page, `${path} à 320 px`);
    }
  });
});
