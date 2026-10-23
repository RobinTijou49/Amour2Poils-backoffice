import { beforeEach, describe, expect, test } from "bun:test";
import { POST as createBooking } from "@/app/api/reservations/route";
import { POST as moveStock } from "@/app/api/stock/[id]/mouvements/route";
import { setInvoiceStatus } from "@/app/(backoffice)/facturation/actions";
import { enrollDog } from "@/app/(backoffice)/seances/actions";
import { apiRequest, formData, isoDay, makeDog, makeKennel, makeOwner, makeProduct, makeTrainingSession, prisma, resetDb, signIn, withId } from "./helpers";

// Deux clients qui agissent EN MÊME TEMPS : c'est là qu'une règle « lire puis écrire » casse (stock vendu deux fois,
// place de séance donnée deux fois, numéro de facture en double). Ces tests lancent les requêtes en parallèle sur la vraie base.
beforeEach(resetDb);

const year = new Date().getUTCFullYear();

describe("concurrence", () => {
  test("stock : 8 sorties simultanées de 1 sur un stock de 5 → exactement 5 réussissent, stock à 0, jamais négatif", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 5, alertThreshold: 1 });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => moveStock(apiRequest("POST", `/api/stock/${p.id}/mouvements`, { type: "OUT", quantity: 1 }), withId(p.id))),
    );
    const ok = results.filter((r) => r.status === 201).length;
    const refused = results.filter((r) => r.status === 409).length;
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.quantity).toBeGreaterThanOrEqual(0);
    expect({ ok, refused, quantity: row.quantity, movements: await prisma.stockMovement.count() }).toEqual({ ok: 5, refused: 3, quantity: 0, movements: 5 });
  });

  test("stock : deux sorties de 3 simultanées sur un stock de 5 → une seule passe (pas de mise à jour perdue)", async () => {
    await signIn();
    const p = await makeProduct({ quantity: 5 });
    const results = await Promise.all(
      [1, 2].map(() => moveStock(apiRequest("POST", `/api/stock/${p.id}/mouvements`, { type: "OUT", quantity: 3 }), withId(p.id))),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(2);
  });

  test("séance : 6 inscriptions simultanées pour 2 places → exactement 2 inscrits", async () => {
    await signIn();
    const session = await makeTrainingSession({ capacity: 2 });
    const dogs = await Promise.all(Array.from({ length: 6 }, () => makeDog()));
    await Promise.all(dogs.map((d) => enrollDog({}, formData({ sessionId: session.id, dogId: d.id }))));
    expect(await prisma.enrollment.count({ where: { sessionId: session.id } })).toBe(2);
  });

  test("box : 5 réservations simultanées de la même box (capacité 1) aux mêmes dates → une seule créée", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    const dogs = await Promise.all(Array.from({ length: 5 }, () => makeDog()));
    const results = await Promise.all(
      dogs.map((d) => createBooking(apiRequest("POST", "/api/reservations", { dogId: d.id, kennelId: kennel.id, startDate: isoDay(2), endDate: isoDay(5), nightlyRate: 20 }))),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.booking.count({ where: { kennelId: kennel.id } })).toBe(1);
  });

  test("facture : 5 envois simultanés → 5 numéros distincts et consécutifs, aucune erreur", async () => {
    await signIn("ADMIN");
    const owner = await makeOwner();
    const drafts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.invoice.create({ data: { number: `BROUILLON-c${i}`, ownerId: owner.id, lines: { create: { label: "Pension", quantity: 1, unitPriceCents: 1000 } } } }),
      ),
    );
    const results = await Promise.allSettled(drafts.map((d) => setInvoiceStatus({}, formData({ id: d.id, status: "SENT" }))));
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(0);
    const numbers = (await prisma.invoice.findMany({ orderBy: { number: "asc" } })).map((i) => i.number);
    expect(numbers).toEqual([1, 2, 3, 4, 5].map((n) => `F-${year}-${String(n).padStart(4, "0")}`));
  });
});
