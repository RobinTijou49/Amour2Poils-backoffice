import { beforeEach, describe, expect, test } from "bun:test";
import { POST as registerOptions } from "@/app/api/demo/passkeys/inscription/options/route";
import { POST as registerVerify } from "@/app/api/demo/passkeys/inscription/verification/route";
import { POST as authOptions } from "@/app/api/demo/passkeys/authentification/options/route";
import { POST as authVerify } from "@/app/api/demo/passkeys/authentification/verification/route";
import { POST as intent } from "@/app/api/demo/paiement/intention/route";
import { POST as confirm } from "@/app/api/demo/paiement/confirmation/route";
import { CHALLENGE_TTL_MS, hasRecentPasskeyAuth, PAYMENT_AUTH_WINDOW_MS, relyingParty, saveChallenge, takeChallenge } from "@/lib/webauthn";
import { apiRequest, makeOwner, prisma, resetDb, signIn } from "./helpers";

// La CRYPTOGRAPHIE WebAuthn (signature, compteur, origine) est celle de @simplewebauthn/server : elle est exercée de bout
// en bout dans un vrai Chromium par tests/e2e/demo-paiement.spec.ts (authentificateur virtuel). Ici : tout ce qui est NOTRE
// code autour : rôles, défis à usage unique, fenêtre de 2 minutes, montant décidé par le serveur.

beforeEach(resetDb);

async function makePasskey(userId: string, lastUsedAt: Date | null = null) {
  return prisma.passkey.create({ data: { credentialId: `cred-${Math.random().toString(36).slice(2)}`, publicKey: Buffer.from([1, 2, 3]), userId, lastUsedAt } });
}

async function makeSentInvoice(lines: { quantity: number; unitPriceCents: number }[] = [{ quantity: 3, unitPriceCents: 2200 }, { quantity: 1, unitPriceCents: 1550 }]) {
  const owner = await makeOwner();
  return prisma.invoice.create({
    data: { number: `F-2026-${Math.floor(Math.random() * 9000 + 1000)}`, status: "SENT", ownerId: owner.id, lines: { create: lines.map((l) => ({ label: "Pension", ...l })) } },
  });
}

describe("les routes de la démonstration sont réservées à la gérance", () => {
  const routes = { registerOptions, registerVerify, authOptions, authVerify, intent, confirm };
  for (const [name, handler] of Object.entries(routes)) {
    test(`${name} : sans session 401, employé 403`, async () => {
      expect((await handler(apiRequest("POST", "/api/demo/x", {}))).status).toBe(401);
      await signIn("EMPLOYEE");
      expect((await handler(apiRequest("POST", "/api/demo/x", {}))).status).toBe(403);
    });

    test(`${name} : refuse une requête d'un autre site (403)`, async () => {
      await signIn("ADMIN");
      expect((await handler(apiRequest("POST", "/api/demo/x", {}, { origin: "https://pirate.example", "sec-fetch-site": "cross-site" }))).status).toBe(403);
    });
  }
});

describe("défis WebAuthn : un seul usage, durée limitée", () => {
  test("un défi se consomme : la deuxième lecture ne donne rien (anti-rejeu)", async () => {
    const user = await signIn("ADMIN");
    await saveChallenge(user.id, "defi-1", "authenticate");
    expect(await takeChallenge(user.id, "authenticate")).toBe("defi-1");
    expect(await takeChallenge(user.id, "authenticate")).toBeNull();
  });

  test("un défi d'inscription ne sert pas pour une authentification (et inversement)", async () => {
    const user = await signIn("ADMIN");
    await saveChallenge(user.id, "defi-2", "register");
    expect(await takeChallenge(user.id, "authenticate")).toBeNull();
  });

  test("un défi expiré est refusé", async () => {
    const user = await signIn("ADMIN");
    await saveChallenge(user.id, "defi-3", "authenticate");
    await prisma.passkeyChallenge.update({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await takeChallenge(user.id, "authenticate")).toBeNull();
    expect(CHALLENGE_TTL_MS).toBe(5 * 60_000);
  });

  test("deux lectures simultanées : une seule obtient le défi", async () => {
    const user = await signIn("ADMIN");
    await saveChallenge(user.id, "defi-4", "authenticate");
    const [a, b] = await Promise.all([takeChallenge(user.id, "authenticate"), takeChallenge(user.id, "authenticate")]);
    expect([a, b].filter((c) => c === "defi-4")).toHaveLength(1);
  });

  test("un nouveau défi remplace l'ancien (un seul en attente par utilisateur)", async () => {
    const user = await signIn("ADMIN");
    await saveChallenge(user.id, "ancien", "authenticate");
    await saveChallenge(user.id, "nouveau", "authenticate");
    expect(await prisma.passkeyChallenge.count()).toBe(1);
    expect(await takeChallenge(user.id, "authenticate")).toBe("nouveau");
  });
});

describe("options d'inscription et d'authentification", () => {
  test("l'inscription propose un défi lié au domaine et le mémorise", async () => {
    const user = await signIn("ADMIN");
    const res = await registerOptions(apiRequest("POST", "/api/demo/passkeys/inscription/options", {}, { host: "amour2poils.duckdns.org" }));
    expect(res.status).toBe(200);
    const options = (await res.json()) as { challenge: string; rp: { id: string }; authenticatorSelection: { userVerification: string } };
    expect(options.rp.id).toBe("amour2poils.duckdns.org");
    // « required » : l'appareil doit vérifier la personne (empreinte, visage, code), pas seulement sa présence.
    expect(options.authenticatorSelection.userVerification).toBe("required");
    expect((await prisma.passkeyChallenge.findUniqueOrThrow({ where: { userId: user.id } })).challenge).toBe(options.challenge);
  });

  test("l'inscription exclut les clés déjà enregistrées (pas de doublon sur le même appareil)", async () => {
    const user = await signIn("ADMIN");
    const existing = await makePasskey(user.id);
    const options = (await (await registerOptions(apiRequest("POST", "/api/demo/passkeys/inscription/options", {}))).json()) as { excludeCredentials: { id: string }[] };
    expect(options.excludeCredentials.map((c) => c.id)).toEqual([existing.credentialId]);
  });

  test("l'authentification sans aucune passkey : 409 explicite", async () => {
    await signIn("ADMIN");
    const res = await authOptions(apiRequest("POST", "/api/demo/passkeys/authentification/options", {}));
    expect(res.status).toBe(409);
  });

  test("l'authentification ne propose QUE les passkeys du compte connecté", async () => {
    const admin = await signIn("ADMIN");
    const mine = await makePasskey(admin.id);
    const other = await prisma.user.create({ data: { email: "autre@test.local", name: "Autre", role: "ADMIN", passwordHash: "x" } });
    await makePasskey(other.id);
    const options = (await (await authOptions(apiRequest("POST", "/api/demo/passkeys/authentification/options", {}))).json()) as { allowCredentials: { id: string }[] };
    expect(options.allowCredentials.map((c) => c.id)).toEqual([mine.credentialId]);
  });

  test("vérification d'authentification : une passkey d'un autre compte est refusée avant même de regarder la signature", async () => {
    await signIn("ADMIN");
    const other = await prisma.user.create({ data: { email: "autre2@test.local", name: "Autre", role: "ADMIN", passwordHash: "x" } });
    const foreign = await makePasskey(other.id);
    const res = await authVerify(apiRequest("POST", "/api/demo/passkeys/authentification/verification", { response: { id: foreign.credentialId, type: "public-key" } }));
    expect(res.status).toBe(400);
    // Le MESSAGE compte : sans lui, un défi manquant donnerait aussi 400 et le test ne prouverait pas le contrôle du propriétaire.
    expect(((await res.json()) as { error: string }).error).toBe("Passkey inconnue pour ce compte.");
    expect(await prisma.passkey.findUniqueOrThrow({ where: { id: foreign.id } })).toMatchObject({ lastUsedAt: null, counter: 0 });
  });

  test("vérification avec un défi inexistant : refusée, sans valider quoi que ce soit", async () => {
    const admin = await signIn("ADMIN");
    const key = await makePasskey(admin.id);
    const res = await authVerify(apiRequest("POST", "/api/demo/passkeys/authentification/verification", { response: { id: key.credentialId, type: "public-key" } }));
    expect(res.status).toBe(400);
    expect((await prisma.passkey.findUniqueOrThrow({ where: { id: key.id } })).lastUsedAt).toBeNull();
  });

  test("une réponse mal formée est rejetée (422) et n'ouvre aucune autorisation", async () => {
    await signIn("ADMIN");
    expect((await authVerify(apiRequest("POST", "/api/demo/passkeys/authentification/verification", { response: "n'importe quoi" }))).status).toBe(422);
    expect((await registerVerify(apiRequest("POST", "/api/demo/passkeys/inscription/verification", {}))).status).toBe(422);
  });

  test("une réponse d'inscription forgée (défi valide, signature bidon) ne crée aucune passkey", async () => {
    const admin = await signIn("ADMIN");
    await saveChallenge(admin.id, "defi", "register");
    const forged = { id: "abc", rawId: "abc", type: "public-key", response: { clientDataJSON: "e30", attestationObject: "e30" }, clientExtensionResults: {} };
    expect((await registerVerify(apiRequest("POST", "/api/demo/passkeys/inscription/verification", { response: forged }))).status).toBe(400);
    expect(await prisma.passkey.count()).toBe(0);
  });
});

describe("relyingParty : domaine et origine tels que le navigateur les voit", () => {
  test("derrière un proxy : X-Forwarded-Host et X-Forwarded-Proto", () => {
    const req = new Request("http://app:3000/api", { headers: { "x-forwarded-host": "amour2poils.duckdns.org", "x-forwarded-proto": "https" } });
    expect(relyingParty(req)).toEqual({ rpID: "amour2poils.duckdns.org", origin: "https://amour2poils.duckdns.org" });
  });

  test("le Caddy intérieur annonce « http » alors que le visiteur est en HTTPS : l'origine attendue reste https (bug de production)", () => {
    const req = new Request("http://app:3000/api", { headers: { "x-forwarded-host": "amour2poils.duckdns.org", "x-forwarded-proto": "http" } });
    expect(relyingParty(req)).toEqual({ rpID: "amour2poils.duckdns.org", origin: "https://amour2poils.duckdns.org" });
  });

  test("en local : http et le port dans l'origine, pas dans le domaine", () => {
    const req = new Request("http://localhost:3300/api", { headers: { host: "localhost:3300" } });
    expect(relyingParty(req)).toEqual({ rpID: "localhost", origin: "http://localhost:3300" });
  });

  test("plusieurs proxys : le premier hôte est celui du navigateur", () => {
    const req = new Request("http://app/api", { headers: { "x-forwarded-host": "site.example, interne", "x-forwarded-proto": "https, http" } });
    expect(relyingParty(req)).toEqual({ rpID: "site.example", origin: "https://site.example" });
  });
});

describe("fenêtre d'autorisation après une passkey", () => {
  test("récente : autorisée ; trop ancienne ou jamais utilisée : non", async () => {
    const user = await signIn("ADMIN");
    const now = Date.now();
    const key = await makePasskey(user.id, new Date(now - 30_000));
    expect(await hasRecentPasskeyAuth(user.id, now)).toBe(true);
    await prisma.passkey.update({ where: { id: key.id }, data: { lastUsedAt: new Date(now - PAYMENT_AUTH_WINDOW_MS - 1000) } });
    expect(await hasRecentPasskeyAuth(user.id, now)).toBe(false);
    await prisma.passkey.update({ where: { id: key.id }, data: { lastUsedAt: null } });
    expect(await hasRecentPasskeyAuth(user.id, now)).toBe(false);
  });

  test("la passkey d'un AUTRE utilisateur ne compte pas", async () => {
    const admin = await signIn("ADMIN");
    const other = await prisma.user.create({ data: { email: "autre3@test.local", name: "Autre", role: "ADMIN", passwordHash: "x" } });
    await makePasskey(other.id, new Date());
    expect(await hasRecentPasskeyAuth(admin.id)).toBe(false);
  });
});

describe("POST /api/demo/paiement/intention : le serveur décide du montant", () => {
  test("sans vérification biométrique récente : 403, même pour une facture valide", async () => {
    await signIn("ADMIN");
    const invoice = await makeSentInvoice();
    const res = await intent(apiRequest("POST", "/api/demo/paiement/intention", { invoiceId: invoice.id }));
    expect(res.status).toBe(403);
  });

  test("après une passkey récente : montant en centimes calculé depuis les lignes (3 × 22,00 + 15,50 = 8150)", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    const invoice = await makeSentInvoice();
    const res = await intent(apiRequest("POST", "/api/demo/paiement/intention", { invoiceId: invoice.id }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invoiceId: invoice.id, number: invoice.number, amountCents: 8150, currency: "EUR" });
  });

  test("seule une facture « envoyée » se paie : brouillon, payée et annulée donnent 409", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    for (const status of ["DRAFT", "PAID", "CANCELLED"] as const) {
      const invoice = await makeSentInvoice();
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status } });
      expect((await intent(apiRequest("POST", "/api/demo/paiement/intention", { invoiceId: invoice.id }))).status).toBe(409);
    }
  });

  test("facture inconnue : 409 ; identifiant absent : 422", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    expect((await intent(apiRequest("POST", "/api/demo/paiement/intention", { invoiceId: "inconnue" }))).status).toBe(409);
    expect((await intent(apiRequest("POST", "/api/demo/paiement/intention", {}))).status).toBe(422);
  });
});

describe("POST /api/demo/paiement/confirmation : le montant du navigateur n'est jamais cru", () => {
  const confirmBody = (invoiceId: string, amountCents: number) => ({ invoiceId, amountCents, token: "jeton-de-test" });

  test("montant exact : accepté, mais DÉMONSTRATION : la facture reste « envoyée »", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    const invoice = await makeSentInvoice();
    const res = await confirm(apiRequest("POST", "/api/demo/paiement/confirmation", confirmBody(invoice.id, 8150)));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, demo: true, amountCents: 8150 });
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ status: "SENT", paidAt: null });
  });

  test("montant modifié côté navigateur (1 centime au lieu de 8150) : refusé 409", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    const invoice = await makeSentInvoice();
    expect((await confirm(apiRequest("POST", "/api/demo/paiement/confirmation", confirmBody(invoice.id, 1)))).status).toBe(409);
  });

  test("sans vérification biométrique récente : 403", async () => {
    await signIn("ADMIN");
    const invoice = await makeSentInvoice();
    expect((await confirm(apiRequest("POST", "/api/demo/paiement/confirmation", confirmBody(invoice.id, 8150)))).status).toBe(403);
  });

  test("corps invalide : montant flottant, négatif, jeton vide ou démesuré : 422", async () => {
    const admin = await signIn("ADMIN");
    await makePasskey(admin.id, new Date());
    const invoice = await makeSentInvoice();
    const send = (extra: object) => confirm(apiRequest("POST", "/api/demo/paiement/confirmation", { ...confirmBody(invoice.id, 8150), ...extra }));
    expect((await send({ amountCents: 81.5 })).status).toBe(422);
    expect((await send({ amountCents: -5 })).status).toBe(422);
    expect((await send({ token: "" })).status).toBe(422);
    expect((await send({ token: "x".repeat(20_001) })).status).toBe(422);
  });
});
