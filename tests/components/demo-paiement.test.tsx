import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// On remplace la bibliothèque WebAuthn du navigateur (il n'y a ni empreinte ni appareil dans un test) et PaymentRequest
// (pas de portefeuille non plus) : ce qu'on vérifie ici, c'est NOTRE composant : ce qu'il envoie au serveur, ce qu'il
// affiche, dans quel ordre, et ce qu'il refuse.
let webauthnSupported = true;
let platformAvailable = true;
const startRegistration = mock(async (...args: unknown[]) => (void args, { id: "cred-1", type: "public-key" }));
const startAuthentication = mock(async (...args: unknown[]) => (void args, { id: "cred-1", type: "public-key" }));
mock.module("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => webauthnSupported,
  platformAuthenticatorIsAvailable: async () => platformAvailable,
  startRegistration: (arg: unknown) => startRegistration(arg),
  startAuthentication: (arg: unknown) => startAuthentication(arg),
}));

const { DemoPaiement } = await import("@/app/(backoffice)/demo/paiement/demo-paiement");

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];
let routes: Record<string, { status?: number; json: unknown }> = {};
const realFetch = globalThis.fetch;

const invoices = [
  { id: "inv-1", number: "F-2026-0004", owner: "Camille Durand", totalCents: 8150 },
  { id: "inv-2", number: "F-2026-0005", owner: "Jean Martin", totalCents: 4400 },
];

let shown = 0;
let completed: string[] = [];
let canMake = true;
let showError: Error | null = null;
class FakePaymentRequest {
  constructor(public methods: unknown, details: { total: { amount: { value: string } } }) {
    lastAmount = details.total.amount.value;
  }
  canMakePayment = async () => canMake;
  show = async () => {
    shown++;
    if (showError) throw showError;
    return { details: { paymentMethodData: { tokenizationData: { token: "jeton-opaque" } } }, complete: async (r: string) => void completed.push(r) };
  };
}
let lastAmount: string | null = null;

beforeEach(() => {
  webauthnSupported = true;
  platformAvailable = true;
  startRegistration.mockClear();
  startAuthentication.mockClear();
  calls = [];
  shown = 0;
  completed = [];
  canMake = true;
  showError = null;
  lastAmount = null;
  routes = {};
  (window as unknown as { PaymentRequest: unknown }).PaymentRequest = FakePaymentRequest;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? "{}")) });
    const r = routes[url] ?? { json: {} };
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete (window as unknown as { PaymentRequest?: unknown }).PaymentRequest;
});

const renderDemo = (props: Partial<Parameters<typeof DemoPaiement>[0]> = {}) => render(<DemoPaiement passkeys={[]} invoices={invoices} {...props} />);
const status = (section: string) => within(screen.getByRole("heading", { name: section }).closest("section")!).getByRole("status");
const alert = (section: string) => within(screen.getByRole("heading", { name: section }).closest("section")!).getByRole("alert");
const STEP1 = "Étape 1 : prouver son identité avec une passkey";
const STEP2 = "Étape 2 : payer avec la Payment Request API";

describe("détection des capacités de l'appareil", () => {
  test("tout est disponible : trois « Disponible »", async () => {
    renderDemo();
    await waitFor(() => expect(screen.getAllByText("Disponible")).toHaveLength(3));
  });

  test("sans Payment Request : « Non disponible » et le bouton de paiement reste désactivé", async () => {
    delete (window as unknown as { PaymentRequest?: unknown }).PaymentRequest;
    routes["/api/demo/paiement/intention"] = { json: { invoiceId: "inv-1", number: "F-2026-0004", amountCents: 8150 } };
    renderDemo({ passkeys: [{ id: "p1", createdAt: "1 janv. 2026", lastUsedAt: null }] });
    await waitFor(() => expect(screen.getByText("Non disponible")).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: "Demander le montant au serveur" }));
    await screen.findByText(/Le serveur demande/);
    expect((screen.getByRole("button", { name: /^Payer/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("sans WebAuthn : les boutons de passkey sont désactivés", async () => {
    webauthnSupported = false;
    renderDemo();
    await waitFor(() => expect((screen.getByRole("button", { name: "Enregistrer une passkey" }) as HTMLButtonElement).disabled).toBe(true));
  });
});

describe("étape 1 : passkey", () => {
  test("inscription : options, appareil, vérification, puis le compteur augmente et c'est annoncé", async () => {
    routes["/api/demo/passkeys/inscription/options"] = { json: { challenge: "abc" } };
    routes["/api/demo/passkeys/inscription/verification"] = { status: 201, json: { ok: true } };
    renderDemo();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une passkey" }));
    await waitFor(() => expect(status(STEP1).textContent).toContain("Passkey enregistrée"));
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: { challenge: "abc" } });
    expect(calls.map((c) => c.url)).toEqual(["/api/demo/passkeys/inscription/options", "/api/demo/passkeys/inscription/verification"]);
    expect(calls[1]!.body).toEqual({ response: { id: "cred-1", type: "public-key" } });
    expect(screen.getByText("1", { selector: "strong" })).toBeDefined();
  });

  test("l'utilisateur annule sur l'appareil (NotAllowedError) : message clair, rien n'est envoyé au serveur ensuite", async () => {
    routes["/api/demo/passkeys/inscription/options"] = { json: { challenge: "abc" } };
    startRegistration.mockImplementationOnce(async () => {
      throw Object.assign(new Error("x"), { name: "NotAllowedError" });
    });
    renderDemo();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer une passkey" }));
    await waitFor(() => expect(alert(STEP1).textContent).toContain("Annulé ou refusé"));
    expect(calls).toHaveLength(1);
  });

  test("le serveur refuse les options : son message est affiché et l'appareil n'est pas sollicité", async () => {
    routes["/api/demo/passkeys/authentification/options"] = { status: 409, json: { error: "Aucune passkey enregistrée : enregistrez-en une d'abord." } };
    renderDemo({ passkeys: [{ id: "p1", createdAt: "x", lastUsedAt: null }] });
    await userEvent.click(screen.getByRole("button", { name: /Me vérifier/ }));
    await waitFor(() => expect(alert(STEP1).textContent).toContain("Aucune passkey enregistrée"));
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  test("« Me vérifier » est désactivé tant qu'aucune passkey n'existe", () => {
    renderDemo();
    expect((screen.getByRole("button", { name: /Me vérifier/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("vérification réussie : annonce que le paiement est autorisé 2 minutes", async () => {
    routes["/api/demo/passkeys/authentification/options"] = { json: { challenge: "def" } };
    routes["/api/demo/passkeys/authentification/verification"] = { json: { ok: true } };
    renderDemo({ passkeys: [{ id: "p1", createdAt: "x", lastUsedAt: null }] });
    await userEvent.click(screen.getByRole("button", { name: /Me vérifier/ }));
    await waitFor(() => expect(status(STEP1).textContent).toContain("2 minutes"));
  });

  test("signature refusée par le serveur : l'erreur du serveur est affichée", async () => {
    routes["/api/demo/passkeys/authentification/options"] = { json: { challenge: "def" } };
    routes["/api/demo/passkeys/authentification/verification"] = { status: 400, json: { error: "Vérification refusée : la signature n'est pas valide." } };
    renderDemo({ passkeys: [{ id: "p1", createdAt: "x", lastUsedAt: null }] });
    await userEvent.click(screen.getByRole("button", { name: /Me vérifier/ }));
    await waitFor(() => expect(alert(STEP1).textContent).toContain("signature n'est pas valide"));
  });
});

describe("étape 2 : Payment Request", () => {
  const askAmount = async () => {
    routes["/api/demo/paiement/intention"] = { json: { invoiceId: "inv-1", number: "F-2026-0004", amountCents: 8150, currency: "EUR" } };
    await userEvent.click(screen.getByRole("button", { name: "Demander le montant au serveur" }));
    await screen.findByText(/Le serveur demande/);
  };

  test("le montant vient du SERVEUR, jamais du navigateur : la requête n'envoie que l'identifiant de la facture", async () => {
    renderDemo();
    await askAmount();
    expect(calls[0]).toEqual({ url: "/api/demo/paiement/intention", body: { invoiceId: "inv-1" } });
    expect(status(STEP2).textContent).toContain("81,50");
  });

  test("sans vérification biométrique, le serveur refuse : message affiché, pas de bouton de paiement actif", async () => {
    routes["/api/demo/paiement/intention"] = { status: 403, json: { error: "Confirmez d'abord par empreinte, visage ou code (passkey)." } };
    renderDemo();
    await userEvent.click(screen.getByRole("button", { name: "Demander le montant au serveur" }));
    await waitFor(() => expect(alert(STEP2).textContent).toContain("Confirmez d'abord"));
    expect((screen.getByRole("button", { name: "Payer avec le portefeuille" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("choisir une autre facture efface le montant déjà demandé (pas de paiement d'un montant périmé)", async () => {
    renderDemo();
    await askAmount();
    expect((screen.getByRole("button", { name: /Payer 81,50/ }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Facture à payer" }), "inv-2");
    expect((screen.getByRole("button", { name: "Payer avec le portefeuille" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("paiement : la feuille s'ouvre avec le total en euros, le jeton part avec le montant du serveur, puis « success »", async () => {
    renderDemo();
    await askAmount();
    routes["/api/demo/paiement/confirmation"] = { json: { ok: true, demo: true, message: "Démonstration : aucun débit, facture inchangée." } };
    await userEvent.click(screen.getByRole("button", { name: /Payer 81,50/ }));
    await waitFor(() => expect(status(STEP2).textContent).toContain("aucun débit"));
    expect(lastAmount).toBe("81.50");
    expect(calls.at(-1)).toMatchObject({
      url: "/api/demo/paiement/confirmation",
      body: { invoiceId: "inv-1", amountCents: 8150, token: expect.stringContaining("jeton-opaque") },
    });
    expect(completed).toEqual(["success"]);
  });

  test("le serveur refuse la confirmation : la feuille est fermée en « fail » et l'erreur affichée", async () => {
    renderDemo();
    await askAmount();
    routes["/api/demo/paiement/confirmation"] = { status: 409, json: { error: "Le montant ne correspond pas à la facture." } };
    await userEvent.click(screen.getByRole("button", { name: /Payer 81,50/ }));
    await waitFor(() => expect(alert(STEP2).textContent).toContain("ne correspond pas"));
    expect(completed).toEqual(["fail"]);
  });

  test("l'utilisateur ferme la feuille (AbortError) : « Paiement annulé », rien n'est envoyé", async () => {
    renderDemo();
    await askAmount();
    showError = Object.assign(new Error("x"), { name: "AbortError" });
    await userEvent.click(screen.getByRole("button", { name: /Payer 81,50/ }));
    await waitFor(() => expect(alert(STEP2).textContent).toBe("Paiement annulé."));
    expect(calls.filter((c) => c.url.endsWith("confirmation"))).toHaveLength(0);
  });

  test("aucun portefeuille compatible (canMakePayment faux) : message clair, la feuille n'est pas ouverte", async () => {
    renderDemo();
    await askAmount();
    canMake = false;
    await userEvent.click(screen.getByRole("button", { name: /Payer 81,50/ }));
    await waitFor(() => expect(alert(STEP2).textContent).toContain("Aucun portefeuille compatible"));
    expect(shown).toBe(0);
  });

  test("aucune facture envoyée : on l'explique au lieu d'afficher un formulaire vide", () => {
    renderDemo({ invoices: [] });
    expect(screen.getByText(/Aucune facture « envoyée » à payer/)).toBeDefined();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("accessibilité", () => {
  test("chaque étape a ses zones d'annonce PERSISTANTES (status et alert déjà dans la page, vides au départ)", () => {
    renderDemo();
    for (const step of [STEP1, STEP2]) {
      expect(status(step).textContent).toBe("");
      expect(alert(step).textContent).toBe("");
    }
  });
});
