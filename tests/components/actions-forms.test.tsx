import { beforeEach, describe, expect, mock, test } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormState } from "@/lib/forms";

// Les Server Actions s'exécutent côté serveur (base, session) : ici on les remplace par des fonctions espionnes pour ne
// tester QUE le composant : ce qu'il envoie, ce qu'il affiche pendant et après, ce qu'il annonce aux lecteurs d'écran.
type Call = { prev: FormState; data: FormData };
const calls: Record<string, Call[]> = { checkIn: [], checkOut: [], recordMovement: [], setInvoiceStatus: [] };
let nextResult: FormState | Promise<FormState> = {};
let hold: Promise<void> | null = null;

const fake = (name: string) => async (prev: FormState, data: FormData) => {
  calls[name]!.push({ prev, data });
  if (hold) await hold;
  return nextResult;
};
mock.module("@/app/(backoffice)/reservations/actions", () => ({ checkIn: fake("checkIn"), checkOut: fake("checkOut") }));
mock.module("@/app/(backoffice)/stock/actions", () => ({ recordMovement: fake("recordMovement") }));
mock.module("@/app/(backoffice)/facturation/actions", () => ({ setInvoiceStatus: fake("setInvoiceStatus") }));

const { QuickAction } = await import("@/app/(backoffice)/reservations/quick-action");
const { MarkPaidForm, RestockForm } = await import("@/app/(backoffice)/dashboard-actions");

beforeEach(() => {
  for (const k of Object.keys(calls)) calls[k] = [];
  nextResult = {};
  hold = null;
});

describe("QuickAction : arrivée / départ en un clic depuis le tableau de bord", () => {
  test("le bouton a un nom accessible précis (quel chien, quelle action)", () => {
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    expect(screen.getByRole("button", { name: "Enregistrer l'arrivée d'Oslo" })).toBeDefined();
    render(<QuickAction id="b2" kind="out" dogName="Rex" />);
    expect(screen.getByRole("button", { name: "Enregistrer le départ de Rex" })).toBeDefined();
  });

  test("le clic envoie l'identifiant de la réservation à l'action d'arrivée (et pas à celle de départ)", async () => {
    nextResult = { success: "Arrivée d'Oslo enregistrée." };
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(calls.checkIn).toHaveLength(1));
    expect(calls.checkIn![0]!.data.get("id")).toBe("b1");
    expect(calls.checkOut).toHaveLength(0);
  });

  test("le départ appelle l'action de départ", async () => {
    nextResult = { success: "Départ de Rex enregistré." };
    render(<QuickAction id="b9" kind="out" dogName="Rex" />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(calls.checkOut).toHaveLength(1));
    expect(calls.checkOut![0]!.data.get("id")).toBe("b9");
  });

  test("après succès : le bouton disparaît (pas de double clic possible) et le message s'affiche", async () => {
    nextResult = { success: "Arrivée d'Oslo enregistrée." };
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Arrivée d'Oslo enregistrée.")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("après échec : l'erreur est annoncée (role=alert) et le bouton reste pour réessayer", async () => {
    nextResult = { error: "Cette action n'est plus possible pour cette réservation." };
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    await userEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toContain("plus possible");
    expect(screen.getByRole("button")).toBeDefined();
  });

  test("pendant l'envoi, le bouton est désactivé : un double clic n'envoie pas deux fois", async () => {
    let release!: () => void;
    hold = new Promise((r) => (release = r));
    nextResult = { success: "ok" };
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    await userEvent.click(button);
    await waitFor(() => expect(button.disabled).toBe(true));
    await userEvent.click(button);
    release();
    await screen.findByText("ok");
    expect(calls.checkIn).toHaveLength(1);
  });
});

describe("RestockForm : entrée de stock depuis l'alerte « stock bas »", () => {
  const renderForm = () => render(<RestockForm productId="p1" name="Croquettes chiot" unit="sac 15 kg" />);

  test("le champ de quantité a une étiquette (visible et nom accessible) et vaut 10 par défaut", () => {
    renderForm();
    const input = screen.getByRole("spinbutton", { name: "Quantité reçue pour Croquettes chiot" }) as HTMLInputElement;
    expect(input.value).toBe("10");
    expect(input.min).toBe("1");
    expect(input.required).toBe(true);
    expect(screen.getByText("Quantité reçue (sac 15 kg)")).toBeDefined();
  });

  test("envoie une ENTRÉE (IN) du produit, avec la quantité saisie et un motif", async () => {
    nextResult = { success: "Stock de « Croquettes chiot » : 17 sac 15 kg." };
    renderForm();
    const input = screen.getByRole("spinbutton");
    await userEvent.clear(input);
    await userEvent.type(input, "7");
    await userEvent.click(screen.getByRole("button", { name: "Entrée" }));
    await waitFor(() => expect(calls.recordMovement).toHaveLength(1));
    const data = calls.recordMovement![0]!.data;
    expect(data.get("productId")).toBe("p1");
    expect(data.get("type")).toBe("IN");
    expect(data.get("quantity")).toBe("7");
    expect(data.get("reason")).toContain("Réapprovisionnement");
  });

  test("succès : le formulaire est remplacé par le message annoncé", async () => {
    nextResult = { success: "Stock de « Croquettes chiot » : 17 sac 15 kg." };
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Entrée" }));
    expect((await screen.findByText(/17 sac 15 kg/)).textContent).toContain("Croquettes chiot");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("erreur de quantité : le message du champ est annoncé, le formulaire reste", async () => {
    nextResult = { error: "Corrigez les champs signalés.", fieldErrors: { quantity: "La quantité doit être supérieure à 0." } };
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Entrée" }));
    expect((await screen.findByRole("alert")).textContent).toBe("La quantité doit être supérieure à 0.");
    expect(screen.getByRole("button", { name: "Entrée" })).toBeDefined();
  });

  test("erreur générale (sans message de champ) : elle est annoncée", async () => {
    nextResult = { error: "Produit introuvable." };
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Entrée" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Produit introuvable.");
  });
});

describe("MarkPaidForm : « Marquer payée » depuis les factures à échéance", () => {
  test("le bouton nomme la facture (utile à un lecteur d'écran qui liste les boutons)", () => {
    render(<MarkPaidForm id="inv1" number="F-2026-0004" />);
    expect(screen.getByRole("button", { name: "Marquer payée : facture F-2026-0004" })).toBeDefined();
  });

  test("envoie l'identifiant de la facture", async () => {
    nextResult = { success: "Facture F-2026-0004 marquée payée." };
    render(<MarkPaidForm id="inv1" number="F-2026-0004" />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(calls.setInvoiceStatus).toHaveLength(1));
    expect(calls.setInvoiceStatus![0]!.data.get("id")).toBe("inv1");
    // Le bouton d'envoi porte lui-même le nouveau statut (name="status" value="PAID") : jamais un autre.
    expect(calls.setInvoiceStatus![0]!.data.get("status")).toBe("PAID");
  });

  test("succès : message annoncé, bouton retiré", async () => {
    nextResult = { success: "Facture F-2026-0004 marquée payée." };
    render(<MarkPaidForm id="inv1" number="F-2026-0004" />);
    await userEvent.click(screen.getByRole("button"));
    expect((await screen.findByText(/marquée payée/)).textContent).toContain("F-2026-0004");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("refus (employé, statut impossible) : l'erreur est annoncée", async () => {
    nextResult = { error: "Seule la gérance peut gérer la facturation." };
    render(<MarkPaidForm id="inv1" number="F-2026-0004" />);
    await userEvent.click(screen.getByRole("button"));
    expect((await screen.findByRole("alert")).textContent).toContain("gérance");
  });
});

describe("annonce aux lecteurs d'écran (zone persistante du layout)", () => {
  /** Messages envoyés à l'Announcer pendant un test. */
  const heard: string[] = [];
  beforeEach(() => {
    heard.length = 0;
    window.addEventListener("a2p:announce", (e) => heard.push((e as CustomEvent<string>).detail), { once: false });
  });

  test("une arrivée réussie est annoncée, même si le composant est ensuite retiré par le rafraîchissement", async () => {
    nextResult = { success: "Arrivée d'Oslo enregistrée." };
    const { unmount } = render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(heard).toContain("Arrivée d'Oslo enregistrée."));
    unmount(); // le tableau de bord remplace le bouton par « Fait » : l'annonce est déjà partie
    expect(heard).toContain("Arrivée d'Oslo enregistrée.");
  });

  test("une erreur n'est PAS envoyée à la zone d'annonce (elle reste affichée dans le composant, en role=alert)", async () => {
    nextResult = { error: "Cette action n'est plus possible pour cette réservation." };
    render(<QuickAction id="b1" kind="in" dogName="Oslo" />);
    await userEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    expect(heard).toHaveLength(0);
  });

  test("le réapprovisionnement et le paiement sont annoncés eux aussi", async () => {
    nextResult = { success: "Stock de « Croquettes chiot » : 17 sac 15 kg." };
    const stock = render(<RestockForm productId="p1" name="Croquettes chiot" unit="sac 15 kg" />);
    await userEvent.click(screen.getByRole("button", { name: "Entrée" }));
    await waitFor(() => expect(heard).toContain("Stock de « Croquettes chiot » : 17 sac 15 kg."));
    stock.unmount();
    nextResult = { success: "Facture F-2026-0004 marquée payée." };
    render(<MarkPaidForm id="inv1" number="F-2026-0004" />);
    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(heard).toContain("Facture F-2026-0004 marquée payée."));
  });
});
