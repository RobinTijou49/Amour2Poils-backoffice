import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE } from "./accounts";
import { createBooking, isoDay, login } from "./helpers";
import { reseed } from "./reseed";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

const year = new Date().getFullYear();

test.describe("du séjour à la facture payée", () => {
  let bookingPath = "";
  let invoicePath = "";
  let invoiceNumber = "";

  test("un séjour en attente ne se facture pas ; une fois confirmé, accueilli puis rendu, on crée la facture depuis sa fiche", async ({ page }) => {
    await login(page, ADMIN);
    // séjour de 2 nuits à 25 € (tarif par défaut) : créé sans box (en attente), puis le parcours complet
    bookingPath = await createBooking(page, { dog: "Milo", start: isoDay(80), end: isoDay(82) });
    await expect(page.getByText("En attente", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Créer la facture du séjour" })).toHaveCount(0);
    await page.getByLabel("Box attribuée").selectOption({ label: "Box 2" });
    await page.getByRole("button", { name: "Confirmer la réservation" }).click();
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer l'arrivée" }).click();
    await expect(page.getByText("En pension", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer le départ" }).click();
    await expect(page.getByText("Terminée", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Créer la facture du séjour" }).click();
    await expect(page).toHaveURL(/\/facturation\/[a-z0-9]{20,}$/);
    invoicePath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: "Brouillon de facture" })).toBeVisible();
  });

  test("le brouillon reprend le séjour : libellé, 2 nuits × 25 €, total 50 €, sans numéro définitif", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    const lignes = page.getByRole("table", { name: "Lignes de la facture" });
    await expect(lignes).toContainText("Pension Milo");
    await expect(lignes).toContainText("2 nuits");
    await expect(page.getByText(/Total : 50,00\s€/)).toBeVisible();
    await expect(page.getByText("Brouillon", { exact: true }).first()).toBeVisible();
  });

  test("un séjour déjà facturé ne se facture pas deux fois : le bouton laisse place à un lien vers sa facture", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(bookingPath);
    await expect(page.getByRole("button", { name: "Créer la facture du séjour" })).toHaveCount(0);
    await page.getByRole("link", { name: "Voir la facture du séjour" }).click();
    await expect(page).toHaveURL(invoicePath);
  });

  test("l'employé ne voit pas le bouton de facturation sur la fiche du séjour", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.goto(bookingPath);
    await expect(page.getByText("Terminée", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Voir la facture du séjour" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Créer la facture du séjour" })).toHaveCount(0);
  });

  test("on ajoute une ligne libre (prix en euros, total recalculé) puis on la supprime", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    await page.getByText("Ajouter une ligne (supplément, remise…)").click();
    await page.getByLabel("Libellé").fill("Bain et brossage");
    await page.getByLabel("Quantité", { exact: true }).fill("2");
    await page.getByLabel("Prix unitaire (€)").fill("19.99");
    await page.getByRole("button", { name: "Ajouter la ligne" }).click();
    await expect(page.getByRole("table", { name: "Lignes de la facture" })).toContainText("Bain et brossage");
    await expect(page.getByText(/Total : 89,98\s€/)).toBeVisible(); // 50 + 2 × 19,99
    await page.getByRole("button", { name: "Supprimer la ligne Bain et brossage" }).click();
    await expect(page.getByRole("table", { name: "Lignes de la facture" })).not.toContainText("Bain et brossage");
    await expect(page.getByText(/Total : 50,00\s€/)).toBeVisible();
  });

  test("une ligne incorrecte est refusée avec un message sous le champ", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    await page.getByText("Ajouter une ligne (supplément, remise…)").click();
    await page.getByLabel("Libellé").fill("Remise");
    await page.getByLabel("Prix unitaire (€)").fill("-5");
    await page.getByRole("button", { name: "Ajouter la ligne" }).click();
    await expect(page.getByText("Le prix ne peut pas être négatif.")).toBeVisible();
    await expect(page.getByLabel("Prix unitaire (€)")).toHaveAttribute("aria-invalid", "true");
  });

  test("valider et envoyer : numéro définitif F-AAAA-NNNN, la facture n'est plus modifiable", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    await page.getByRole("button", { name: "Valider et envoyer" }).click();
    const titre = page.getByRole("heading", { name: new RegExp(`^Facture F-${year}-\\d{4}$`) });
    await expect(titre).toBeVisible();
    invoiceNumber = ((await titre.textContent()) ?? "").replace("Facture ", "");
    await expect(page.getByText("Envoyée", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ajouter une ligne (supplément, remise…)")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Supprimer la ligne/ })).toHaveCount(0);
  });

  test("la facture apparaît dans la liste, avec son numéro, son montant et une échéance", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/facturation");
    const ligne = page.getByRole("table", { name: "Liste des factures" }).getByRole("row", { name: new RegExp(invoiceNumber) });
    await expect(ligne).toContainText("50,00");
    await expect(ligne).toContainText("Envoyée");
  });

  test("impression : en mode « imprimer », la barre latérale et les actions disparaissent, la facture reste", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    await expect(page.getByRole("button", { name: "Imprimer / PDF" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("aside")).toBeHidden();
    await expect(page.getByRole("button", { name: "Imprimer / PDF" })).toBeHidden();
    await expect(page.getByRole("table", { name: "Lignes de la facture" })).toBeVisible();
    await expect(page.getByText(/Total : 50,00\s€/)).toBeVisible();
  });

  test("marquer comme payée : statut « Payée », plus aucune action de statut", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(invoicePath);
    await page.getByRole("button", { name: "Marquer comme payée" }).click();
    await expect(page.getByText("Payée", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Marquer comme payée" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Annuler la facture" })).toHaveCount(0); // une facture payée est définitive
  });

  test("l'employé ne peut ni voir ni ouvrir cette facture", async ({ page }) => {
    await login(page, EMPLOYEE);
    const response = await page.goto(invoicePath);
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
    await expect(page.getByText(invoiceNumber)).toHaveCount(0);
  });
});

test.describe("numérotation continue", () => {
  test("deux factures envoyées à la suite reçoivent des numéros consécutifs", async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, ADMIN);
    const numbers: number[] = [];
    for (const [dog, start, box] of [["Pepper", 90, "Box 3"], ["Nala", 95, "Box 4"]] as const) {
      await createBooking(page, { dog, start: isoDay(start), end: isoDay(start + 1), box });
      await page.getByRole("button", { name: "Enregistrer l'arrivée" }).click();
      await expect(page.getByText("En pension", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Enregistrer le départ" }).click();
      await expect(page.getByText("Terminée", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Créer la facture du séjour" }).click();
      await page.getByRole("button", { name: "Valider et envoyer" }).click();
      const titre = await page.getByRole("heading", { name: new RegExp(`^Facture F-${year}-\\d{4}$`) }).textContent();
      numbers.push(Number((titre ?? "").slice(-4)));
    }
    expect(numbers[1]).toBe((numbers[0] ?? 0) + 1);
  });
});
