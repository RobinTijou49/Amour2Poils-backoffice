import { expect, test, type Route } from "@playwright/test";
import { ADMIN } from "./accounts";
import { login } from "./helpers";
import { reseed } from "./reseed";

test.describe.configure({ mode: "serial" });
test.beforeAll(() => reseed());

// Ce que seul un VRAI navigateur peut prouver : qu'il applique réellement la CSP et les en-têtes.
const XSS = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;

declare global {
  interface Window {
    __xss?: number;
    __violations?: string[];
  }
}

test.describe("en-têtes de sécurité", () => {
  test("chaque page porte une CSP stricte avec un nonce, sans unsafe-inline ni unsafe-eval pour les scripts", async ({ request }) => {
    const res = await request.get("/connexion");
    const csp = res.headers()["content-security-policy"] ?? "";
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
    for (const directive of ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'", "default-src 'self'"]) expect(csp).toContain(directive);
  });

  test("le nonce change à chaque requête (un nonce réutilisable ne protège rien)", async ({ request }) => {
    const nonce = async () => ((await request.get("/connexion")).headers()["content-security-policy"] ?? "").match(/'nonce-([^']+)'/)?.[1];
    const [a, b, c] = [await nonce(), await nonce(), await nonce()];
    expect(new Set([a, b, c]).size).toBe(3);
  });

  test("les autres en-têtes de sécurité sont présents", async ({ request }) => {
    const h = (await request.get("/connexion")).headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
  });

  test("les routes d'API aussi (et jamais d'information sur le serveur)", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.headers()["x-content-type-options"]).toBe("nosniff");
    expect(res.headers()["x-powered-by"]).toBeUndefined();
  });

  test("tous les scripts de la page portent le nonce : la CSP stricte ne casse rien (page chargée sans violation)", async ({ page }) => {
    const violations: string[] = [];
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__violations!.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    page.on("console", (m) => m.type() === "error" && violations.push(m.text()));
    await login(page, ADMIN);
    for (const path of ["/", "/reservations", "/chiens", "/stock", "/facturation", "/seances", "/offline"]) {
      await page.goto(path);
      await expect(page.locator("main, h1").first()).toBeVisible();
      const sansNonce = await page.evaluate(() => [...document.scripts].filter((s) => !s.nonce && !s.src).length);
      expect(sansNonce, `scripts en ligne sans nonce sur ${path}`).toBe(0);
      expect(await page.evaluate(() => window.__violations), `violations CSP sur ${path}`).toEqual([]);
    }
    expect(violations.filter((v) => /Content Security Policy/i.test(v))).toEqual([]);
  });
});

test.describe("injection : ce que fait vraiment un navigateur", () => {
  test("un gestionnaire d'événement injecté dans la page est BLOQUÉ par la CSP", async ({ page }) => {
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__violations!.push(e.violatedDirective));
    });
    await login(page, ADMIN);
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html), XSS);
    await expect.poll(() => page.evaluate(() => window.__violations)).toContain("script-src-attr");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("un <script> en ligne glissé dans la réponse sans le nonce est BLOQUÉ ; avec le bon nonce (témoin), il s'exécute", async ({ page }) => {
    // Injection simulée côté réponse : ce qu'un attaquant obtiendrait avec une vraie faille XSS qui écrit du HTML dans la page.
    const injecter = (avecNonce: boolean) => async (route: Route) => {
      const reponse = await route.fetch();
      const nonce = (reponse.headers()["content-security-policy"] ?? "").match(/'nonce-([^']+)'/)?.[1];
      const balise = "<script" + (avecNonce ? ` nonce="${nonce}"` : "") + ">window.__xss = 99</script>";
      await route.fulfill({ response: reponse, body: (await reponse.text()).replace("</body>", balise + "</body>") });
    };
    await page.addInitScript(() => {
      window.__violations = [];
      document.addEventListener("securitypolicyviolation", (e) => window.__violations!.push(e.violatedDirective));
    });

    await page.route("**/connexion", injecter(false));
    await page.goto("/connexion");
    await expect.poll(() => page.evaluate(() => window.__violations)).toContain("script-src-elem");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();

    // témoin : le même script portant le nonce de la réponse s'exécute, donc le test mesure bien le rôle du nonce
    await page.unroute("**/connexion");
    await page.route("**/connexion", injecter(true));
    await page.goto("/connexion");
    await expect.poll(() => page.evaluate(() => window.__xss)).toBe(99);
  });

  test("une charge XSS saisie dans un formulaire est enregistrée telle quelle et affichée comme du TEXTE", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/chiens/nouveau");
    const proprietaire = page.getByLabel("Propriétaire");
    await proprietaire.selectOption({ index: 2 }); // un propriétaire existant (0 : invite, 1 : « Nouveau propriétaire »)
    await page.getByLabel("Nom", { exact: true }).fill(XSS);
    await page.getByLabel("Sexe").selectOption({ index: 1 });
    await page.getByLabel("Comportement (facultatif)").fill(`"><script>window.__xss=7</script>`);
    await page.getByRole("button", { name: "Créer la fiche" }).click();
    await expect(page).toHaveURL(/\/chiens\/[a-z0-9]{20,}$/);

    // la fiche montre le texte brut de la charge, et rien ne s'est exécuté
    await expect(page.getByRole("heading", { name: XSS })).toBeVisible();
    await expect(page.getByText(`"><script>window.__xss=7</script>`)).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('img[src="x"]').count()).toBe(0);

    // idem dans la liste des chiens et dans la recherche
    await page.goto("/chiens");
    await expect(page.getByText(XSS).first()).toBeVisible();
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });

  test("la même charge est restituée comme texte dans le formulaire de modification (valeur du champ, pas du HTML)", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/chiens");
    await page.getByRole("link", { name: new RegExp(XSS.slice(0, 20).replace(/[<>"=]/g, ".")) }).first().click();
    await page.getByRole("link", { name: /Modifier/ }).click();
    await expect(page.getByLabel("Nom", { exact: true })).toHaveValue(XSS);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  });
});

test.describe("cookies et API vus du navigateur", () => {
  test("une écriture d'API depuis une autre origine est refusée, même avec la session de la victime", async ({ page }) => {
    await login(page, ADMIN);
    // Le navigateur envoie le cookie de session ; l'en-tête Origin d'un autre site, lui, trahit l'attaque.
    const attaque = await page.request.post("/api/stock/inconnu/mouvements", {
      headers: { origin: "https://site-malveillant.example", "content-type": "application/json" },
      data: { type: "IN", quantity: 1 },
    });
    expect(attaque.status()).toBe(403);
    const sansJson = await page.request.post("/api/stock/inconnu/mouvements", { headers: { "content-type": "text/plain" }, data: "{}" });
    expect(sansJson.status()).toBe(415);
  });

  test("sans session, l'API répond 401 en JSON (jamais une redirection HTML)", async ({ request }) => {
    const res = await request.get("/api/stock", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"]).toContain("application/json");
  });
});
