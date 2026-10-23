import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OfflineBooking, OfflineSnapshot } from "@/lib/offline/types";

// IndexedDB et le réseau sont simulés : on teste ce que la page affiche et enregistre quand l'équipe n'a pas de connexion.
let snapshot: OfflineSnapshot | null = null;
let queueLength = 0;
const queued: { booking: OfflineBooking; action: string }[] = [];
let syncResult = { sent: 0, dropped: [] as string[], pending: 0, needsLogin: false, snapshot: "ok" as const };
let syncCalls = 0;

mock.module("@/lib/offline/store", () => ({
  loadSnapshot: async () => snapshot ?? undefined,
  loadQueue: async () => Array.from({ length: queueLength }),
}));
mock.module("@/lib/offline/sync", () => ({
  queueAction: async (booking: OfflineBooking, action: string) => {
    queued.push({ booking, action });
    queueLength++;
  },
  syncAll: async () => {
    syncCalls++;
    queueLength = syncResult.pending;
    return syncResult;
  },
}));

const { OfflineDay } = await import("@/app/offline/offline-day");

const TODAY = "2026-10-23";
const booking = (over: Partial<OfflineBooking> & { dogName?: string } = {}): OfflineBooking => ({
  id: over.id ?? "b1",
  status: over.status ?? "CONFIRMED",
  startDate: over.startDate ?? TODAY,
  endDate: over.endDate ?? "2026-10-27",
  kennel: over.kennel === undefined ? "Box 3" : over.kennel,
  dog: {
    id: "d1",
    name: over.dogName ?? "Milo",
    breed: "Croisé",
    allergies: "poulet",
    diet: null,
    behaviorNotes: null,
    vetName: "Dr Vet",
    vetPhone: "02 00 00 00 00",
    owner: { name: "Léa Martin", phone: "06 11 22 33 44" },
    vaccinations: [{ name: "Rage", expiresAt: "2027-01-10" }],
    ...over.dog,
  },
});
const snap = (...bookings: OfflineBooking[]): OfflineSnapshot => ({ generatedAt: "2026-10-23T08:00:00.000Z", today: TODAY, bookings });

beforeEach(() => {
  snapshot = null;
  queueLength = 0;
  queued.length = 0;
  syncCalls = 0;
  syncResult = { sent: 0, dropped: [], pending: 0, needsLogin: false, snapshot: "ok" };
});

describe("OfflineDay : lecture de la copie locale", () => {
  test("pendant la lecture d'IndexedDB : message de chargement", () => {
    render(<OfflineDay />);
    expect(screen.getByText("Chargement de la copie locale…")).toBeDefined();
  });

  test("aucune copie sur cet appareil : explication, pas d'erreur", async () => {
    render(<OfflineDay />);
    expect((await screen.findByText(/Aucune copie locale de la journée/)).textContent).toContain("avec du réseau");
  });

  test("copie sans séjour actif : message dédié", async () => {
    snapshot = snap();
    render(<OfflineDay />);
    expect(await screen.findByText(/Aucun séjour en cours ni attendu/)).toBeDefined();
  });

  test("titre « Journée du … » et date de la copie", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    expect((await screen.findByRole("heading", { name: /Journée du/ })).textContent).toContain("23");
    expect(screen.getByText(/Copie locale du/)).toBeDefined();
  });

  test.each([
    ["arrivée attendue", booking({ status: "CONFIRMED" }), "Arrivée attendue", "Enregistrer l'arrivée"],
    ["présent", booking({ status: "CHECKED_IN", endDate: "2026-10-27" }), "Présent", "Enregistrer le départ"],
    ["départ prévu aujourd'hui", booking({ status: "CHECKED_IN", endDate: TODAY }), "Départ prévu", "Enregistrer le départ"],
  ])("%s : badge « %s » et bouton « %s »", async (_nom, b, badge, button) => {
    snapshot = snap(b);
    render(<OfflineDay />);
    expect(await screen.findByText(badge)).toBeDefined();
    expect(screen.getByRole("button", { name: button })).toBeDefined();
  });

  test("un séjour déjà terminé n'est pas listé", async () => {
    snapshot = snap(booking({ status: "COMPLETED", dogName: "Termine" }), booking({ id: "b2", dogName: "Actif" }));
    render(<OfflineDay />);
    await screen.findByText("Actif");
    expect(screen.queryByText("Termine")).toBeNull();
  });

  test("box à attribuer quand aucune box n'est choisie", async () => {
    snapshot = snap(booking({ kennel: null }));
    render(<OfflineDay />);
    expect(await screen.findByText(/Box à attribuer/)).toBeDefined();
  });

  test("la fiche du chien donne ce qu'il faut sur le terrain, et « — » pour ce qui n'est pas renseigné", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    await screen.findByText("Milo");
    const fiche = screen.getByText("Fiche de Milo").closest("details")!;
    const dl = within(fiche);
    expect(dl.getByText("Léa Martin · 06 11 22 33 44")).toBeDefined();
    expect(dl.getByText("poulet")).toBeDefined();
    expect(dl.getByText("Dr Vet · 02 00 00 00 00")).toBeDefined();
    expect(dl.getAllByText("—").length).toBeGreaterThanOrEqual(2); // alimentation et comportement vides
  });

  test("un vaccin expiré est signalé dans la fiche", async () => {
    snapshot = snap(booking({ dog: { ...booking().dog, vaccinations: [{ name: "Rage", expiresAt: "2026-09-01" }, { name: "Toux", expiresAt: "2027-03-01" }] } }));
    render(<OfflineDay />);
    await screen.findByText("Milo");
    const vaccins = screen.getByText(/Rage \(jusqu'au/).textContent ?? "";
    expect(vaccins).toContain(", expiré");
    expect(vaccins.split(";")[1]).not.toContain("expiré");
  });
});

describe("OfflineDay : gestes enregistrés sans réseau", () => {
  test("arrivée : enregistrée dans la file avec le séjour, message au féminin, puis statut mis à jour", async () => {
    snapshot = snap(booking({ id: "b7", dogName: "Milo" }));
    render(<OfflineDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer l'arrivée" }));
    expect((await screen.findByRole("status")).textContent).toBe("Arrivée de Milo enregistrée sur cet appareil, synchronisée au retour du réseau.");
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ action: "check-in", booking: { id: "b7" } });
  });

  test("départ : enregistré, message au masculin", async () => {
    snapshot = snap(booking({ id: "b8", status: "CHECKED_IN", dogName: "Rex" }));
    render(<OfflineDay />);
    await userEvent.click(await screen.findByRole("button", { name: "Enregistrer le départ" }));
    expect((await screen.findByRole("status")).textContent).toBe("Départ de Rex enregistré sur cet appareil, synchronisé au retour du réseau.");
    expect(queued[0]).toMatchObject({ action: "check-out", booking: { id: "b8" } });
  });

  test("les gestes en attente sont comptés à l'écran", async () => {
    snapshot = snap(booking());
    queueLength = 2;
    render(<OfflineDay />);
    expect((await screen.findByText(/geste\(s\) en attente de synchronisation/)).textContent).toContain("2 geste(s)");
  });

  test("zone d'annonce (role=status) présente dès le départ : les messages sont lus par les lecteurs d'écran", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    expect((await screen.findByRole("status")).textContent).toBe("");
  });
});

describe("OfflineDay : retour du réseau", () => {
  const goOnline = () => fireEvent(window, new Event("online"));

  test("rejoue les gestes puis le dit", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    await screen.findByText("Milo");
    syncResult = { sent: 2, dropped: [], pending: 0, needsLogin: false, snapshot: "ok" };
    goOnline();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("2 geste(s) synchronisé(s)."));
    expect(syncCalls).toBe(1);
  });

  test("un geste devenu impossible est signalé avec le nom du chien et la raison", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    await screen.findByText("Milo");
    syncResult = { sent: 0, dropped: ["Milo : Cette action n'est plus possible pour cette réservation."], pending: 0, needsLogin: false, snapshot: "ok" };
    goOnline();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Ignoré : Milo : Cette action n'est plus possible"));
  });

  test("session expirée : l'utilisateur est invité à se reconnecter, ses gestes restent en attente", async () => {
    snapshot = snap(booking());
    render(<OfflineDay />);
    await screen.findByText("Milo");
    syncResult = { sent: 0, dropped: [], pending: 1, needsLogin: true, snapshot: "ok" };
    goOnline();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Reconnectez-vous"));
    expect(await screen.findByText(/1 geste\(s\) en attente/)).toBeDefined();
  });

  test("le composant retiré n'écoute plus le réseau (pas de synchronisation fantôme)", async () => {
    snapshot = snap(booking());
    const { unmount } = render(<OfflineDay />);
    await screen.findByText("Milo");
    unmount();
    goOnline();
    await new Promise((r) => setTimeout(r, 30));
    expect(syncCalls).toBe(0);
  });
});
