import { beforeEach, describe, expect, test } from "bun:test";
import { GET as listBookings, POST as createBooking } from "@/app/api/reservations/route";
import { PATCH as patchBooking } from "@/app/api/reservations/[id]/route";
import { apiRequest, day, isoDay, makeBooking, makeDog, makeKennel, prisma, pushCalls, resetDb, signIn, withId } from "./helpers";

beforeEach(resetDb);

const create = (body: unknown, headers?: Record<string, string>) => createBooking(apiRequest("POST", "/api/reservations", body, headers));
const patch = (id: string, body: unknown) => patchBooking(apiRequest("PATCH", `/api/reservations/${id}`, body), withId(id));
const json = async (res: Response) => (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

describe("GET /api/reservations", () => {
  test("sans session : 401", async () => {
    expect((await listBookings(apiRequest("GET", "/api/reservations"))).status).toBe(401);
  });

  test("filtre par statut, triées par date d'arrivée", async () => {
    await signIn();
    await makeBooking({ status: "CONFIRMED", startDate: day(5), endDate: day(7) });
    await makeBooking({ status: "CONFIRMED", startDate: day(2), endDate: day(3) });
    await makeBooking({ status: "CANCELLED" });
    const res = await json(await listBookings(apiRequest("GET", "/api/reservations?status=CONFIRMED")));
    expect(res.bookings).toHaveLength(2);
    expect(res.bookings[0].startDate < res.bookings[1].startDate).toBe(true);
  });

  test("statut inconnu : 422", async () => {
    await signIn();
    expect((await listBookings(apiRequest("GET", "/api/reservations?status=INCONNU"))).status).toBe(422);
  });
});

describe("POST /api/reservations", () => {
  const valid = async () => ({ dogId: (await makeDog({ name: "Oslo" })).id, startDate: isoDay(2), endDate: isoDay(5), nightlyRate: 22.5 });

  test("sans box : réservation « en attente », tarif en centimes, notification « Nouvelle réservation »", async () => {
    await signIn();
    const res = await create(await valid());
    expect(res.status).toBe(201);
    const booking = (await json(res)).booking;
    expect(res.headers.get("location")).toBe(`/api/reservations/${booking.id}`);
    expect(booking).toMatchObject({ status: "PENDING", nightlyRateCents: 2250, kennelId: null });
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0]).toMatchObject({ title: "Nouvelle réservation", url: `/reservations/${booking.id}` });
    expect(pushCalls[0].body).toContain("Oslo");
    expect(pushCalls[0].body).toContain("box à attribuer");
  });

  test("avec une box libre : réservation confirmée", async () => {
    await signIn();
    const kennel = await makeKennel();
    const res = await create({ ...(await valid()), kennelId: kennel.id });
    expect(res.status).toBe(201);
    expect((await json(res)).booking).toMatchObject({ status: "CONFIRMED", kennelId: kennel.id });
  });

  test("box complète sur ces dates : 409, rien n'est créé, aucune notification", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(3), endDate: day(6), status: "CONFIRMED" });
    const res = await create({ ...(await valid()), kennelId: kennel.id });
    expect(res.status).toBe(409);
    expect((await json(res)).details.kennelId).toContain("complète");
    expect(await prisma.booking.count()).toBe(1);
    expect(pushCalls).toHaveLength(0);
  });

  test("la box peut accueillir un séjour qui commence le jour du départ du précédent", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(0), endDate: day(2), status: "CONFIRMED" });
    expect((await create({ ...(await valid()), kennelId: kennel.id })).status).toBe(201);
  });

  test("capacité 2 : un deuxième chien est accepté, un troisième non", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 2 });
    await makeBooking({ kennelId: kennel.id, startDate: day(2), endDate: day(5), status: "CONFIRMED" });
    expect((await create({ ...(await valid()), kennelId: kennel.id })).status).toBe(201);
    expect((await create({ ...(await valid()), kennelId: kennel.id })).status).toBe(409);
  });

  test("les séjours annulés ou en attente ne bloquent pas la box", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(2), endDate: day(5), status: "CANCELLED" });
    await makeBooking({ kennelId: kennel.id, startDate: day(2), endDate: day(5), status: "PENDING" });
    expect((await create({ ...(await valid()), kennelId: kennel.id })).status).toBe(201);
  });

  test("box désactivée : refusée comme complète", async () => {
    await signIn();
    const kennel = await makeKennel({ active: false });
    expect((await create({ ...(await valid()), kennelId: kennel.id })).status).toBe(409);
  });

  test("chien inconnu : 422", async () => {
    await signIn();
    const res = await create({ dogId: "inconnu", startDate: isoDay(2), endDate: isoDay(5), nightlyRate: 20 });
    expect(res.status).toBe(422);
    expect((await json(res)).details.dogId).toBeDefined();
  });

  test.each([
    ["arrivée dans le passé", { startDate: isoDay(-2) }, "startDate"],
    ["départ avant l'arrivée", { endDate: isoDay(1) }, "endDate"],
    ["tarif nul", { nightlyRate: 0 }, "nightlyRate"],
    ["tarif excessif", { nightlyRate: 900 }, "nightlyRate"],
    ["date inexistante", { startDate: `${new Date().getUTCFullYear() + 1}-02-30` }, "startDate"],
  ])("%s : 422 sur le bon champ, rien d'écrit", async (_nom, override, field) => {
    await signIn();
    const res = await create({ ...(await valid()), ...override });
    expect(res.status).toBe(422);
    expect((await json(res)).details[field]).toBeDefined();
    expect(await prisma.booking.count()).toBe(0);
  });

  test("corps qui n'est pas du JSON valide : 422", async () => {
    await signIn();
    const bad = new Request("http://localhost:3000/api/reservations", { method: "POST", headers: { "content-type": "application/json" }, body: "{pas du json" });
    expect((await createBooking(bad)).status).toBe(422);
  });

  test("sans session 401, origine étrangère 403", async () => {
    expect((await create(await valid())).status).toBe(401);
    await signIn();
    expect((await create(await valid(), { origin: "https://evil.example" })).status).toBe(403);
    expect(await prisma.booking.count()).toBe(0);
  });
});

describe("PATCH /api/reservations/:id", () => {
  test("confirmer exige une box : 422 sans, 200 avec", async () => {
    await signIn();
    const kennel = await makeKennel();
    const b = await makeBooking({ status: "PENDING" });
    expect((await patch(b.id, { action: "confirm" })).status).toBe(422);
    const ok = await patch(b.id, { action: "confirm", kennelId: kennel.id });
    expect(ok.status).toBe(200);
    expect((await json(ok)).booking).toMatchObject({ status: "CONFIRMED", kennelId: kennel.id });
  });

  test("confirmer dans une box complète : 409, la réservation reste en attente", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    await makeBooking({ kennelId: kennel.id, startDate: day(1), endDate: day(4), status: "CONFIRMED" });
    const b = await makeBooking({ status: "PENDING", startDate: day(2), endDate: day(3) });
    expect((await patch(b.id, { action: "confirm", kennelId: kennel.id })).status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("PENDING");
  });

  test("une réservation ne compte pas contre sa propre box quand on la reconfirme", async () => {
    await signIn();
    const kennel = await makeKennel({ capacity: 1 });
    const b = await makeBooking({ status: "PENDING", kennelId: kennel.id });
    expect((await patch(b.id, { action: "confirm", kennelId: kennel.id })).status).toBe(200);
  });

  test("arrivée : statut CHECKED_IN et heure réelle du geste conservée (`at`)", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED" });
    const at = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const res = await patch(b.id, { action: "check-in", at });
    expect(res.status).toBe(200);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("CHECKED_IN");
    expect(row.checkedInAt?.toISOString()).toBe(at);
  });

  test("une heure dans le futur ou vieille de plus de 7 jours est remplacée par maintenant", async () => {
    await signIn();
    for (const at of [new Date(Date.now() + 86_400_000).toISOString(), new Date(Date.now() - 8 * 86_400_000).toISOString()]) {
      const b = await makeBooking({ status: "CONFIRMED" });
      const before = Date.now();
      expect((await patch(b.id, { action: "check-in", at })).status).toBe(200);
      const t = (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).checkedInAt!.getTime();
      expect(t).toBeGreaterThanOrEqual(before - 1000);
      expect(t).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });

  test("cycle complet arrivée → départ, puis plus aucune action possible (409)", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await patch(b.id, { action: "check-in" })).status).toBe(200);
    expect((await patch(b.id, { action: "check-in" })).status).toBe(409); // déjà arrivé
    expect((await patch(b.id, { action: "check-out" })).status).toBe(200);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.checkedOutAt).not.toBeNull();
    expect((await patch(b.id, { action: "check-out" })).status).toBe(409);
  });

  test("on ne peut pas partir sans être arrivé", async () => {
    await signIn();
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await patch(b.id, { action: "check-out" })).status).toBe(409);
  });

  test("annulation réservée à la gérance : employé 403 (réservation intacte), gérant 200", async () => {
    await signIn("EMPLOYEE");
    const b = await makeBooking({ status: "CONFIRMED" });
    expect((await patch(b.id, { action: "cancel" })).status).toBe(403);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CONFIRMED");
    await signIn("ADMIN");
    expect((await patch(b.id, { action: "cancel" })).status).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("CANCELLED");
  });

  test("on ne peut pas annuler un chien déjà arrivé", async () => {
    await signIn("ADMIN");
    const b = await makeBooking({ status: "CHECKED_IN" });
    expect((await patch(b.id, { action: "cancel" })).status).toBe(409);
  });

  test("réservation inconnue : 404 ; action inconnue : 422", async () => {
    await signIn();
    expect((await patch("inconnue", { action: "check-in" })).status).toBe(404);
    const b = await makeBooking();
    const res = await patch(b.id, { action: "supprimer" });
    expect(res.status).toBe(422);
    expect((await json(res)).details.action).toBeDefined();
  });

  test("`at` mal formé : 422", async () => {
    await signIn();
    const b = await makeBooking();
    expect((await patch(b.id, { action: "check-in", at: "hier soir" })).status).toBe(422);
  });

  test("sans session : 401", async () => {
    const b = await makeBooking();
    expect((await patch(b.id, { action: "check-in" })).status).toBe(401);
  });
});
