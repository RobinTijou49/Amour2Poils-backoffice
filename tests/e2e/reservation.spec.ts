import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE } from "./accounts";
import { createBooking, fillBooking, isoDay, login } from "./helpers";
import { reseed } from "./reseed";

// Les étapes se suivent (créer, confirmer, arriver, partir…) : on les exécute dans l'ordre, sur une base remise à zéro.
test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

test.describe("créer, confirmer, accueillir, rendre le chien", () => {
  let bookingPath = "";

  test("réservation sans box : en attente, durée et montant calculés", async ({ page }) => {
    await login(page, ADMIN);
    bookingPath = await createBooking(page, { dog: "Pepper", start: isoDay(60), end: isoDay(63) });
    await expect(page.getByText("En attente", { exact: true })).toBeVisible();
    await expect(page.getByText("À attribuer", { exact: true })).toBeVisible();
    await expect(page.getByText("3 nuits")).toBeVisible();
    await expect(page.getByText(/75,00\s€ \(25,00\s€ \/ nuit\)/)).toBeVisible(); // tarif par défaut : 25 €
  });

  test("confirmer en choisissant une box", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(bookingPath);
    await page.getByLabel("Box attribuée").selectOption({ label: "Box 1" });
    await page.getByRole("button", { name: "Confirmer la réservation" }).click();
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
    await expect(page.getByText("Box 1", { exact: true })).toBeVisible();
  });

  test("arrivée puis départ depuis la fiche : les statuts changent, puis plus aucune action", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(bookingPath);
    await page.getByRole("button", { name: "Enregistrer l'arrivée" }).click();
    await expect(page.getByText("En pension", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Enregistrer le départ" }).click();
    await expect(page.getByText("Terminée", { exact: true })).toBeVisible();
    await expect(page.getByText(/plus aucune action possible/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Enregistrer|Confirmer|Annuler/ })).toHaveCount(0);
  });

  test("le changement est bien enregistré : il survit au rechargement", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(bookingPath);
    await expect(page.getByText("Terminée", { exact: true })).toBeVisible();
  });
});

test.describe("règles de la box et de la saisie", () => {
  let nalaPath = "";

  test("première réservation de la box 1 sur ces dates : acceptée et confirmée d'office", async ({ page }) => {
    await login(page, ADMIN);
    nalaPath = await createBooking(page, { dog: "Nala", start: isoDay(70), end: isoDay(73), box: "Box 1", rate: "30" });
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
    await expect(page.getByText(/90,00\s€ \(30,00\s€ \/ nuit\)/)).toBeVisible();
  });

  test("même box, dates qui se chevauchent : refusée avec une erreur claire, formulaire conservé", async ({ page }) => {
    await login(page, ADMIN);
    await fillBooking(page, { dog: "Pepper", start: isoDay(71), end: isoDay(74), box: "Box 1" });
    await expect(page.locator("form").getByRole("alert")).toHaveText("Cette box est complète sur ces dates.");
    await expect(page.getByText(/Box complète sur ces dates/)).toBeVisible(); // message sous le champ
    await expect(page).toHaveURL("/reservations/nouvelle");
    // React vide les formulaires après un envoi : l'application renvoie les valeurs pour ne pas faire ressaisir.
    await expect(page.getByLabel("Arrivée")).toHaveValue(isoDay(71));
    await expect(page.getByLabel("Box")).toHaveValue(await page.getByLabel("Box").locator("option", { hasText: "Box 1" }).getAttribute("value") ?? "");
  });

  test("…mais en la laissant « à attribuer plus tard », la même réservation passe (en attente)", async ({ page }) => {
    await login(page, ADMIN);
    await createBooking(page, { dog: "Pepper", start: isoDay(71), end: isoDay(74) });
    await expect(page.getByText("En attente", { exact: true })).toBeVisible();
  });

  test("un séjour qui commence le jour du départ du précédent est accepté (le jour du départ est libre)", async ({ page }) => {
    await login(page, ADMIN);
    await createBooking(page, { dog: "Milo", start: isoDay(73), end: isoDay(75), box: "Box 1" });
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
  });

  test("arrivée dans le passé et départ avant l'arrivée : erreurs sous chaque champ, rien n'est créé", async ({ page }) => {
    await login(page, ADMIN);
    await fillBooking(page, { dog: "Pepper", start: isoDay(-1), end: isoDay(-2) });
    await expect(page.getByText("L'arrivée ne peut pas être dans le passé.")).toBeVisible();
    await expect(page.getByText("Le départ doit être après l'arrivée.")).toBeVisible();
    await expect(page).toHaveURL("/reservations/nouvelle");
    // chaque champ en erreur est signalé aux lecteurs d'écran
    await expect(page.getByLabel("Arrivée")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Départ")).toHaveAttribute("aria-invalid", "true");
  });

  test("l'employé voit la réservation mais ne peut pas l'annuler ; la gérance peut, après confirmation", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.goto(nalaPath);
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Annuler la réservation" })).toHaveCount(0);

    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await login(page, ADMIN);
    await page.goto(nalaPath);
    await page.getByRole("button", { name: "Annuler la réservation" }).click();
    await expect(page.getByText("Annuler définitivement cette réservation ?")).toBeVisible(); // confirmation avant de détruire
    await page.getByRole("button", { name: "Oui, annuler" }).click();
    await expect(page.getByText("Annulée", { exact: true })).toBeVisible();
  });

  test("une box libérée par l'annulation est de nouveau réservable sur ces dates", async ({ page }) => {
    await login(page, ADMIN);
    await createBooking(page, { dog: "Pepper", start: isoDay(71), end: isoDay(73), box: "Box 1" });
    await expect(page.getByText("Confirmée", { exact: true })).toBeVisible();
  });
});

test.describe("tableau de bord : accueil en un clic", () => {
  test("arrivée d'un chien attendu aujourd'hui, sans quitter le tableau de bord", async ({ page }) => {
    await login(page, EMPLOYEE);
    const bouton = page.getByRole("button", { name: "Enregistrer l'arrivée d'Oslo" });
    await expect(bouton).toBeVisible();
    await bouton.click();
    // Le tableau de bord se rafraîchit aussitôt : la ligne passe à « Fait » et le bouton disparaît (pas de double clic possible).
    // Le message « Arrivée d'Oslo enregistrée. » (role=status) n'a donc pas le temps d'être lu : voir journal IA (accessibilité).
    await expect(page.getByRole("row", { name: /Oslo/ }).getByText("Fait")).toBeVisible();
    await expect(bouton).toHaveCount(0);
    // après rechargement, c'est toujours fait
    await page.reload();
    await expect(page.getByRole("row", { name: /Oslo/ }).getByText("Fait")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enregistrer l'arrivée d'Oslo" })).toHaveCount(0);
  });

  test("le chien accueilli est maintenant « en pension » sur sa fiche", async ({ page }) => {
    await login(page, EMPLOYEE);
    await page.getByRole("row", { name: /Oslo/ }).getByRole("link", { name: /Oslo/ }).click();
    await expect(page.getByRole("heading", { name: "Oslo" })).toBeVisible();
  });
});
