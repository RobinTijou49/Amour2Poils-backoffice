import { expect, test } from "@playwright/test";
import { ADMIN, EMPLOYEE } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";

test.beforeAll(() => reseed());

test.describe("accès et connexion", () => {
  test("une page protégée renvoie vers la connexion quand on n'est pas connecté", async ({ page }) => {
    await page.goto("/reservations");
    await expect(page).toHaveURL("/connexion");
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  });

  test("la page de connexion est utilisable au clavier : champs étiquetés, bouton nommé", async ({ page }) => {
    await page.goto("/connexion");
    await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
    await expect(page.getByLabel("Mot de passe")).toHaveAttribute("type", "password");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeEnabled();
  });

  test("mauvais mot de passe : message annoncé, on reste sur la page, l'adresse est conservée", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill(ADMIN.email);
    await page.getByLabel("Mot de passe").fill("pas-le-bon-mot-de-passe");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
    await expect(page).toHaveURL("/connexion");
    await expect(page.getByLabel("Adresse e-mail")).toHaveValue(ADMIN.email);
    await expect(page.getByLabel("Mot de passe")).toHaveValue("");
  });

  test("compte inconnu : exactement le même message (on ne révèle pas si l'adresse existe)", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail").fill("personne@e2e.test");
    await page.getByLabel("Mot de passe").fill("n'importe-quoi-123");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
  });

  test("bon mot de passe : tableau de bord, avec le nom et le rôle de la personne connectée", async ({ page }) => {
    await login(page, ADMIN);
    // Dans la barre latérale (le nom peut aussi apparaître ailleurs dans la page).
    const barre = page.locator("aside");
    await expect(barre.getByText(ADMIN.name)).toBeVisible();
    await expect(barre.getByText("Gérant·e")).toBeVisible();
    await expect(page.getByRole("link", { name: "Facturation", exact: true })).toBeVisible();
  });

  test("la session survit au rechargement de la page", async ({ page }) => {
    await login(page, ADMIN);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
  });

  test("déconnexion : retour à la connexion, et les pages protégées sont de nouveau fermées", async ({ page }) => {
    await login(page, ADMIN);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page).toHaveURL("/connexion");
    await page.goto("/stock");
    await expect(page).toHaveURL("/connexion");
  });

  test("le cookie de session est inaccessible au JavaScript de la page (HttpOnly) et marqué SameSite", async ({ page, context }) => {
    await login(page, ADMIN);
    const cookie = (await context.cookies()).find((c) => c.name === "a2p_session");
    expect(cookie).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    expect(await page.evaluate(() => document.cookie)).not.toContain("a2p_session");
  });

  test("après 5 échecs sur une adresse, même le bon mot de passe est refusé ; les autres comptes ne sont pas touchés", async ({ page }) => {
    const intrus = "intrus@e2e.test";
    await page.goto("/connexion");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Adresse e-mail").fill(intrus);
      await page.getByLabel("Mot de passe").fill(`essai-${i}`);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.locator("form").getByRole("alert")).toHaveText("Adresse e-mail ou mot de passe incorrect.");
      // React 19 vide les champs APRÈS l'envoi : on attend ce nettoyage avant de ressaisir, sinon il effacerait notre saisie.
      await expect(page.getByLabel("Mot de passe")).toHaveValue("");
    }
    await page.getByLabel("Adresse e-mail").fill(intrus);
    await page.getByLabel("Mot de passe").fill("encore-un-essai");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("Trop de tentatives. Réessayez dans 15 minutes.");
    await login(page, ADMIN); // un autre compte se connecte normalement
  });
});

test.describe("rôles : l'employé n'a pas accès à la gérance", () => {
  test("pas de lien « Facturation » dans le menu de l'employé", async ({ page }) => {
    await login(page, EMPLOYEE);
    await expect(page.locator("aside").getByText("Employé·e")).toBeVisible();
    await expect(page.getByRole("link", { name: "Facturation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Stock", exact: true })).toBeVisible();
  });

  test("taper l'adresse de la facturation à la main : vrai 403 et écran « Accès réservé »", async ({ page }) => {
    await login(page, EMPLOYEE);
    const response = await page.goto("/facturation");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
    await page.getByRole("link", { name: "Retour au tableau de bord" }).click();
    await expect(page).toHaveURL("/");
  });

  test("idem pour la création d'un produit", async ({ page }) => {
    await login(page, EMPLOYEE);
    const response = await page.goto("/stock/nouveau");
    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  });

  test("la gérance, elle, y accède", async ({ page }) => {
    await login(page, ADMIN);
    const response = await page.goto("/facturation");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Facturation" })).toBeVisible();
  });
});
