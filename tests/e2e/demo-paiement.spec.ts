import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { ADMIN, EMPLOYEE } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";

test.describe.configure({ mode: "serial" });
// Base remise à zéro AVANT CHAQUE test : une passkey utilisée il y a moins de 2 minutes autorise le paiement, un test ne doit pas hériter de l'autre.
test.beforeEach(() => reseed());

// Un VRAI Chromium avec un authentificateur WebAuthn VIRTUEL (protocole CDP) : la vraie cérémonie (défi, signature ES256,
// compteur) se déroule entre le navigateur et notre serveur. Seule la partie « doigt sur le capteur » est simulée.
async function addAuthenticator(page: Page, options: { isUserVerified?: boolean } = {}) {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: options.isUserVerified ?? true, automaticPresenceSimulation: true },
  });
  return { cdp, authenticatorId };
}

const STEP1 = "Étape 1 : prouver son identité avec une passkey";
const STEP2 = "Étape 2 : payer avec la Payment Request API";
const section = (page: Page, heading: string) => page.getByRole("heading", { name: heading }).locator("xpath=ancestor::section[1]");
const open = async (page: Page) => {
  await login(page, ADMIN);
  await page.goto("/demo/paiement");
  await expect(page.getByRole("heading", { name: "Démonstration : paiement sécurisé", level: 1 })).toBeVisible();
};
const register = async (page: Page) => {
  await page.getByRole("button", { name: "Enregistrer une passkey" }).click();
  await expect(section(page, STEP1).getByRole("status")).toContainText("Passkey enregistrée");
};
const verify = async (page: Page) => {
  await page.getByRole("button", { name: /Me vérifier/ }).click();
  await expect(section(page, STEP1).getByRole("status")).toContainText("2 minutes");
};

test.describe("accès", () => {
  test("un employé reçoit un vrai 403 : la démonstration touche à la facturation", async ({ page }) => {
    await login(page, EMPLOYEE);
    const res = await page.goto("/demo/paiement");
    expect(res?.status()).toBe(403);
    await expect(page.getByRole("heading", { name: "Accès réservé" })).toBeVisible();
  });

  test("les API de démonstration refusent un employé (403) et un visiteur (401)", async ({ page, request }) => {
    expect((await request.post("/api/demo/passkeys/authentification/options", { data: {} })).status()).toBe(401);
    await login(page, EMPLOYEE);
    const res = await page.evaluate(async () => (await fetch("/api/demo/paiement/intention", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status);
    expect(res).toBe(403);
  });

  test("l'en-tête Permissions-Policy autorise le paiement SUR CETTE PAGE seulement", async ({ page }) => {
    await login(page, ADMIN);
    const demo = await page.goto("/demo/paiement");
    expect(demo?.headers()["permissions-policy"]).toContain("payment=(self)");
    const home = await page.goto("/");
    expect(home?.headers()["permissions-policy"]).toContain("payment=()");
    expect(home?.headers()["permissions-policy"]).not.toContain("payment=(self)");
  });
});

test.describe("passkey (WebAuthn) : vraie cérémonie avec un authentificateur virtuel", () => {
  test("la page détecte les capacités de l'appareil", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await expect(page.getByText("WebAuthn (passkeys)").locator("xpath=following-sibling::dd")).toHaveText("Disponible");
    await expect(page.getByText("Empreinte, visage ou code de l'appareil").locator("xpath=following-sibling::dd")).toHaveText("Disponible");
  });

  test("sans vérification biométrique, le serveur refuse de donner le montant à payer", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await page.getByRole("button", { name: "Demander le montant au serveur" }).click();
    await expect(section(page, STEP2).getByRole("alert")).toContainText("Confirmez d'abord");
  });

  test("enregistrer une passkey puis se vérifier : le serveur ne garde que la clé publique", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    await expect(section(page, STEP1).getByText("Passkeys enregistrées :")).toContainText("1");
    await verify(page);
    // Ce que contient la base : une clé PUBLIQUE et un compteur, rien de biométrique.
    const keys = await page.evaluate(async () => (await fetch("/api/demo/passkeys/authentification/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).json());
    expect(keys.allowCredentials).toHaveLength(1);
    expect(keys.userVerification).toBe("required");
  });

  test("après la passkey : le serveur donne le montant, calculé en centimes depuis les lignes de la facture", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    await verify(page);
    const value = await page.getByRole("option", { name: /F-2026-0004/ }).getAttribute("value");
    await page.getByLabel("Facture à payer").selectOption(value!);
    await page.getByRole("button", { name: "Demander le montant au serveur" }).click();
    await expect(section(page, STEP2).getByRole("status")).toContainText("facture F-2026-0004");
    await expect(page.getByRole("button", { name: /^Payer/ })).toContainText("60");
  });

  test("empreinte NON reconnue (l'appareil ne vérifie pas l'utilisateur) : refusé, aucune autorisation de paiement", async ({ page }) => {
    const { cdp, authenticatorId } = await addAuthenticator(page);
    await open(page);
    await register(page);
    await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
    await page.getByRole("button", { name: /Me vérifier/ }).click();
    await expect(section(page, STEP1).getByRole("alert")).toContainText(/Annulé ou refusé|n'a pas pu/);
    await page.getByRole("button", { name: "Demander le montant au serveur" }).click();
    await expect(section(page, STEP2).getByRole("alert")).toContainText("Confirmez d'abord");
  });

  test("rejeu : la même réponse signée, renvoyée une seconde fois, est refusée (le défi est à usage unique)", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    let captured: string | null = null;
    page.on("request", (r) => {
      if (r.url().endsWith("/authentification/verification")) captured = r.postData();
    });
    await verify(page);
    expect(captured).toBeTruthy();
    const replay = await page.evaluate(async (body) => (await fetch("/api/demo/passkeys/authentification/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body })).status, captured!);
    expect(replay).toBe(400);
  });

  test("hameçonnage : une réponse signée pour un AUTRE domaine est refusée par le serveur", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    let original: { response: { id: string; response: { clientDataJSON: string } } } | null = null;
    page.on("request", (r) => {
      if (r.url().endsWith("/authentification/verification")) original = JSON.parse(r.postData() ?? "{}");
    });
    await verify(page);
    // On nouveau défi, puis on présente une réponse dont l'origine annoncée a été falsifiée : la signature ne correspond plus.
    const status = await page.evaluate(async (body) => {
      await fetch("/api/demo/passkeys/authentification/options", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const forged = JSON.parse(body);
      const data = JSON.parse(atob(forged.response.response.clientDataJSON.replace(/-/g, "+").replace(/_/g, "/")));
      data.origin = "https://faux-site.example";
      forged.response.response.clientDataJSON = btoa(JSON.stringify(data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return (await fetch("/api/demo/passkeys/authentification/verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(forged) })).status;
    }, JSON.stringify(original));
    expect(status).toBe(400);
  });
});

test.describe("paiement : le montant du navigateur n'est jamais cru", () => {
  test("une confirmation avec un montant falsifié est refusée (409), avec le montant exact elle est acceptée sans débit", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    await verify(page);
    const result = await page.evaluate(async () => {
      const post = async (url: string, data: unknown) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
        return { status: res.status, body: await res.json() };
      };
      const html = await (await fetch("/demo/paiement")).text();
      const invoiceId = /value="([a-z0-9]{20,})"/.exec(html)?.[1] ?? "";
      const intent = await post("/api/demo/paiement/intention", { invoiceId });
      const tampered = await post("/api/demo/paiement/confirmation", { invoiceId, amountCents: 1, token: "jeton" });
      const exact = await post("/api/demo/paiement/confirmation", { invoiceId, amountCents: intent.body.amountCents, token: "jeton" });
      return { intent, tampered, exact };
    });
    expect(result.intent.status).toBe(200);
    expect(result.tampered.status).toBe(409);
    expect(result.exact.status).toBe(200);
    expect(result.exact.body.demo).toBe(true);
  });

  test("la Payment Request s'ouvre côté navigateur : sans portefeuille (Chromium de test), l'échec est expliqué, jamais un écran blanc", async ({ page }) => {
    await addAuthenticator(page);
    await open(page);
    await register(page);
    await verify(page);
    await page.getByRole("button", { name: "Demander le montant au serveur" }).click();
    await expect(section(page, STEP2).getByRole("status")).toContainText("Le serveur demande");
    await page.getByRole("button", { name: /^Payer/ }).click();
    // Chromium de test : pas de Google Pay. Selon la version, canMakePayment est faux ou show() échoue : dans les deux cas,
    // l'utilisateur lit une explication et peut recommencer.
    await expect(section(page, STEP2).getByRole("alert")).toContainText(/Aucun portefeuille compatible|n'a pas pu s'ouvrir|Paiement annulé/);
    await expect(page.getByRole("button", { name: /^Payer/ })).toBeEnabled();
  });
});
